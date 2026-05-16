"""
FLOWTYM RMS — Lighthouse Sync Worker

Pulls competitor rates from Lighthouse v3 API (api.mylighthouse.com)
and ingests them into public.competitor_rates.

Architecture:
    - One async task per (hotel, ota) combination
    - Pagination on Lighthouse side (>100 results)
    - Idempotent upsert via UNIQUE constraint on competitor_rates
    - Failures logged to public.competitor_sync_failures (no exceptions bubble up)
    - Schedule: 4x per day via GitHub Actions cron (06:00, 12:00, 16:00, 22:00 UTC)
    - Instrumentation: every run logged to public.worker_runs for scaling tracking

Scaling tiers (see docs/SCALING_PLAN.md):
    Tier 1 (1-30 hotels):   GitHub Actions cron, single batch       [CURRENT]
    Tier 2 (30-150 hotels): Actions matrix, multiple parallel batches
    Tier 3 (150-500):       Dedicated worker + Redis
    Tier 4 (500+):          BullMQ distributed workers + sharding

Batch parameters (used by Tier 2+):
    --batch-index N    : process only hotels where hash(id) % batch_count == N
    --batch-count M    : total number of parallel batches (default 1 = no sharding)

Run as:
    python -m backend.workers.lighthouse_sync                    # one-shot, all hotels
    python -m backend.workers.lighthouse_sync --batch-index 0 --batch-count 4  # batch 0 of 4
    python -m backend.workers.lighthouse_sync --watch            # blocking (legacy, prefer Actions cron)

Environment:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required for worker — bypasses RLS)
    LIGHTHOUSE_API_BASE   (optional, defaults to https://api.mylighthouse.com)
    LIGHTHOUSE_DAYS_AHEAD (optional, defaults to 90)
    WORKER_TRIGGER_SOURCE (optional, 'cron' | 'manual' | 'api', defaults to 'cron')

Security:
    - The Lighthouse token is stored in hotels.lighthouse_api_token (TEXT for MVP).
      It must NEVER reach the frontend. The worker uses service_role to fetch it.
    - Failures are logged WITHOUT the token.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("lighthouse_sync")

LIGHTHOUSE_API_BASE = os.getenv("LIGHTHOUSE_API_BASE", "https://api.mylighthouse.com")
LIGHTHOUSE_DAYS_AHEAD = int(os.getenv("LIGHTHOUSE_DAYS_AHEAD", "90"))
DEFAULT_OTAS = ["bookingdotcom", "expedia", "airbnb", "branddotcom"]

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
    # Don't crash at import — let main() report cleanly
    log.warning("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — worker cannot run")


@dataclass(frozen=True)
class HotelLighthouseConfig:
    hotel_id: str
    name: str
    api_token: str
    subscription_id: str
    otas: list[str]
    competitor_set_id: Optional[int]


class LighthouseError(Exception):
    """Recoverable Lighthouse API error (network, 5xx, 429)."""


class LighthouseAuthError(Exception):
    """Non-recoverable Lighthouse error (401, 403 — bad token)."""


# ─── Supabase access via REST (no SDK to keep deps minimal) ─────────────────

class SupabaseAdminClient:
    """Thin REST client using service_role key (bypasses RLS)."""

    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        # Long timeout for large upserts
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))

    async def close(self) -> None:
        await self._client.aclose()

    async def fetch_enabled_hotels(
        self,
        batch_index: int = 0,
        batch_count: int = 1,
    ) -> list[HotelLighthouseConfig]:
        """Return all hotels with lighthouse_enabled=true, optionally filtered by batch.

        Batch filtering uses md5(hotel_id) % batch_count == batch_index to
        give a stable, deterministic partition that doesn't shift when hotels
        are added or removed.
        """
        r = await self._client.get(
            f"{self.url}/rest/v1/hotels",
            headers=self.headers,
            params={
                "select": "id,name,lighthouse_api_token,lighthouse_subscription_id,lighthouse_otas,lighthouse_competitor_set_id",
                "lighthouse_enabled": "eq.true",
                "active": "eq.true",
            },
        )
        r.raise_for_status()
        rows = r.json()
        configs: list[HotelLighthouseConfig] = []
        for row in rows:
            hotel_id = row["id"]
            # Batch filtering (stable across hotel additions/removals)
            if batch_count > 1:
                bucket = int(hashlib.md5(hotel_id.encode()).hexdigest(), 16) % batch_count
                if bucket != batch_index:
                    continue
            token = row.get("lighthouse_api_token")
            sub = row.get("lighthouse_subscription_id")
            if not token or not sub:
                log.warning("Hotel %s enabled but token/sub missing — skipped", hotel_id)
                continue
            otas = row.get("lighthouse_otas") or DEFAULT_OTAS
            if isinstance(otas, str):
                try:
                    otas = json.loads(otas)
                except Exception:
                    otas = DEFAULT_OTAS
            configs.append(
                HotelLighthouseConfig(
                    hotel_id=hotel_id,
                    name=row.get("name") or "?",
                    api_token=token,
                    subscription_id=str(sub),
                    otas=otas,
                    competitor_set_id=row.get("lighthouse_competitor_set_id"),
                )
            )
        return configs

    # ─── worker_runs tracking ──────────────────────────────────────────────

    async def start_worker_run(
        self,
        worker_name: str,
        trigger_source: str,
        batch_index: int,
        batch_count: int,
    ) -> Optional[str]:
        """Insert a new worker_runs row with status='running'. Returns its id."""
        try:
            r = await self._client.post(
                f"{self.url}/rest/v1/worker_runs",
                headers={**self.headers, "Prefer": "return=representation"},
                json={
                    "worker_name": worker_name,
                    "trigger_source": trigger_source,
                    "status": "running",
                    "batch_index": batch_index,
                    "batch_count": batch_count,
                },
            )
            if r.status_code in (200, 201):
                data = r.json()
                if isinstance(data, list) and data:
                    return data[0].get("id")
                if isinstance(data, dict):
                    return data.get("id")
            log.warning("start_worker_run unexpected status %s: %s", r.status_code, r.text[:200])
        except httpx.HTTPError as e:
            log.warning("start_worker_run failed (ignored): %s", e)
        return None

    async def finish_worker_run(
        self,
        run_id: Optional[str],
        status: str,
        hotels_processed: int,
        hotels_succeeded: int,
        hotels_failed: int,
        rows_ingested: int,
        api_failures: int,
        summary: str,
    ) -> None:
        if not run_id:
            return
        try:
            await self._client.patch(
                f"{self.url}/rest/v1/worker_runs?id=eq.{run_id}",
                headers=self.headers,
                json={
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "status": status,
                    "hotels_processed": hotels_processed,
                    "hotels_succeeded": hotels_succeeded,
                    "hotels_failed": hotels_failed,
                    "rows_ingested": rows_ingested,
                    "api_failures": api_failures,
                    "summary": (summary or "")[:1000],
                },
            )
        except httpx.HTTPError as e:
            log.warning("finish_worker_run failed (ignored): %s", e)

    async def upsert_competitor_rates(self, rows: list[dict[str, Any]]) -> int:
        """Bulk upsert. Returns number of rows attempted."""
        if not rows:
            return 0
        # PostgREST upsert with on_conflict
        headers = {
            **self.headers,
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        }
        url = (
            f"{self.url}/rest/v1/competitor_rates"
            "?on_conflict=hotel_id,competitor_id,ota,stay_date,los,shopped_at"
        )
        # Chunk to stay under PostgREST payload limits
        total = 0
        for i in range(0, len(rows), 500):
            chunk = rows[i : i + 500]
            try:
                r = await self._client.post(url, headers=headers, json=chunk)
                if r.status_code not in (200, 201, 204):
                    log.error(
                        "upsert chunk failed: %s %s",
                        r.status_code,
                        r.text[:300],
                    )
                else:
                    total += len(chunk)
            except httpx.HTTPError as e:
                log.error("upsert chunk exception: %s", e)
        return total

    async def update_hotel_last_sync(self, hotel_id: str) -> None:
        try:
            await self._client.patch(
                f"{self.url}/rest/v1/hotels?id=eq.{hotel_id}",
                headers=self.headers,
                json={"lighthouse_last_sync_at": datetime.now(timezone.utc).isoformat()},
            )
        except httpx.HTTPError as e:
            log.warning("update_hotel_last_sync failed: %s", e)

    async def log_failure(
        self,
        hotel_id: str,
        ota: Optional[str],
        status_code: Optional[int],
        error_message: str,
        request_url: Optional[str] = None,
    ) -> None:
        try:
            # Strip any token from the URL before persisting
            safe_url = (request_url or "").replace("subscriptionId=", "subscriptionId=***")
            await self._client.post(
                f"{self.url}/rest/v1/competitor_sync_failures",
                headers={**self.headers, "Prefer": "return=minimal"},
                json={
                    "hotel_id": hotel_id,
                    "ota": ota,
                    "status_code": status_code,
                    "error_message": (error_message or "")[:1000],
                    "request_url": safe_url[:500],
                },
            )
        except httpx.HTTPError as e:
            log.warning("log_failure failed (ignored): %s", e)


# ─── Lighthouse API client ──────────────────────────────────────────────────

class LighthouseClient:
    """Async client for Lighthouse v3 /rates endpoint."""

    def __init__(self, base_url: str = LIGHTHOUSE_API_BASE):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))

    async def close(self) -> None:
        await self._client.aclose()

    async def fetch_rates(
        self,
        *,
        api_token: str,
        subscription_id: str,
        ota: str,
        from_date: date,
        to_date: date,
        los: int = 1,
        compset_id: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        """Fetch all rates pages for a (hotel, ota, date range). Returns flat list."""
        headers = {"X-Oi-Authorization": api_token}
        params_base: dict[str, Any] = {
            "subscriptionId": subscription_id,
            "ota": ota,
            "los": str(los),
            "fromDate": from_date.isoformat(),
            "toDate": to_date.isoformat(),
            "perPage": "100",
        }
        if compset_id is not None:
            params_base["compsetId"] = str(compset_id)

        all_rates: list[dict[str, Any]] = []
        page = 1
        max_pages = 50  # safety cap

        while page <= max_pages:
            params = {**params_base, "page": str(page)}
            url = f"{self.base_url}/v3/rates"

            try:
                async for attempt in AsyncRetrying(
                    stop=stop_after_attempt(3),
                    wait=wait_exponential(multiplier=2, min=2, max=20),
                    retry=retry_if_exception_type(LighthouseError),
                    reraise=True,
                ):
                    with attempt:
                        r = await self._client.get(url, headers=headers, params=params)
                        if r.status_code == 429:
                            raise LighthouseError(f"429 rate limited")
                        if r.status_code in (401, 403):
                            raise LighthouseAuthError(f"{r.status_code} — invalid token")
                        if r.status_code >= 500:
                            raise LighthouseError(f"{r.status_code}: {r.text[:200]}")
                        if r.status_code != 200:
                            raise LighthouseError(
                                f"unexpected {r.status_code}: {r.text[:200]}"
                            )
            except RetryError as e:
                raise LighthouseError(f"retries exhausted: {e}") from e

            payload = r.json()
            rates = payload.get("rates") or payload.get("data") or []
            all_rates.extend(rates)

            meta = payload.get("meta") or {}
            total_pages = meta.get("total_pages") or meta.get("totalPages") or 1
            if page >= total_pages:
                break
            page += 1

        return all_rates


# ─── Normalization: Lighthouse → competitor_rates rows ──────────────────────

def normalize_rate(
    hotel_id: str,
    ota: str,
    raw: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """Convert one Lighthouse rate object to a competitor_rates row.

    Lighthouse returns various field names depending on the OTA. We support
    the documented v3 schema with defensive fallbacks. Returns None if the
    minimum required fields are missing (logged, not raised).
    """
    competitor_id = (
        raw.get("hotelId")
        or raw.get("hotel_id")
        or raw.get("competitorId")
        or raw.get("competitor_id")
    )
    stay_date_raw = (
        raw.get("arrivalDate")
        or raw.get("arrival_date")
        or raw.get("stayDate")
        or raw.get("stay_date")
        or raw.get("date")
    )
    shopped_at_raw = (
        raw.get("shoppedAt")
        or raw.get("shopped_at")
        or raw.get("extractDate")
        or raw.get("extract_date")
    )

    if competitor_id is None or not stay_date_raw or not shopped_at_raw:
        log.debug("rate skipped (missing required fields): %s", raw)
        return None

    # Parse stay_date — accept YYYY-MM-DD or full ISO
    try:
        stay_date_str = str(stay_date_raw)[:10]
        # Validate by parsing
        date.fromisoformat(stay_date_str)
    except Exception:
        log.debug("invalid stay_date: %s", stay_date_raw)
        return None

    # Parse shopped_at — accept ISO with or without TZ; normalize to UTC ISO
    try:
        sa = str(shopped_at_raw).replace("Z", "+00:00")
        shopped_at_dt = datetime.fromisoformat(sa)
        if shopped_at_dt.tzinfo is None:
            shopped_at_dt = shopped_at_dt.replace(tzinfo=timezone.utc)
        shopped_at_iso = shopped_at_dt.astimezone(timezone.utc).isoformat()
    except Exception:
        log.debug("invalid shopped_at: %s", shopped_at_raw)
        return None

    price = raw.get("price")
    if price is not None:
        try:
            price = float(price)
        except (TypeError, ValueError):
            price = None

    available = raw.get("available")
    if available is None:
        available = price is not None

    return {
        "hotel_id": hotel_id,
        "competitor_id": int(competitor_id),
        "competitor_name": raw.get("hotelName") or raw.get("hotel_name") or str(competitor_id),
        "ota": ota,
        "stay_date": stay_date_str,
        "los": int(raw.get("los") or 1),
        "price": price,
        "currency": (raw.get("currency") or "EUR")[:8],
        "available": bool(available),
        "meal_type": raw.get("mealType") or raw.get("meal_type"),
        "room_type_label": raw.get("roomType") or raw.get("room_type"),
        "is_refundable": raw.get("isRefundable") or raw.get("is_refundable"),
        "position": raw.get("position") or raw.get("rank"),
        "shopped_at": shopped_at_iso,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "raw_payload": raw,
    }


# ─── Sync orchestrator ──────────────────────────────────────────────────────

async def sync_hotel(
    hotel: HotelLighthouseConfig,
    lighthouse: LighthouseClient,
    supa: SupabaseAdminClient,
    days_ahead: int,
) -> tuple[int, int]:
    """Sync one hotel across all its OTAs. Returns (rows_ingested, ota_failures)."""
    today = date.today()
    to_date = today + timedelta(days=days_ahead)

    total_ingested = 0
    failures = 0
    log.info("→ Syncing hotel %s (%s) — %d OTAs", hotel.name, hotel.hotel_id, len(hotel.otas))

    for ota in hotel.otas:
        try:
            raw_rates = await lighthouse.fetch_rates(
                api_token=hotel.api_token,
                subscription_id=hotel.subscription_id,
                ota=ota,
                from_date=today,
                to_date=to_date,
                compset_id=hotel.competitor_set_id,
            )
        except LighthouseAuthError as e:
            log.error("AUTH FAIL hotel=%s ota=%s: %s", hotel.hotel_id, ota, e)
            await supa.log_failure(hotel.hotel_id, ota, 401, str(e))
            failures += 1
            continue
        except LighthouseError as e:
            log.error("FETCH FAIL hotel=%s ota=%s: %s", hotel.hotel_id, ota, e)
            await supa.log_failure(hotel.hotel_id, ota, None, str(e))
            failures += 1
            continue
        except Exception as e:
            log.exception("UNEXPECTED hotel=%s ota=%s", hotel.hotel_id, ota)
            await supa.log_failure(hotel.hotel_id, ota, None, repr(e))
            failures += 1
            continue

        rows = [
            r for r in (normalize_rate(hotel.hotel_id, ota, raw) for raw in raw_rates) if r
        ]
        ingested = await supa.upsert_competitor_rates(rows)
        log.info("   ↳ %s: %d raw → %d ingested", ota, len(raw_rates), ingested)
        total_ingested += ingested

    if total_ingested > 0:
        await supa.update_hotel_last_sync(hotel.hotel_id)

    return total_ingested, failures


async def run_once(
    batch_index: int = 0,
    batch_count: int = 1,
    trigger_source: str = "cron",
) -> dict[str, Any]:
    """One-shot sync. Batching params allow Tier 2 parallel matrix execution.

    Records every run to public.worker_runs for scaling tracking.
    """
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return {"error": "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing"}

    supa = SupabaseAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    lighthouse = LighthouseClient(LIGHTHOUSE_API_BASE)

    started_at = datetime.now(timezone.utc)
    summary: dict[str, Any] = {
        "started_at": started_at.isoformat(),
        "batch_index": batch_index,
        "batch_count": batch_count,
        "hotels_processed": 0,
        "hotels_ok": 0,
        "hotels_with_failures": 0,
        "total_rows_ingested": 0,
        "total_ota_failures": 0,
    }

    run_id = await supa.start_worker_run(
        worker_name="lighthouse_sync",
        trigger_source=trigger_source,
        batch_index=batch_index,
        batch_count=batch_count,
    )

    final_status = "succeeded"

    try:
        hotels = await supa.fetch_enabled_hotels(batch_index=batch_index, batch_count=batch_count)
        log.info(
            "Batch %d/%d → %d enabled hotels in scope",
            batch_index, batch_count, len(hotels),
        )

        for hotel in hotels:
            try:
                ingested, failures = await sync_hotel(
                    hotel, lighthouse, supa, LIGHTHOUSE_DAYS_AHEAD
                )
                summary["hotels_processed"] += 1
                summary["total_rows_ingested"] += ingested
                summary["total_ota_failures"] += failures
                if failures == 0:
                    summary["hotels_ok"] += 1
                else:
                    summary["hotels_with_failures"] += 1
            except Exception as e:
                log.exception("hotel %s sync crashed", hotel.hotel_id)
                summary["hotels_with_failures"] += 1
                summary["total_ota_failures"] += 1
                await supa.log_failure(hotel.hotel_id, None, None, repr(e))

        if summary["hotels_with_failures"] > 0:
            final_status = "partial"

    except Exception as e:
        log.exception("run_once fatal error")
        final_status = "failed"
        summary["fatal_error"] = repr(e)

    finally:
        summary["finished_at"] = datetime.now(timezone.utc).isoformat()

        await supa.finish_worker_run(
            run_id=run_id,
            status=final_status,
            hotels_processed=summary["hotels_processed"],
            hotels_succeeded=summary["hotels_ok"],
            hotels_failed=summary["hotels_with_failures"],
            rows_ingested=summary["total_rows_ingested"],
            api_failures=summary["total_ota_failures"],
            summary=json.dumps(summary)[:1000],
        )

        await supa.close()
        await lighthouse.close()

    summary["status"] = final_status
    log.info("=== SYNC SUMMARY === %s", json.dumps(summary, indent=2, default=str))
    return summary


async def run_with_scheduler() -> None:
    """Blocking mode: run sync at 06:00, 12:00, 16:00, 22:00 UTC."""
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        log.error("apscheduler not installed; run: pip install apscheduler")
        sys.exit(1)

    scheduler = AsyncIOScheduler(timezone="UTC")
    for hour in (6, 12, 16, 22):
        scheduler.add_job(
            run_once,
            CronTrigger(hour=hour, minute=0),
            id=f"lighthouse-sync-{hour:02d}",
            misfire_grace_time=600,
            coalesce=True,
        )
    scheduler.start()
    log.info("Scheduler started — sync at 06:00, 12:00, 16:00, 22:00 UTC")
    try:
        # Block forever
        await asyncio.Event().wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        scheduler.shutdown()


def main() -> int:
    parser = argparse.ArgumentParser(description="Flowtym RMS — Lighthouse sync worker")
    parser.add_argument("--watch", action="store_true", help="Run scheduler (blocking, legacy)")
    parser.add_argument(
        "--batch-index",
        type=int,
        default=int(os.getenv("BATCH_INDEX", "0")),
        help="Batch index for parallel execution (Tier 2+). Default 0.",
    )
    parser.add_argument(
        "--batch-count",
        type=int,
        default=int(os.getenv("BATCH_COUNT", "1")),
        help="Total number of parallel batches. Default 1 (no sharding).",
    )
    parser.add_argument(
        "--trigger-source",
        type=str,
        default=os.getenv("WORKER_TRIGGER_SOURCE", "cron"),
        choices=["cron", "manual", "api"],
        help="What triggered this run. Recorded in worker_runs.",
    )
    args = parser.parse_args()

    if args.batch_count < 1:
        log.error("--batch-count must be >= 1")
        return 2
    if args.batch_index < 0 or args.batch_index >= args.batch_count:
        log.error("--batch-index must be in [0, batch_count)")
        return 2

    if args.watch:
        # Legacy mode — prefer GitHub Actions cron in production
        asyncio.run(run_with_scheduler())
        return 0

    summary = asyncio.run(
        run_once(
            batch_index=args.batch_index,
            batch_count=args.batch_count,
            trigger_source=args.trigger_source,
        )
    )
    if summary.get("error"):
        log.error(summary["error"])
        return 2
    return 0 if summary.get("total_ota_failures", 0) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

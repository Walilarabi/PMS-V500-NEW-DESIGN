#!/usr/bin/env python3
"""
FLOWTYM RMS — Lighthouse Excel import CLI

One-shot import of a Lighthouse Rate Insight Excel export into Supabase.
Use this for hotel onboarding before API tokens are available, or as a
manual fallback.

Usage:
    export SUPABASE_URL='https://hzrzkvdebaadditvbqis.supabase.co'
    export SUPABASE_SERVICE_ROLE_KEY='eyJ...'

    python -m backend.workers.lighthouse_excel_importer \
        --hotel-id 02b9eb0e-89ef-45de-ba8e-20d4b41c500c \
        --file /path/to/folkestoneopera_bookingdotcom_lowest_los1_2guests.xlsx \
        [--ota bookingdotcom]      # optional, overrides filename detection
        [--dry-run]                # parse only, don't write to Supabase

What this script does:
    1. Parses the Excel file (sheet 'Tarifs') using lighthouse_excel_parser
    2. Creates a row in public.lighthouse_imports with status='processing'
    3. Upserts all parsed rows into public.competitor_rates (chunked)
    4. Marks the import row as 'completed' (or 'failed' on error)

Idempotent: re-running the same file is safe — the UNIQUE constraint
(hotel_id, competitor_id, ota, stay_date, los, shopped_at) deduplicates.
Each run uses now() as shopped_at, so re-imports of the SAME file produce
new rows (which is what we want — multiple shoppings over time).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

# Allow running as `python -m backend.workers.lighthouse_excel_importer`
# or as a standalone script
try:
    from backend.workers.lighthouse_excel_parser import parse_lighthouse_export
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from backend.workers.lighthouse_excel_parser import parse_lighthouse_export


def fail(msg: str, code: int = 2) -> None:
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(code)


def info(msg: str) -> None:
    print(f"  {msg}")


def supabase_request(
    method: str,
    url: str,
    headers: dict,
    json_body: dict | list | None = None,
    timeout: float = 60.0,
) -> httpx.Response:
    """Thin wrapper for Supabase REST calls."""
    with httpx.Client(timeout=timeout) as client:
        return client.request(method, url, headers=headers, json=json_body)


def create_import_row(
    base_url: str,
    headers: dict,
    hotel_id: str,
    filename: str,
    file_size: int,
    meta: dict,
) -> str | None:
    """Insert a row in lighthouse_imports with status='processing'. Returns its id."""
    payload = {
        "hotel_id": hotel_id,
        "filename": filename,
        "file_size_bytes": file_size,
        "ota": meta.get("ota"),
        "rate_type": meta.get("rate_type"),
        "los": meta.get("los"),
        "guests": meta.get("guests"),
        "client_hotel_name": meta.get("client_hotel"),
        "competitor_count": meta.get("competitor_count"),
        "status": "processing",
    }
    r = supabase_request(
        "POST",
        f"{base_url}/rest/v1/lighthouse_imports",
        headers={**headers, "Prefer": "return=representation"},
        json_body=payload,
    )
    if r.status_code not in (200, 201):
        fail(f"Failed to create import row: HTTP {r.status_code} — {r.text[:300]}")
    data = r.json()
    if isinstance(data, list):
        return data[0]["id"]
    return data["id"]


def finish_import_row(
    base_url: str,
    headers: dict,
    import_id: str,
    status: str,
    rows_ingested: int,
    rows_skipped: int,
    error_message: str | None,
    warnings: list,
) -> None:
    """Update the lighthouse_imports row at end of processing."""
    payload = {
        "status": status,
        "rows_ingested": rows_ingested,
        "rows_skipped": rows_skipped,
        "error_message": error_message,
        "warnings": warnings,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    r = supabase_request(
        "PATCH",
        f"{base_url}/rest/v1/lighthouse_imports?id=eq.{import_id}",
        headers=headers,
        json_body=payload,
    )
    if r.status_code not in (200, 204):
        print(
            f"⚠ Could not finalize import row ({r.status_code}): {r.text[:200]}",
            file=sys.stderr,
        )


def upsert_competitor_rates(
    base_url: str,
    headers: dict,
    rows: list[dict],
    hotel_id: str,
    import_id: str,
    chunk_size: int = 500,
) -> int:
    """Bulk-upsert competitor_rates. Returns count of rows successfully sent."""
    if not rows:
        return 0

    # Attach hotel_id + import_id + source to every row
    enriched = []
    for r in rows:
        enriched.append({
            "hotel_id": hotel_id,
            "import_id": import_id,
            "source": "excel_import",
            "competitor_id": r["competitor_id"],
            "competitor_name": r["competitor_name"],
            "ota": r["ota"],
            "stay_date": r["stay_date"],
            "los": r["los"],
            "price": r["price"],
            "currency": r["currency"],
            "available": r["available"],
            "status_text": r["status_text"],
            "shopped_at": r["shopped_at"],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        })

    upsert_url = (
        f"{base_url}/rest/v1/competitor_rates"
        "?on_conflict=hotel_id,competitor_id,ota,stay_date,los,shopped_at"
    )
    upsert_headers = {
        **headers,
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    total_ok = 0
    total_chunks = (len(enriched) + chunk_size - 1) // chunk_size
    for i in range(0, len(enriched), chunk_size):
        chunk = enriched[i : i + chunk_size]
        chunk_num = i // chunk_size + 1
        r = supabase_request("POST", upsert_url, headers=upsert_headers, json_body=chunk)
        if r.status_code in (200, 201, 204):
            total_ok += len(chunk)
            info(f"  chunk {chunk_num}/{total_chunks}: {len(chunk)} rows ✓")
        else:
            print(
                f"⚠ chunk {chunk_num}/{total_chunks} failed: HTTP {r.status_code} — "
                f"{r.text[:300]}",
                file=sys.stderr,
            )
    return total_ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--file", required=True, help="Path to the Lighthouse Excel export (.xlsx)"
    )
    parser.add_argument(
        "--hotel-id", required=True, help="UUID of the hotel in public.hotels"
    )
    parser.add_argument(
        "--ota",
        default=None,
        help="Override OTA detection from filename (e.g. 'bookingdotcom')",
    )
    parser.add_argument(
        "--sheet", default="Tarifs", help="Excel sheet name (default: Tarifs)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Parse only, do not write to Supabase"
    )
    parser.add_argument(
        "--chunk-size", type=int, default=500, help="Upsert chunk size (default 500)"
    )
    args = parser.parse_args()

    # ─── Sanity checks ──────────────────────────────────────────────────
    filepath = Path(args.file).expanduser().resolve()
    if not filepath.exists():
        fail(f"File not found: {filepath}")
    if not filepath.suffix.lower() == ".xlsx":
        fail(f"Expected .xlsx file, got {filepath.suffix}")

    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run:
        if not supabase_url:
            fail("SUPABASE_URL env var not set")
        if not service_key:
            fail("SUPABASE_SERVICE_ROLE_KEY env var not set")
        supabase_url = supabase_url.rstrip("/")

    # ─── Parse ──────────────────────────────────────────────────────────
    print(f"→ Parsing {filepath.name}")
    t0 = time.time()
    result = parse_lighthouse_export(
        str(filepath),
        sheet_name=args.sheet,
        filename_override=filepath.name,
    )
    if not result["ok"]:
        fail(f"Parse failed: {result['error']}")

    rows = result["rows"]
    meta = result["meta"]
    warnings = result["warnings"]
    stats = result["stats"]

    # Apply --ota override if provided
    if args.ota:
        for r in rows:
            r["ota"] = args.ota
        meta["ota"] = args.ota
    elif meta.get("ota") is None:
        fail(
            "Could not detect OTA from filename. Pass --ota explicitly. "
            "Known OTAs: bookingdotcom, expedia, airbnb, agoda, branddotcom"
        )

    info(f"Parsed in {time.time() - t0:.2f}s")
    info(f"Client hotel: {meta['client_hotel']}")
    info(f"OTA: {meta['ota']} | LOS: {meta['los']} | Guests: {meta['guests']}")
    info(
        f"Date range: {meta['date_range_start']} → {meta['date_range_end']} "
        f"({meta['total_dates']} days)"
    )
    info(f"Competitors: {meta['competitor_count']}")
    info(f"Total rows: {len(rows)}")
    info(f"Status distribution: {json.dumps(stats)}")
    if warnings:
        info(f"Warnings: {len(warnings)}")
        for w in warnings[:5]:
            info(f"  • {w}")

    if args.dry_run:
        print()
        print("✓ DRY RUN — no data written.")
        return 0

    # ─── Create import row ──────────────────────────────────────────────
    print()
    print(f"→ Registering import in Supabase (hotel_id={args.hotel_id})")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    import_id = create_import_row(
        supabase_url, headers, args.hotel_id, filepath.name, filepath.stat().st_size, meta
    )
    info(f"Import id: {import_id}")

    # ─── Upsert competitor_rates ────────────────────────────────────────
    print()
    print(f"→ Upserting {len(rows)} rows into competitor_rates")
    t0 = time.time()
    try:
        rows_ok = upsert_competitor_rates(
            supabase_url, headers, rows, args.hotel_id, import_id,
            chunk_size=args.chunk_size,
        )
        elapsed = time.time() - t0
        rows_skipped = len(rows) - rows_ok
        status = "completed" if rows_skipped == 0 else "partial"
        if rows_ok == 0:
            status = "failed"
        info(f"Upserted in {elapsed:.2f}s — {rows_ok}/{len(rows)} rows")
    except Exception as e:
        finish_import_row(
            supabase_url, headers, import_id, "failed",
            0, len(rows), repr(e), warnings,
        )
        fail(f"Upsert crashed: {e}")

    # ─── Finalize import row ────────────────────────────────────────────
    finish_import_row(
        supabase_url, headers, import_id, status,
        rows_ok, rows_skipped,
        None if rows_skipped == 0 else f"{rows_skipped} rows failed to upsert",
        warnings,
    )

    print()
    print(f"✓ Import {status.upper()} — id: {import_id}")
    print(f"  • Rows ingested: {rows_ok}")
    if rows_skipped:
        print(f"  • Rows skipped:  {rows_skipped}")
    print()
    print(
        f"Verify in Supabase SQL Editor:\n"
        f"  SELECT status, rows_ingested, duration_seconds, warnings\n"
        f"  FROM lighthouse_imports WHERE id = '{import_id}';"
    )
    return 0 if status == "completed" else 1


if __name__ == "__main__":
    sys.exit(main())

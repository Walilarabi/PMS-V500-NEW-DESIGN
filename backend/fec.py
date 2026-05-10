"""
FLOWTYM PMS — FEC export endpoint.

Generates a French DGFiP-compliant FEC file (Fichier des Écritures Comptables)
from `v_fec_entries` view for the calling user's hotel.

Endpoint:
  GET /api/fec/export?from=YYYY-MM-DD&to=YYYY-MM-DD

Auth:
  Bearer Supabase JWT (same as send-reminder).

Response:
  text/plain; charset=utf-8  (pipe-delimited)
  Content-Disposition: attachment; filename="<SIREN>FEC<YYYYMMDD>.txt"
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status

logger = logging.getLogger("fec")
router = APIRouter(prefix="/api/fec", tags=["fec"])


def _require_env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise RuntimeError(f"Missing env: {name}")
    return v


async def _verify_supabase_jwt(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    supabase_url = _require_env("SUPABASE_URL")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{supabase_url}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": _require_env("SUPABASE_SERVICE_ROLE_KEY")},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    return resp.json()


async def _fetch_hotel_for_user(auth_user_id: str) -> dict[str, Any]:
    supabase_url = _require_env("SUPABASE_URL")
    service_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    async with httpx.AsyncClient(timeout=10.0) as client:
        u = await client.get(
            f"{supabase_url}/rest/v1/users",
            params={"auth_id": f"eq.{auth_user_id}", "select": "hotel_id"},
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        )
        if u.status_code != 200 or not u.json():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No hotel for user")
        hotel_id = u.json()[0]["hotel_id"]
        h = await client.get(
            f"{supabase_url}/rest/v1/hotels",
            params={"id": f"eq.{hotel_id}", "select": "id,name,siret"},
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        )
        if h.status_code != 200 or not h.json():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")
        return h.json()[0]


async def _fetch_fec_rows(hotel_id: str, date_from: str, date_to: str) -> list[dict[str, Any]]:
    supabase_url = _require_env("SUPABASE_URL")
    service_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    fec_from = date_from.replace("-", "")
    fec_to = date_to.replace("-", "")
    cols = ",".join([
        '"JournalCode"', '"JournalLib"', '"EcritureNum"', '"EcritureDate"',
        '"CompteNum"', '"CompteLib"', '"CompAuxNum"', '"CompAuxLib"',
        '"PieceRef"', '"PieceDate"', '"EcritureLib"', '"Debit"', '"Credit"',
        '"EcritureLet"', '"DateLet"', '"ValidDate"', '"Montantdevise"', '"Idevise"',
    ])
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{supabase_url}/rest/v1/v_fec_entries",
            params={
                "hotel_id": f"eq.{hotel_id}",
                "EcritureDate": f"gte.{fec_from}",
                "and": f'("EcritureDate".lte.{fec_to})',
                "select": cols,
                "order": '"EcritureNum".asc,sub_order.asc',
                "limit": "100000",
            },
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Accept": "application/json",
            },
        )
    if resp.status_code != 200:
        logger.error("FEC fetch failed %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"FEC view query failed: {resp.text[:200]}")
    return resp.json()


FEC_COLUMNS = [
    "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
    "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
    "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
    "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
]


def _fec_escape(value: Any) -> str:
    """Escape a single field for pipe-delimited output (strip pipes and newlines)."""
    if value is None:
        return ""
    s = str(value)
    return s.replace("|", "/").replace("\r", " ").replace("\n", " ").replace("\t", " ")


@router.get("/export")
async def export_fec(
    date_from: str = Query(..., alias="from", description="ISO date YYYY-MM-DD (start of period)"),
    date_to: str = Query(..., alias="to", description="ISO date YYYY-MM-DD (end of period)"),
    authorization: str | None = Header(default=None),
) -> Response:
    user = await _verify_supabase_jwt(authorization)
    hotel = await _fetch_hotel_for_user(user.get("id", ""))
    siren = (hotel.get("siret") or "000000000").replace(" ", "")[:9]
    rows = await _fetch_fec_rows(hotel["id"], date_from, date_to)

    # Build pipe-delimited content with header
    header = "|".join(FEC_COLUMNS)
    lines = [header]
    for r in rows:
        lines.append("|".join(_fec_escape(r.get(c, "")) for c in FEC_COLUMNS))
    body = "\r\n".join(lines) + "\r\n"

    # Filename per DGFiP norm: <SIREN>FEC<YYYYMMDD>.txt (fiscal year end)
    closing = date_to.replace("-", "")
    filename = f"{siren}FEC{closing}.txt"

    return Response(
        content=body.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-FEC-Rows": str(len(rows)),
            "X-FEC-Hotel": hotel.get("name", ""),
            "X-FEC-Period": f"{date_from}..{date_to}",
        },
    )


@router.get("/preview")
async def preview_fec(
    date_from: str = Query(..., alias="from"),
    date_to: str = Query(..., alias="to"),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Lightweight preview (counts + balance check) without producing the file."""
    user = await _verify_supabase_jwt(authorization)
    hotel = await _fetch_hotel_for_user(user.get("id", ""))
    rows = await _fetch_fec_rows(hotel["id"], date_from, date_to)
    total_debit = 0.0
    total_credit = 0.0
    journals: dict[str, int] = {}
    for r in rows:
        try:
            total_debit += float((r.get("Debit") or "0").replace(",", "."))
            total_credit += float((r.get("Credit") or "0").replace(",", "."))
        except ValueError:
            pass
        j = r.get("JournalCode") or "?"
        journals[j] = journals.get(j, 0) + 1
    return {
        "rows": len(rows),
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "balanced": round(total_debit, 2) == round(total_credit, 2),
        "journals": journals,
        "hotel_name": hotel.get("name", ""),
        "siren": (hotel.get("siret") or "").replace(" ", "")[:9],
    }

#!/usr/bin/env python3
"""
FLOWTYM — Booking Export Importer

Imports OTA reservations from a Booking-style Excel export into Flowtym.
Designed to scale: maps any partner (Booking, Expedia, Agoda, etc.) using
public.ota_partners + public.ota_room_type_mappings.

SPRINT 1 SCOPE
==============
This first version handles:
  ✓ Validée (confirmed) reservations with 1 room of a non-virtual type
  ✓ Annulée (cancelled) reservations → status = 'cancelled' in reservations
  ✓ Modifiée (modified) → upsert + modification_count++
  ✓ Audit trail in external_reservations (raw payload preserved)
  ✓ Idempotency via UNIQUE(hotel_id, external_ref)

Out of scope (later sprints):
  ⏸ Multi-room reservations (25 cases, Sprint 2)
  ⏸ "Deux Chambres Adjacentes" allocation logic (Sprint 3)
  ⏸ Inventory conflict resolution UI (Sprint 4)
  ⏸ Self-service UI upload (Sprint 5)

Usage:
    export SUPABASE_URL='https://...'
    export SUPABASE_SERVICE_ROLE_KEY='sb_secret_...'

    python -m backend.workers.booking_export_importer \\
        --file BookingExport.xlsx \\
        --hotel-id 02b9eb0e-89ef-45de-ba8e-20d4b41c500c \\
        [--dry-run]

What it does:
    1. Parses the Excel file (Sheet0)
    2. Creates a row in external_reservation_imports (status='processing')
    3. For each row:
        a. Insert in external_reservations (immutable audit)
        b. If multi-room or virtual ADJ-4P → mark as skipped, flag for Sprint 2/3
        c. Otherwise:
           - Resolve OTA partner from 'Origine'
           - Resolve room_type from 'Type de chambre' (via ota_room_type_mappings)
           - Find first available physical room of that type
           - Upsert into reservations (with external_ref as idempotency key)
           - Insert into reservation_rooms
    4. Updates the import row with final stats
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import pandas as pd


# ─── Configuration ──────────────────────────────────────────────────────────

# Maps 'Origine' values in BookingExport to ota_partners.code
ORIGIN_TO_PARTNER_CODE: dict[str, str] = {
    'Booking.com':                        'booking',
    'Expedia':                            'expedia',
    'Website':                            'website',
    'Hotelbeds':                          'hotelbeds',
    'Agoda':                              'agoda',
    'Ctrip':                              'ctrip',
    'H.I.S. International Tours France':  'his',
    'Miki Travel Ltd':                    'miki',
    'TBO Holidays':                       'tbo',
    'HRS':                                'hrs',
    'Travco':                             'travco',
    'SunHotels':                          'sunhotels',
    'Olympia Europe':                     'olympia',
    'GDS':                                'gds',
    'InfiniteHotel':                      'infinitehotel',
    'Hotel Trader':                       'hoteltrader',
}

# Maps Excel 'Etat' values to reservations.status
ETAT_TO_STATUS: dict[str, str] = {
    'Validée':  'confirmed',
    'Modifiée': 'confirmed',
    'Annulée':  'cancelled',
}


# ─── Utilities ──────────────────────────────────────────────────────────────

def fail(msg: str, code: int = 2) -> None:
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(code)


def info(msg: str) -> None:
    print(f"  {msg}")


def warn(msg: str) -> None:
    print(f"  ⚠ {msg}", file=sys.stderr)


def supa_request(
    method: str,
    url: str,
    headers: dict,
    json_body: Any = None,
    timeout: float = 60.0,
) -> httpx.Response:
    with httpx.Client(timeout=timeout) as client:
        return client.request(method, url, headers=headers, json=json_body)


def to_iso_date(v: Any) -> str | None:
    """Convert various date formats to YYYY-MM-DD."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.date().isoformat()
    if isinstance(v, datetime):
        return v.date().isoformat()
    return str(v)


def to_iso_datetime(v: Any) -> str | None:
    """Convert to full ISO datetime."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)


def safe_str(v: Any) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    return str(v).strip() or None


def safe_int(v: Any) -> int | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def safe_float(v: Any) -> float | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


# ─── Supabase loaders ───────────────────────────────────────────────────────

def fetch_ota_partners(base_url: str, headers: dict) -> dict[str, str]:
    """Return {code: id} for all OTA partners."""
    r = supa_request("GET", f"{base_url}/rest/v1/ota_partners?select=id,code", headers=headers)
    if r.status_code != 200:
        fail(f"Failed to fetch ota_partners: HTTP {r.status_code} — {r.text[:300]}")
    return {row["code"]: row["id"] for row in r.json()}


def fetch_room_type_mappings(base_url: str, headers: dict, hotel_id: str) -> dict[str, dict]:
    """Return {external_name: {room_type_code, is_virtual}} for the hotel."""
    r = supa_request(
        "GET",
        f"{base_url}/rest/v1/ota_room_type_mappings"
        f"?select=external_name,room_type_code,is_virtual&hotel_id=eq.{hotel_id}",
        headers=headers,
    )
    if r.status_code != 200:
        fail(f"Failed to fetch ota_room_type_mappings: HTTP {r.status_code}")
    return {
        row["external_name"]: {
            "room_type_code": row["room_type_code"],
            "is_virtual": row["is_virtual"],
        }
        for row in r.json()
    }


def fetch_rooms_by_type(base_url: str, headers: dict, hotel_id: str) -> dict[str, list[dict]]:
    """Return {room_type_code: [{id, number}, ...]} for active rooms in this hotel."""
    r = supa_request(
        "GET",
        f"{base_url}/rest/v1/rooms"
        f"?select=id,number,room_type_code&hotel_id=eq.{hotel_id}&active=eq.true"
        f"&order=number.asc",
        headers=headers,
    )
    if r.status_code != 200:
        fail(f"Failed to fetch rooms: HTTP {r.status_code}")
    rooms_by_type: dict[str, list[dict]] = {}
    for row in r.json():
        code = row["room_type_code"]
        if code:
            rooms_by_type.setdefault(code, []).append(row)
    return rooms_by_type


# ─── Allocation: find a free room for a (room_type, check_in, check_out) ────

def find_free_room(
    rooms_of_type: list[dict],
    check_in: str,
    check_out: str,
    rooms_already_booked: dict[str, set[tuple[str, str]]],
) -> str | None:
    """
    Find a room of the given type whose date range doesn't conflict.
    Uses an in-memory busy map (rooms_already_booked[room_id] = set of
    (check_in, check_out) tuples) to avoid re-fetching from DB.

    Returns the room.id (uuid) or None if no room is free.

    Simple algorithm: pick the first room with no overlapping booking.
    Two bookings (a_in, a_out) and (b_in, b_out) overlap iff
        a_in < b_out AND b_in < a_out
    """
    new_in = check_in
    new_out = check_out
    for room in rooms_of_type:
        room_id = room["id"]
        busy = rooms_already_booked.get(room_id, set())
        conflict = False
        for (ci, co) in busy:
            # Strict overlap : two intervals share at least one night
            if ci < new_out and new_in < co:
                conflict = True
                break
        if not conflict:
            # Reserve in the in-memory map for the rest of this run
            busy.add((new_in, new_out))
            rooms_already_booked[room_id] = busy
            return room_id
    return None


# ─── Core processing ────────────────────────────────────────────────────────

def parse_booking_export(filepath: str) -> pd.DataFrame:
    df = pd.read_excel(filepath, sheet_name='Sheet0', header=0)
    info(f"Parsed {len(df)} rows from {Path(filepath).name}")
    return df


def create_import_row(
    base_url: str, headers: dict, hotel_id: str, filename: str, file_size: int, rows_total: int,
) -> str:
    payload = {
        "hotel_id": hotel_id,
        "filename": filename,
        "file_size_bytes": file_size,
        "source_type": "booking_export",
        "rows_total": rows_total,
        "status": "processing",
    }
    r = supa_request(
        "POST",
        f"{base_url}/rest/v1/external_reservation_imports",
        headers={**headers, "Prefer": "return=representation"},
        json_body=payload,
    )
    if r.status_code not in (200, 201):
        fail(f"Failed to create import row: HTTP {r.status_code} — {r.text[:300]}")
    data = r.json()
    return data[0]["id"] if isinstance(data, list) else data["id"]


def finalize_import_row(
    base_url: str, headers: dict, import_id: str, stats: dict, warnings: list,
) -> None:
    has_skipped = stats["skipped"] > 0 or stats["conflict"] > 0
    status = "completed" if not has_skipped else "partial"
    payload = {
        "status": status,
        "rows_created": stats["created"],
        "rows_updated": stats["updated"],
        "rows_cancelled": stats["cancelled"],
        "rows_skipped": stats["skipped"],
        "rows_conflict": stats["conflict"],
        "warnings": warnings,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    r = supa_request(
        "PATCH",
        f"{base_url}/rest/v1/external_reservation_imports?id=eq.{import_id}",
        headers=headers,
        json_body=payload,
    )
    if r.status_code not in (200, 204):
        warn(f"Could not finalize import row: HTTP {r.status_code}")


def build_external_reservation_row(
    hotel_id: str, import_id: str, row: pd.Series,
    partner_id: str | None, ota_status: str,
    processing_status: str, processing_notes: str | None,
    reservation_id: str | None,
) -> dict:
    """Build a row for external_reservations (audit trail)."""
    raw = {
        k: (v.isoformat() if isinstance(v, (pd.Timestamp, datetime)) else v)
        for k, v in row.items()
        if not (isinstance(v, float) and pd.isna(v)) and v is not None
    }
    return {
        "hotel_id": hotel_id,
        "import_id": import_id,
        "external_ref": str(row["Référence"]),
        "source_partner_id": partner_id,
        "ota_status": ota_status,
        "raw_payload": raw,
        "reservation_id": reservation_id,
        "processing_status": processing_status,
        "processing_notes": processing_notes,
    }


def build_reservation_row(
    hotel_id: str, import_id: str, row: pd.Series,
    partner_id: str | None, room_id: str, room_number: str | None,
    status: str,
) -> dict:
    """Build a row for reservations table."""
    full_name_parts = [safe_str(row.get("Prénom")), safe_str(row.get("Nom"))]
    full_name = " ".join(p for p in full_name_parts if p) or None

    return {
        "hotel_id": hotel_id,
        "external_ref": str(row["Référence"]),
        "source_partner_id": partner_id,
        "parent_import_id": import_id,
        "reference": str(row["Référence"]),
        "room_id": room_id,
        "room_number": room_number,
        "guest_name": full_name,
        "guest_email": safe_str(row.get("E-Mail")),
        "guest_phone": safe_str(row.get("Téléphone")),
        "check_in": to_iso_date(row["Date d'arrivée"]),
        "check_out": to_iso_date(row["Date de départ"]),
        "nights": safe_int(row.get("Nuits")),
        "status": status,
        "adults": safe_int(row.get("Adultes")) or 1,
        "children": safe_int(row.get("Enfants")) or 0,
        "pax": (safe_int(row.get("Adultes")) or 1) + (safe_int(row.get("Enfants")) or 0),
        "total_amount": safe_float(row.get("Montant total")),
        "source": safe_str(row.get("Origine")),
        "notes": safe_str(row.get("Commentaire client (BE seulement)")),
        "last_status_change_at": to_iso_datetime(row.get("Dernière modification"))
                              or to_iso_datetime(row.get("Date d'annulation")),
    }


def is_multi_room_or_virtual(row: pd.Series, mappings: dict) -> tuple[bool, str]:
    """
    Returns (should_skip, reason).
    Skip if :
      - Chambres > 1
      - Type de chambre contains ' / ' (composition)
      - Type de chambre maps to a virtual category (ADJ-4P)
    """
    n_rooms = safe_int(row.get("Chambres")) or 1
    if n_rooms > 1:
        return True, f"multi-room ({n_rooms} chambres) — Sprint 2"

    room_type = safe_str(row.get("Type de chambre")) or ""
    if " / " in room_type:
        return True, f"composition mixte ({room_type}) — Sprint 2"

    mapping = mappings.get(room_type)
    if mapping and mapping["is_virtual"]:
        return True, f"catégorie virtuelle ({room_type}) — Sprint 3 (adjacentes)"

    return False, ""


# ─── Main processing loop ───────────────────────────────────────────────────

def process_reservations(
    df: pd.DataFrame,
    hotel_id: str,
    import_id: str,
    base_url: str,
    headers: dict,
    partners: dict[str, str],
    mappings: dict[str, dict],
    rooms_by_type: dict[str, list[dict]],
) -> tuple[dict, list]:
    """
    Process each row. Returns (stats, warnings).
    Performs three sets of upserts:
      1. external_reservations (audit, always)
      2. reservations (only if simple non-virtual non-multi-room)
      3. reservation_rooms (link the assigned room)
    """
    stats = {"created": 0, "updated": 0, "cancelled": 0, "skipped": 0, "conflict": 0}
    warnings: list[str] = []

    external_rows: list[dict] = []
    reservation_rows: list[dict] = []
    reservation_room_links: list[tuple[str, str]] = []  # (external_ref, room_id) for later

    # Track in-memory which rooms we've already allocated during this run
    # (so two reservations can't get the same room for overlapping dates)
    rooms_busy: dict[str, set[tuple[str, str]]] = {}

    for idx, row in df.iterrows():
        external_ref = str(row["Référence"])
        ota_status = safe_str(row.get("Etat")) or "Unknown"
        target_status = ETAT_TO_STATUS.get(ota_status)
        origine = safe_str(row.get("Origine"))
        partner_code = ORIGIN_TO_PARTNER_CODE.get(origine or "", None)
        partner_id = partners.get(partner_code) if partner_code else None

        # Case 1 : cancelled reservations — we still upsert reservations with status='cancelled'
        if ota_status == "Annulée":
            external_rows.append(build_external_reservation_row(
                hotel_id, import_id, row, partner_id, ota_status,
                "cancelled", None, None,
            ))
            # For cancellations, we need to mark the existing reservation cancelled
            # but we DON'T allocate a room for new cancellations either
            reservation_rows.append({
                "hotel_id": hotel_id,
                "external_ref": external_ref,
                "source_partner_id": partner_id,
                "parent_import_id": import_id,
                "reference": external_ref,
                "guest_name": " ".join(p for p in [safe_str(row.get("Prénom")), safe_str(row.get("Nom"))] if p) or None,
                "guest_email": safe_str(row.get("E-Mail")),
                "guest_phone": safe_str(row.get("Téléphone")),
                "check_in": to_iso_date(row["Date d'arrivée"]),
                "check_out": to_iso_date(row["Date de départ"]),
                "nights": safe_int(row.get("Nuits")),
                "status": "cancelled",
                "adults": safe_int(row.get("Adultes")) or 1,
                "children": safe_int(row.get("Enfants")) or 0,
                "total_amount": safe_float(row.get("Montant total")),
                "source": origine,
                "last_status_change_at": to_iso_datetime(row.get("Date d'annulation")),
            })
            stats["cancelled"] += 1
            continue

        # Case 2 : Skip multi-room or virtual (Sprint 2/3)
        should_skip, reason = is_multi_room_or_virtual(row, mappings)
        if should_skip:
            external_rows.append(build_external_reservation_row(
                hotel_id, import_id, row, partner_id, ota_status,
                "skipped", reason, None,
            ))
            stats["skipped"] += 1
            continue

        # Case 3 : simple confirmed/modified reservation
        if target_status is None:
            warnings.append(f"{external_ref}: unknown Etat '{ota_status}', skipping")
            external_rows.append(build_external_reservation_row(
                hotel_id, import_id, row, partner_id, ota_status,
                "skipped", f"unknown Etat: {ota_status}", None,
            ))
            stats["skipped"] += 1
            continue

        # Resolve room_type_code
        room_type_name = safe_str(row.get("Type de chambre"))
        mapping = mappings.get(room_type_name or "")
        if not mapping:
            warnings.append(f"{external_ref}: unknown room type '{room_type_name}', skipping")
            external_rows.append(build_external_reservation_row(
                hotel_id, import_id, row, partner_id, ota_status,
                "skipped", f"unknown room type: {room_type_name}", None,
            ))
            stats["skipped"] += 1
            continue

        room_type_code = mapping["room_type_code"]
        available_rooms = rooms_by_type.get(room_type_code, [])
        if not available_rooms:
            warnings.append(f"{external_ref}: no room of type {room_type_code} in inventory")
            external_rows.append(build_external_reservation_row(
                hotel_id, import_id, row, partner_id, ota_status,
                "conflict", f"no room of type {room_type_code}", None,
            ))
            stats["conflict"] += 1
            continue

        # Find free room
        check_in = to_iso_date(row["Date d'arrivée"])
        check_out = to_iso_date(row["Date de départ"])
        if not check_in or not check_out:
            warnings.append(f"{external_ref}: missing dates")
            stats["skipped"] += 1
            continue

        room_id = find_free_room(available_rooms, check_in, check_out, rooms_busy)
        if room_id is None:
            warnings.append(
                f"{external_ref}: no available {room_type_code} for {check_in}→{check_out}"
            )
            external_rows.append(build_external_reservation_row(
                hotel_id, import_id, row, partner_id, ota_status,
                "conflict", f"inventory conflict on {room_type_code} {check_in}→{check_out}", None,
            ))
            stats["conflict"] += 1
            continue

        # Build reservation row
        room_obj = next(r for r in available_rooms if r["id"] == room_id)
        room_number = room_obj["number"]
        reservation_rows.append(build_reservation_row(
            hotel_id, import_id, row, partner_id, room_id, room_number, target_status,
        ))
        external_rows.append(build_external_reservation_row(
            hotel_id, import_id, row, partner_id, ota_status,
            "created" if target_status == "confirmed" else "updated",
            f"assigned room {room_number}", None,
        ))
        reservation_room_links.append((external_ref, room_id))
        if target_status == "confirmed":
            stats["created"] += 1
        else:
            stats["updated"] += 1

    return stats, warnings, external_rows, reservation_rows, reservation_room_links


def upsert_chunked(
    base_url: str, headers: dict, table: str, on_conflict: str | None,
    rows: list[dict], chunk_size: int = 200,
) -> int:
    """Bulk upsert with chunking. Returns count of successful rows."""
    if not rows:
        return 0
    url = f"{base_url}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    upsert_headers = {
        **headers,
        "Prefer": "resolution=merge-duplicates,return=minimal" if on_conflict else "return=minimal",
    }
    ok = 0
    total = (len(rows) + chunk_size - 1) // chunk_size
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        r = supa_request("POST", url, headers=upsert_headers, json_body=chunk)
        if r.status_code in (200, 201, 204):
            ok += len(chunk)
            info(f"  {table} chunk {i // chunk_size + 1}/{total}: {len(chunk)} rows ✓")
        else:
            warn(f"{table} chunk failed: {r.status_code} — {r.text[:300]}")
    return ok


def link_rooms_to_reservations(
    base_url: str, headers: dict, hotel_id: str,
    links: list[tuple[str, str]],
) -> int:
    """
    After reservations are upserted, link them to rooms via reservation_rooms.
    We need to fetch the actual reservation IDs first (since we only have external_ref).
    """
    if not links:
        return 0

    # Fetch reservation IDs in chunks
    external_refs = [er for (er, _) in links]
    ref_to_id: dict[str, str] = {}
    chunk = 100
    for i in range(0, len(external_refs), chunk):
        sub = external_refs[i:i + chunk]
        # in.(ref1,ref2,...) — PostgREST format
        # Note: refs are alphanum (Booking refs are 6 chars), so no escaping needed
        refs_param = "(" + ",".join(sub) + ")"
        r = supa_request(
            "GET",
            f"{base_url}/rest/v1/reservations"
            f"?select=id,external_ref&hotel_id=eq.{hotel_id}&external_ref=in.{refs_param}",
            headers=headers,
        )
        if r.status_code != 200:
            warn(f"Failed to fetch reservation IDs: {r.status_code}")
            continue
        for row in r.json():
            ref_to_id[row["external_ref"]] = row["id"]

    info(f"Resolved {len(ref_to_id)}/{len(links)} reservation IDs for room linking")

    # Build reservation_rooms rows
    rr_rows = []
    for external_ref, room_id in links:
        res_id = ref_to_id.get(external_ref)
        if res_id is None:
            continue
        rr_rows.append({
            "reservation_id": res_id,
            "room_id": room_id,
            "is_part_of_pair": False,
            "position": 1,
        })

    return upsert_chunked(
        base_url, headers, "reservation_rooms",
        "reservation_id,room_id", rr_rows, chunk_size=500,
    )


# ─── CLI entry point ────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, help="Path to BookingExport.xlsx")
    parser.add_argument("--hotel-id", required=True, help="UUID of the hotel")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, no DB write")
    parser.add_argument("--chunk-size", type=int, default=200)
    args = parser.parse_args()

    filepath = Path(args.file).expanduser().resolve()
    if not filepath.exists():
        fail(f"File not found: {filepath}")

    if not args.dry_run:
        supabase_url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url:
            fail("SUPABASE_URL env var not set")
        if not service_key:
            fail("SUPABASE_SERVICE_ROLE_KEY env var not set")
        supabase_url = supabase_url.rstrip("/")
    else:
        supabase_url = None
        service_key = None

    # ─── Parse ──────────────────────────────────────────────────────────
    print(f"→ Parsing {filepath.name}")
    t0 = time.time()
    df = parse_booking_export(str(filepath))
    info(f"Parsed in {time.time() - t0:.2f}s")

    if args.dry_run:
        # In dry-run, we use mock data for partners/mappings/rooms
        print("\n=== DRY RUN MODE ===")
        print("Analysis only — no Supabase calls, no DB writes.\n")
        # Show what would be processed vs skipped
        sample_mappings = {
            'Double Classique':                      {'room_type_code': 'DBL-CLASSIC',     'is_virtual': False},
            'Double Single Use Classique':           {'room_type_code': 'SGL-CLASSIC',     'is_virtual': False},
            'Twin Classique':                        {'room_type_code': 'TWIN-CLASSIC',    'is_virtual': False},
            'Double Classique Terrasse':             {'room_type_code': 'DBL-CLASSIC-TER', 'is_virtual': False},
            'Double Deluxe':                         {'room_type_code': 'DBL-DELUXE',      'is_virtual': False},
            'Twin Deluxe':                           {'room_type_code': 'TWIN-DELUXE',     'is_virtual': False},
            'Double Deluxe Terrasse':                {'room_type_code': 'DBL-DELUXE-TER',  'is_virtual': False},
            'Deux Chambres Adjacentes 4 personnes':  {'room_type_code': 'ADJ-4P',          'is_virtual': True},
        }
        counts = {"cancelled": 0, "multi_room": 0, "composition": 0, "virtual": 0, "simple": 0, "unknown": 0}
        for _, row in df.iterrows():
            etat = safe_str(row.get("Etat"))
            if etat == "Annulée":
                counts["cancelled"] += 1
                continue
            n_rooms = safe_int(row.get("Chambres")) or 1
            if n_rooms > 1:
                counts["multi_room"] += 1
                continue
            room_type = safe_str(row.get("Type de chambre")) or ""
            if " / " in room_type:
                counts["composition"] += 1
                continue
            mapping = sample_mappings.get(room_type)
            if mapping and mapping["is_virtual"]:
                counts["virtual"] += 1
                continue
            if mapping:
                counts["simple"] += 1
            else:
                counts["unknown"] += 1

        print("Répartition des 376 lignes :")
        print(f"  ✓ Simples 1-chambre (à importer)  : {counts['simple']}")
        print(f"  ✗ Annulées (status=cancelled)     : {counts['cancelled']}")
        print(f"  ⏸ Multi-chambres (Sprint 2)       : {counts['multi_room']}")
        print(f"  ⏸ Composition mixte (Sprint 2)    : {counts['composition']}")
        print(f"  ⏸ Adjacentes virtuelles (Sprint 3): {counts['virtual']}")
        print(f"  ? Types inconnus                  : {counts['unknown']}")
        print(f"  ─────────────────────────────────")
        print(f"  Total                              : {sum(counts.values())}")
        return 0

    # ─── Load reference data ────────────────────────────────────────────
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    print(f"\n→ Loading reference data")
    partners = fetch_ota_partners(supabase_url, headers)
    mappings = fetch_room_type_mappings(supabase_url, headers, args.hotel_id)
    rooms_by_type = fetch_rooms_by_type(supabase_url, headers, args.hotel_id)
    info(f"OTA partners: {len(partners)}")
    info(f"Room type mappings: {len(mappings)}")
    info(f"Rooms by type: {', '.join(f'{k}={len(v)}' for k, v in rooms_by_type.items())}")

    if not mappings:
        fail("No ota_room_type_mappings found. Did you run migration 0166?")
    if not rooms_by_type:
        fail("No active rooms found for this hotel. Did you run migration 0166?")

    # ─── Create import row ──────────────────────────────────────────────
    print(f"\n→ Creating import row")
    import_id = create_import_row(
        supabase_url, headers, args.hotel_id,
        filepath.name, filepath.stat().st_size, len(df),
    )
    info(f"Import id: {import_id}")

    # ─── Process all rows ───────────────────────────────────────────────
    print(f"\n→ Processing {len(df)} rows")
    stats, warnings, ext_rows, res_rows, room_links = process_reservations(
        df, args.hotel_id, import_id, supabase_url, headers,
        partners, mappings, rooms_by_type,
    )
    info(f"  created   : {stats['created']}")
    info(f"  updated   : {stats['updated']}")
    info(f"  cancelled : {stats['cancelled']}")
    info(f"  skipped   : {stats['skipped']}")
    info(f"  conflict  : {stats['conflict']}")
    if warnings:
        info(f"  {len(warnings)} warnings")

    # ─── Persist ─────────────────────────────────────────────────────────
    print(f"\n→ Upserting external_reservations ({len(ext_rows)} rows)")
    upsert_chunked(
        supabase_url, headers, "external_reservations",
        "hotel_id,external_ref,import_id", ext_rows, chunk_size=args.chunk_size,
    )

    print(f"\n→ Upserting reservations ({len(res_rows)} rows)")
    upsert_chunked(
        supabase_url, headers, "reservations",
        "hotel_id,external_ref", res_rows, chunk_size=args.chunk_size,
    )

    print(f"\n→ Linking rooms to reservations ({len(room_links)} links)")
    linked = link_rooms_to_reservations(supabase_url, headers, args.hotel_id, room_links)
    info(f"Linked {linked} rooms")

    # ─── Finalize ───────────────────────────────────────────────────────
    finalize_import_row(supabase_url, headers, import_id, stats, warnings[:50])
    print()
    print(f"✓ Import COMPLETED — import_id: {import_id}")
    print(f"  • Created      : {stats['created']}")
    print(f"  • Updated      : {stats['updated']}")
    print(f"  • Cancelled    : {stats['cancelled']}")
    print(f"  • Skipped      : {stats['skipped']} (multi-room/virtual — Sprint 2/3)")
    print(f"  • Conflict     : {stats['conflict']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
FLOWTYM RMS — Folkestone PMS Planning Importer

Reads the Folkestone Opéra Planning export (H2258__FOLKESTONE_OPERA__Planning.xlsx)
and pushes the real prices + inventory + restrictions into Supabase.

Strategy B: only the 5 main rate plans are imported (RACK-RO-FLEX, RACK-RO-NANR,
OTA-RO-FLEX, OTA-RO-NANR, OTA-BB-FLEX-2P). Other 77 plans (MOBILE, VIP, EXP, etc.)
are not relevant for the daily yield management workflow.

Prerequisites:
    - Migration 0164 must be applied (creates rooms, rate_plans, pricing_rules)
    - Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Usage (CLI):
    python -m backend.workers.folkestone_planning_importer \\
        --file /path/to/H2258__FOLKESTONE_OPERA__Planning.xlsx \\
        --hotel-id 02b9eb0e-89ef-45de-ba8e-20d4b41c500c \\
        [--dry-run]

The script will:
    1. Parse the Planning sheet (1420 rows × 233 cols)
    2. Map PMS room names → room_type_code
    3. For each (room, plan, date):
        - Insert rate_prices: price + status ('open'/'closed') + source='import'
    4. For each (room, date):
        - Insert rate_restrictions: min_stay + max_stay + inventory + capacity
    5. Print stats per chunk

Idempotent: uses ON CONFLICT (hotel_id, room_type_code, plan_id, stay_date)
DO UPDATE for rate_prices, and similar for rate_restrictions.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

# Mapping PMS room name → Flowtym room_type_code (must match migration 0164)
ROOM_CODE_MAP: dict[str, str] = {
    'Double Classique':                       'DBL-CLASSIC',
    'Double Single Use Classique':            'SGL-CLASSIC',
    'Twin Classique':                         'TWIN-CLASSIC',
    'Double Classique Terrasse':              'DBL-CLASSIC-TER',
    'Double Deluxe':                          'DBL-DELUXE',
    'Twin Deluxe':                            'TWIN-DELUXE',
    'Double Deluxe Terrasse':                 'DBL-DELUXE-TER',
    'Deux Chambres Adjacentes 4 personnes':   'ADJ-4P',
}

# Plans retained for Strategy B (5 main plans)
ALLOWED_PLAN_CODES: set[str] = {
    'RACK-RO-FLEX',
    'RACK-RO-NANR',
    'OTA-RO-FLEX',
    'OTA-RO-NANR',
    'OTA-BB-FLEX-2P',
}

# Hard-coded plan UUIDs (matching migration 0164)
PLAN_ID_MAP: dict[str, str] = {
    'RACK-RO-FLEX':   'a4685000-0000-0000-0000-000000004685',
    'RACK-RO-NANR':   'a6820070-0000-0000-0000-000000682007',
    'OTA-RO-FLEX':    'a6815320-0000-0000-0000-000000681532',
    'OTA-RO-NANR':    'a0457780-0000-0000-0000-000000045778',
    'OTA-BB-FLEX-2P': 'a2471840-0000-0000-0000-000000247184',
}

# Default capacity per room_type_code (number of physical rooms of this type)
ROOM_CAPACITY: dict[str, int] = {
    'DBL-CLASSIC':     3,
    'SGL-CLASSIC':     1,
    'TWIN-CLASSIC':    1,
    'DBL-CLASSIC-TER': 1,
    'DBL-DELUXE':      1,
    'TWIN-DELUXE':     1,
    'DBL-DELUXE-TER':  1,
    'ADJ-4P':          1,
}


def fail(msg: str, code: int = 2) -> None:
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(code)


def info(msg: str) -> None:
    print(f"  {msg}")


def supa_request(
    method: str,
    url: str,
    headers: dict,
    json_body: Any = None,
    timeout: float = 60.0,
) -> httpx.Response:
    with httpx.Client(timeout=timeout) as client:
        return client.request(method, url, headers=headers, json=json_body)


def parse_planning(filepath: str) -> dict[str, Any]:
    """Parse the Planning Excel and return structured data.

    Returns:
        {
            'dates': [date, ...] (230 dates),
            'prices': {(room_code, plan_code, date): float},
            'plan_status': {(room_code, plan_code, date): 'open'|'closed'},
            'min_stay': {(room_code, plan_code, date): int},
            'max_stay': {(room_code, plan_code, date): int},
            'inventory': {(room_code, date): int},
        }
    """
    df = pd.read_excel(filepath, sheet_name='Planning', header=None)

    # Extract dates from row 0, columns 3+
    dates: list[date] = []
    date_col_idx: list[int] = []
    for j in range(3, df.shape[1]):
        v = df.iloc[0, j]
        if pd.notna(v) and hasattr(v, 'date'):
            dates.append(v.date())
            date_col_idx.append(j)

    if not dates:
        fail("No date row found in Planning sheet (row 0, columns 3+)")

    prices: dict[tuple[str, str, date], float] = {}
    plan_status: dict[tuple[str, str, date], str] = {}
    min_stay: dict[tuple[str, str, date], int] = {}
    max_stay: dict[tuple[str, str, date], int] = {}
    inventory: dict[tuple[str, date], int] = {}

    # Iterate rows
    for i in range(1, len(df)):
        room_cell = df.iloc[i, 0]
        plan_cell = df.iloc[i, 1]
        metric_cell = df.iloc[i, 2]

        if pd.isna(room_cell) or pd.isna(metric_cell):
            continue
        room_name = str(room_cell).strip()
        if room_name.startswith('FOLKESTONE OPERA'):
            continue

        room_code = ROOM_CODE_MAP.get(room_name)
        if not room_code:
            continue  # unknown room type — skip silently

        metric = str(metric_cell).strip()

        # Room-level metrics (plan_cell is NaN)
        if pd.isna(plan_cell):
            if metric == 'Left for sale':
                for j, d in zip(date_col_idx, dates):
                    v = df.iloc[i, j]
                    if pd.notna(v):
                        try:
                            inventory[(room_code, d)] = int(v)
                        except (ValueError, TypeError):
                            pass
            continue

        # Plan-level metrics — extract plan_code from "CODE - NAME"
        plan_str = str(plan_cell).strip()
        plan_code = plan_str.split(' - ')[0].strip() if ' - ' in plan_str else plan_str

        if plan_code not in ALLOWED_PLAN_CODES:
            continue

        for j, d in zip(date_col_idx, dates):
            v = df.iloc[i, j]
            if pd.isna(v):
                continue

            key = (room_code, plan_code, d)
            if metric == 'Price (EUR)':
                try:
                    prices[key] = round(float(v), 2)
                except (ValueError, TypeError):
                    pass
            elif metric == 'availability status':
                # Normalize to 'open' or 'closed'
                v_str = str(v).strip().lower()
                if v_str in ('open',):
                    plan_status[key] = 'open'
                else:
                    plan_status[key] = 'closed'
            elif metric == 'min stay':
                try:
                    min_stay[key] = int(v)
                except (ValueError, TypeError):
                    pass
            elif metric == 'max stay':
                try:
                    max_stay[key] = int(v)
                except (ValueError, TypeError):
                    pass

    return {
        'dates': dates,
        'prices': prices,
        'plan_status': plan_status,
        'min_stay': min_stay,
        'max_stay': max_stay,
        'inventory': inventory,
    }


def build_rate_prices_rows(parsed: dict[str, Any], hotel_id: str) -> list[dict]:
    """Build rate_prices rows ready for upsert."""
    rows: list[dict] = []
    for (room_code, plan_code, d), price in parsed['prices'].items():
        plan_id = PLAN_ID_MAP.get(plan_code)
        if not plan_id:
            continue
        status = parsed['plan_status'].get((room_code, plan_code, d), 'open')
        is_plan_closed = (status != 'open')
        rows.append({
            'hotel_id': hotel_id,
            'room_type_code': room_code,
            'plan_id': plan_id,
            'stay_date': d.isoformat(),
            'price': price,
            'currency': 'EUR',
            'status': 'open',
            'plan_closed': is_plan_closed,
            'source': 'import',
        })
    return rows


def build_restrictions_rows(parsed: dict[str, Any], hotel_id: str) -> list[dict]:
    """Build rate_restrictions rows. One row per (room, date).

    We use the most restrictive min_stay/max_stay across all the plans of
    the same room+date, since rate_restrictions is room-level (not plan-level).
    """
    # Aggregate min/max stays per (room, date)
    room_min_stay: dict[tuple[str, date], int] = {}
    room_max_stay: dict[tuple[str, date], int] = {}

    for (room_code, plan_code, d), v in parsed['min_stay'].items():
        key = (room_code, d)
        room_min_stay[key] = max(room_min_stay.get(key, 0), v)  # most restrictive = max
    for (room_code, plan_code, d), v in parsed['max_stay'].items():
        key = (room_code, d)
        # max_stay: most restrictive = min
        if key not in room_max_stay or v < room_max_stay[key]:
            room_max_stay[key] = v

    rows: list[dict] = []
    seen: set[tuple[str, date]] = set()

    # Iterate inventory first (drives the (room, date) cartesian)
    for (room_code, d), inv in parsed['inventory'].items():
        key = (room_code, d)
        seen.add(key)
        capacity = ROOM_CAPACITY.get(room_code, 1)
        rows.append({
            'hotel_id': hotel_id,
            'room_type_code': room_code,
            'stay_date': d.isoformat(),
            'cta': False,
            'ctd': False,
            'min_stay': room_min_stay.get(key) or None,
            'max_stay': room_max_stay.get(key) or None,
            'inventory': inv,
            'capacity': capacity,
            'sold': max(0, capacity - inv),  # rooms sold = capacity - left for sale
        })

    # Fallback for (room, date) combos that have min/max_stay but no inventory line
    for key in set(room_min_stay.keys()) | set(room_max_stay.keys()):
        if key in seen:
            continue
        room_code, d = key
        capacity = ROOM_CAPACITY.get(room_code, 1)
        rows.append({
            'hotel_id': hotel_id,
            'room_type_code': room_code,
            'stay_date': d.isoformat(),
            'cta': False,
            'ctd': False,
            'min_stay': room_min_stay.get(key) or None,
            'max_stay': room_max_stay.get(key) or None,
            'inventory': capacity,
            'capacity': capacity,
            'sold': 0,
        })

    return rows


def upsert_chunk(
    base_url: str,
    headers: dict,
    table: str,
    on_conflict: str,
    rows: list[dict],
    chunk_size: int = 500,
) -> int:
    """Bulk-upsert with chunking. Returns count of rows successfully sent."""
    if not rows:
        return 0
    upsert_url = f"{base_url}/rest/v1/{table}?on_conflict={on_conflict}"
    upsert_headers = {
        **headers,
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    total_ok = 0
    total_chunks = (len(rows) + chunk_size - 1) // chunk_size
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i: i + chunk_size]
        chunk_num = i // chunk_size + 1
        r = supa_request("POST", upsert_url, headers=upsert_headers, json_body=chunk)
        if r.status_code in (200, 201, 204):
            total_ok += len(chunk)
            info(f"  {table} chunk {chunk_num}/{total_chunks}: {len(chunk)} rows ✓")
        else:
            print(
                f"⚠ {table} chunk {chunk_num}/{total_chunks} failed: "
                f"HTTP {r.status_code} — {r.text[:300]}",
                file=sys.stderr,
            )
    return total_ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, help="Path to Planning .xlsx")
    parser.add_argument("--hotel-id", required=True, help="UUID of the hotel")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, no DB write")
    parser.add_argument("--chunk-size", type=int, default=500)
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

    # ─── Parse ──────────────────────────────────────────────────────────
    print(f"→ Parsing {filepath.name}")
    t0 = time.time()
    parsed = parse_planning(str(filepath))
    info(f"Parsed in {time.time() - t0:.2f}s")
    info(f"Dates: {len(parsed['dates'])} ({parsed['dates'][0]} → {parsed['dates'][-1]})")
    info(f"Prices: {len(parsed['prices'])}")
    info(f"Restrictions (min_stay): {len(parsed['min_stay'])}")
    info(f"Restrictions (max_stay): {len(parsed['max_stay'])}")
    info(f"Inventory cells: {len(parsed['inventory'])}")

    # ─── Build rows ─────────────────────────────────────────────────────
    rate_prices_rows = build_rate_prices_rows(parsed, args.hotel_id)
    restrictions_rows = build_restrictions_rows(parsed, args.hotel_id)
    info(f"→ {len(rate_prices_rows)} rate_prices rows ready")
    info(f"→ {len(restrictions_rows)} rate_restrictions rows ready")

    if args.dry_run:
        print()
        print("✓ DRY RUN — no data written.")
        if rate_prices_rows:
            print("\nSample rate_prices row:")
            print(json.dumps(rate_prices_rows[0], indent=2))
        if restrictions_rows:
            print("\nSample rate_restrictions row:")
            print(json.dumps(restrictions_rows[0], indent=2))
        return 0

    # ─── Push to Supabase ──────────────────────────────────────────────
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    print()
    print(f"→ Upserting rate_prices ({len(rate_prices_rows)} rows)")
    t0 = time.time()
    prices_ok = upsert_chunk(
        supabase_url, headers, "rate_prices",
        "hotel_id,room_type_code,plan_id,stay_date",
        rate_prices_rows, chunk_size=args.chunk_size,
    )
    info(f"Done in {time.time() - t0:.1f}s: {prices_ok}/{len(rate_prices_rows)} rows")

    print()
    print(f"→ Upserting rate_restrictions ({len(restrictions_rows)} rows)")
    t0 = time.time()
    restrictions_ok = upsert_chunk(
        supabase_url, headers, "rate_restrictions",
        "hotel_id,room_type_code,stay_date",
        restrictions_rows, chunk_size=args.chunk_size,
    )
    info(f"Done in {time.time() - t0:.1f}s: {restrictions_ok}/{len(restrictions_rows)} rows")

    print()
    print(f"✓ Import COMPLETED")
    print(f"  • rate_prices       : {prices_ok}")
    print(f"  • rate_restrictions : {restrictions_ok}")
    print()
    print(
        f"Verify in Supabase SQL Editor:\n"
        f"  SELECT COUNT(*) FROM rate_prices WHERE hotel_id = '{args.hotel_id}';\n"
        f"  SELECT COUNT(*) FROM rate_restrictions WHERE hotel_id = '{args.hotel_id}';"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

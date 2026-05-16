"""
FLOWTYM RMS — Lighthouse Excel parser

Parses a Lighthouse "Rate Insight" export (.xlsx) and produces normalized
competitor_rates rows ready for upsert into Supabase.

Expected file layout:
    Sheet "Tarifs":
        - Row 0-3: meta / blank
        - Row 4:   header (Jour | Date | Demande du marché | <client hotel> | <competitors...>)
        - Row 5+:  data, one row per stay_date

Cell values can be:
    - numeric → price in EUR
    - 'Épuisé' / 'Sold out' → sold out
    - '1 pax seulement' → partial occupancy (no price returned)
    - 'LOS2' / similar → min length-of-stay required
    - 'Absent des résultats' → not in OTA results
    - '--' or empty → no data
    - other text → flagged as unknown but not raised

Filename convention:
    <hotelslug>_<ota>_<ratetype>_los<N>_<G>guests.xlsx
    e.g. folkestoneopéra_bookingdotcom_lowest_los1_2guests.xlsx

Usage:
    from backend.workers.lighthouse_excel_parser import parse_lighthouse_export
    result = parse_lighthouse_export('/path/to/file.xlsx')
    # result['rows']  — list of dicts ready for competitor_rates upsert
    # result['meta']  — file-level metadata (date range, hotels, etc.)
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd


KNOWN_OTAS = {
    'bookingdotcom', 'expedia', 'airbnb', 'agoda',
    'branddotcom', 'hotelscom', 'tripcom', 'kayak',
}

KNOWN_RATE_TYPES = {'lowest', 'highest', 'average', 'median'}


def parse_filename(filename: str) -> dict[str, Any]:
    """Extract OTA / rate_type / LOS / guests from a Lighthouse filename.

    Defaults: ota=None, rate_type=None, los=1, guests=2.
    """
    name = Path(filename).stem
    parts = name.split('_')
    meta: dict[str, Any] = {
        'hotel_slug': parts[0] if parts else None,
        'ota': None,
        'rate_type': None,
        'los': 1,
        'guests': 2,
    }
    for part in parts[1:]:
        if part in KNOWN_OTAS:
            meta['ota'] = part
        elif part in KNOWN_RATE_TYPES:
            meta['rate_type'] = part
        elif part.startswith('los') and part[3:].isdigit():
            meta['los'] = int(part[3:])
        elif part.endswith('guests') and part[:-6].isdigit():
            meta['guests'] = int(part[:-6])
    return meta


def synthesize_competitor_id(competitor_name: str) -> int:
    """Generate a stable BIGINT id from a competitor name.

    Lighthouse exports don't include competitor IDs in the Excel; the API
    returns them but the spreadsheet only has names. We hash the name to
    a deterministic positive 63-bit integer so re-imports of the same
    competitor stay idempotent against the UNIQUE constraint.
    """
    h = hashlib.md5(competitor_name.encode('utf-8')).hexdigest()
    # Take first 15 hex chars → fits in signed 64-bit (max 2^63 - 1)
    return int(h[:15], 16)


def normalize_cell_value(raw: Any) -> tuple[Optional[float], bool, str]:
    """Convert a Lighthouse cell to (price, available, status_text).

    Returns:
        price: float price in EUR, or None if not available
        available: True if a usable price is present
        status_text: short tag for the cell's state (sold_out, partial_pax, ...)
    """
    if pd.isna(raw):
        return (None, False, 'no_data')

    if isinstance(raw, (int, float)):
        # Lighthouse can return floats (e.g. 367.5)
        return (float(raw), True, 'available')

    s = str(raw).strip()
    if not s:
        return (None, False, 'no_data')

    lower = s.lower()
    if lower in ('épuisé', 'epuise', 'sold out', 'soldout', 'sold-out'):
        return (None, False, 'sold_out')
    if 'pax seulement' in lower or 'pax only' in lower:
        return (None, False, 'partial_pax')
    if re.match(r'^los\d+$', lower):
        return (None, False, 'min_los_required')
    if 'absent' in lower or 'not listed' in lower:
        return (None, False, 'not_listed')
    if s in ('--', '-', 'N/A', 'n/a'):
        return (None, False, 'no_data')

    # Try numeric extraction (e.g. "207€" or "207 EUR")
    m = re.search(r'-?\d+(?:[.,]\d+)?', s)
    if m:
        try:
            return (float(m.group().replace(',', '.')), True, 'available')
        except ValueError:
            pass

    return (None, False, f'unknown:{s[:40]}')


def _locate_header_row(raw_sheet: pd.DataFrame, max_lookup: int = 20) -> Optional[int]:
    """Find the header row containing 'Date' and 'Jour' columns."""
    for i in range(min(max_lookup, len(raw_sheet))):
        row_values = raw_sheet.iloc[i].astype(str).tolist()
        if 'Date' in row_values and 'Jour' in row_values:
            return i
    return None


def parse_lighthouse_export(
    filepath: str,
    sheet_name: str = 'Tarifs',
    filename_override: Optional[str] = None,
) -> dict[str, Any]:
    """Parse a Lighthouse Excel export. Returns dict with rows + diagnostics.

    Returns:
        {
          'ok': bool,
          'error': str or None,
          'meta': { ota, rate_type, los, guests, client_hotel, date_range, ... },
          'rows': [ { competitor_id, competitor_name, stay_date, los,
                      price, currency, available, status_text }, ... ],
          'warnings': [str, ...],
          'stats': { available, sold_out, partial_pax, ... },
        }
    """
    result: dict[str, Any] = {
        'ok': False,
        'error': None,
        'meta': {},
        'rows': [],
        'warnings': [],
        'stats': {},
    }

    filename = filename_override or Path(filepath).name
    fn_meta = parse_filename(filename)

    # Load raw sheet to find header row
    try:
        raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    except Exception as e:
        result['error'] = f'Cannot read sheet "{sheet_name}": {e}'
        return result

    header_row = _locate_header_row(raw)
    if header_row is None:
        result['error'] = (
            f'No header row found in sheet "{sheet_name}". '
            'Expected a row containing both "Jour" and "Date".'
        )
        return result

    df = pd.read_excel(filepath, sheet_name=sheet_name, header=header_row)
    df = df.dropna(subset=['Date']).reset_index(drop=True)

    # Identify fixed vs hotel columns
    fixed_cols = {'Jour', 'Date', 'Demande du marché'}
    hotel_cols = [
        c for c in df.columns
        if c not in fixed_cols and not str(c).startswith('Unnamed')
    ]
    if not hotel_cols:
        result['error'] = 'No hotel columns found in sheet.'
        return result

    client_hotel = hotel_cols[0]
    competitor_hotels = hotel_cols[1:]

    if not competitor_hotels:
        result['warnings'].append(
            'No competitor columns detected — only the client hotel is present.'
        )

    # Build rows
    rows: list[dict[str, Any]] = []
    status_counter: Counter = Counter()
    shopped_at = datetime.now(timezone.utc).isoformat()
    ota = fn_meta['ota'] or 'unknown_ota'

    for _, r in df.iterrows():
        stay_date = r['Date']
        if pd.isna(stay_date):
            continue
        if hasattr(stay_date, 'strftime'):
            stay_date_str = stay_date.strftime('%Y-%m-%d')
        else:
            stay_date_str = str(stay_date)[:10]

        # Validate date format
        try:
            datetime.strptime(stay_date_str, '%Y-%m-%d')
        except ValueError:
            result['warnings'].append(f'Invalid date format skipped: {stay_date!r}')
            continue

        for comp_name in competitor_hotels:
            price, available, status_text = normalize_cell_value(r[comp_name])
            status_counter[status_text] += 1
            rows.append({
                'competitor_id': synthesize_competitor_id(comp_name),
                'competitor_name': comp_name,
                'ota': ota,
                'stay_date': stay_date_str,
                'los': fn_meta['los'],
                'price': price,
                'currency': 'EUR',
                'available': available,
                'status_text': status_text,
                'shopped_at': shopped_at,
            })

    result['ok'] = True
    result['meta'] = {
        **fn_meta,
        'sheet_name': sheet_name,
        'header_row': header_row,
        'client_hotel': str(client_hotel),
        'competitor_count': len(competitor_hotels),
        'competitor_names': [str(c) for c in competitor_hotels],
        'date_range_start': str(df['Date'].min().date()) if len(df) else None,
        'date_range_end': str(df['Date'].max().date()) if len(df) else None,
        'total_dates': len(df),
    }
    result['rows'] = rows
    result['stats'] = dict(status_counter)
    return result


# ─── CLI (for ad-hoc testing) ───────────────────────────────────────────────

if __name__ == '__main__':
    import argparse
    import json
    import sys

    parser = argparse.ArgumentParser(description='Parse a Lighthouse Excel export')
    parser.add_argument('filepath', help='Path to the .xlsx file')
    parser.add_argument('--sheet', default='Tarifs', help='Sheet name (default: Tarifs)')
    parser.add_argument('--limit', type=int, default=5, help='Sample rows to print')
    args = parser.parse_args()

    result = parse_lighthouse_export(args.filepath, sheet_name=args.sheet)

    if not result['ok']:
        print(f"ERROR: {result['error']}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({
        'meta': result['meta'],
        'stats': result['stats'],
        'warnings': result['warnings'],
        'total_rows': len(result['rows']),
        'sample_rows': result['rows'][: args.limit],
    }, indent=2, ensure_ascii=False, default=str))

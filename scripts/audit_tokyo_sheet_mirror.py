#!/usr/bin/env python3
"""Read-only, redacted audit of live website->Google Sheet snapshots.

Operator obtains the two *bounded* Google Sheets ranges from the connected app:
  工作表1!A1:O100 and 網站同步!A4:I<source-event-count+4>.
Input snapshot JSON, never committed: {"spreadsheetId":"...", "grid":{"range":
"'工作表1'!A1:O100","values":[...]}, "mirror":{"range":
"'網站同步'!A4:I122","values":[...]}}.

The audit verifies ID/order/SHA of the full mirror and historic grid mapping.
Do NOT mistake it for native CellData revision/protection or write authorization:
the operator must separately check formulas, native notes, validation, CAS and
readback. This program does no network, no writes and prints no private text.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from export_tokyo_site_mirror import (
    DATES, SHEET_ID, SOURCE, project_trip,
)

GRID_RANGE = "'工作表1'!A1:O100"
MIRROR_TAB = "網站同步"
# These are human-reviewed website-authoritative *layout exceptions*, not
# blanket permissions to overwrite/delete their original Google Sheet value.
SPECIAL_SOURCE_CELLS = frozenset({"I8", "O8"})
EDITORIAL_GRID_CELLS = frozenset({"I5", "I9", "I12", "I13", "I14", "I15"})


def _string(value):
    return "" if value is None else str(value)


def audit_snapshot(manifest, snapshot):
    if snapshot.get("spreadsheetId") != SHEET_ID:
        raise ValueError("Wrong Google Sheet ID")
    grid = snapshot.get("grid") or {}
    mirror = snapshot.get("mirror") or {}
    mirror_rows = manifest["mirrorRows"]
    expected_mirror_range = f"'{MIRROR_TAB}'!A4:I{len(mirror_rows)+4}"
    if grid.get("range") != GRID_RANGE or mirror.get("range") != expected_mirror_range:
        raise ValueError("Missing or incorrect bounded Sheet read range")
    raw_grid = grid.get("values")
    raw_mirror = mirror.get("values")
    if not isinstance(raw_grid, list) or not isinstance(raw_mirror, list):
        raise ValueError("Missing Sheet values arrays")
    if not raw_grid or len(raw_grid) > 100:
        raise ValueError("Invalid source Sheet row count")
    if len(raw_mirror) != len(mirror_rows)+1:
        raise ValueError("Mirror row count differs from website")
    head = raw_grid[0]
    if len(head) < 15:
        raise ValueError("Incomplete 14-day grid header")
    for idx, date in enumerate(DATES):
        expected = str(int(date[-2:]))
        if not re.match(r"^12/"+expected+r"(?!\d)", _string(head[idx+1]).strip()):
            raise ValueError("Wrong source date header: " + date)
    if raw_mirror[0][:9] != manifest["mirrorHeader"]:
        raise ValueError("Wrong mirror header or schema")

    mismatch_ids = []
    for expected, actual in zip(mirror_rows, raw_mirror[1:]):
        if [ _string(x) for x in (actual[:9]+[""]*9)[:9] ] != expected:
            mismatch_ids.append(expected[2])
    grid_cells = {}
    for row_index, row in enumerate(raw_grid[1:], start=2):
        if not isinstance(row, list) or len(row) > 15:
            raise ValueError("Unexpected grid row structure")
        for col in range(1, 15):
            val = _string(row[col]) if len(row)>col else ""
            if val.strip():
                grid_cells[chr(65+col)+str(row_index)] = val.strip()
    website_cells = manifest["gridCandidates"]
    mismatches = [
        cell for cell, expected in website_cells.items()
        if cell not in SPECIAL_SOURCE_CELLS
        and grid_cells.get(cell, "") != expected["value"]
    ]
    extras = [cell for cell in grid_cells
              if cell not in website_cells and cell not in EDITORIAL_GRID_CELLS]
    missing_editorial = [
        cell for cell in EDITORIAL_GRID_CELLS if cell not in grid_cells
    ]
    special_missing = [
        cell for cell in SPECIAL_SOURCE_CELLS if cell not in grid_cells
    ]
    # No Sheet text, booking details or full notes can appear in this object.
    return {
        "schema": "tokyo-sheet-readback-audit-v1",
        "sourceBlobSha": manifest["sourceBlobSha"],
        "websiteEvents": len(mirror_rows),
        "actualMirrorEntries": len(raw_mirror)-1,
        "mirrorMismatchIds": mismatch_ids,
        "gridMismatchCells": sorted(mismatches),
        "unexpectedFilledGridCells": sorted(extras),
        "missingEditorialCells": sorted(missing_editorial),
        "missingSpecialSourceCells": sorted(special_missing),
        "manualReviewCells": sorted(SPECIAL_SOURCE_CELLS | EDITORIAL_GRID_CELLS),
        "mirrorVerified": len(mismatch_ids)==0,
        "normalGridVerified": not (mismatches or extras or missing_editorial or special_missing),
        "canWriteSheet": False,
        "canWriteWebsite": False,
        "note": "Only a read-only values snapshot. Native notes, cell validation, formatting, source Git HEAD and actual write readback require independent verification.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--compare-sha", required=True)
    parser.add_argument("--snapshot", default="-",
                        help="Private JSON snapshot outside the repo, or - for stdin")
    args = parser.parse_args()
    manifest = project_trip(args.source.read_bytes(), args.compare_sha)
    if args.snapshot == "-":
        snapshot = json.load(sys.stdin)
    else:
        path = Path(args.snapshot).resolve()
        if path.is_relative_to(SOURCE.parents[2]):
            parser.error("Private Sheet snapshot must be outside Git repo")
        snapshot = json.loads(path.read_text(encoding="utf-8"))
    report = audit_snapshot(manifest, snapshot)
    print(json.dumps(report, ensure_ascii=False))
    if not report["mirrorVerified"] or not report["normalGridVerified"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()

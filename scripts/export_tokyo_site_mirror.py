#!/usr/bin/env python3
"""Prepare a read-only, stable-ID projection from the Tokyo WEBSITE trip.

Website -> Sheet is the ONLY approved direction through 2026-11-30.
This module never touches a Google API, private Sheet, Git commit or deployment.
The resulting projection provides reproducible expected mirror rows and source
grid cells to an authorized operator, which MUST read fresh target CellData and
perform independent protected-cell, privacy, readback and CAS checks.

Use --check for a redacted smoke-test summary; --output for a JSON projection
to an operator-owned path OUTSIDE the working Git repository.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "2026/tokyo/trip.json"
SHEET_ID = "1kEuyUBricseI1Ihyz8EGp2JHKD1PWWuHnSS6EWmT5-E"
SHEET_TAB = "工作表1"
DATES = tuple(f"2026-12-{day:02d}" for day in range(13, 27))
HEADERS = ("日期", "時間", "網站穩定 ID", "行程內容（網站版本）",
           "原工作表格位", "群組", "事件種類", "網站備註", "來源 SHA")
TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
GRID_RE = re.compile(r"^([B-O])([2-9]|[1-9]\d|100)$")


def git_blob_sha(raw):
    if not isinstance(raw, bytes):
        raise TypeError("exact UTF-8 Git blob bytes required")
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()


def project_trip(raw, expected_blob_sha=None):
    """Return a public projection ONLY; do not infer cells for editorial events."""
    sha = git_blob_sha(raw)
    if expected_blob_sha is not None and sha != expected_blob_sha:
        raise ValueError("Website source blob SHA changed: stop before updating Sheet")
    trip = json.loads(raw.decode("utf-8"))
    days = trip.get("days")
    if not isinstance(days, list) or len(days) != len(DATES):
        raise ValueError("Require all 14 website dates")
    if [d.get("date") for d in days] != list(DATES):
        raise ValueError("Website date order or date values changed")
    ids, cells = set(), {}
    mirror, no_cell = [], []
    inherited_count, source_count = 0, 0
    counts = []
    for day_index, day in enumerate(days):
        events = day.get("events")
        if not isinstance(events, list):
            raise ValueError("Missing website day events: " + day["date"])
        counts.append(len(events))
        for event in events:
            if not isinstance(event, dict):
                raise ValueError("Unexpected event payload")
            eid, title = event.get("id"), event.get("title")
            time, original_cell = event.get("time") or "", event.get("cell") or ""
            if not isinstance(eid, str) or not eid.strip() or eid in ids:
                raise ValueError("Missing or duplicate stable event ID")
            ids.add(eid)
            if not isinstance(title, str) or not title.strip():
                raise ValueError("Empty website event title: " + eid)
            if not isinstance(time, str) or (time and not TIME_RE.fullmatch(time)):
                raise ValueError("Invalid website event time: " + eid)
            if not isinstance(original_cell, str):
                raise ValueError("Invalid source cell for " + eid)
            if original_cell:
                m = GRID_RE.fullmatch(original_cell)
                if not m or ord(m[1]) - ord("B") != day_index:
                    raise ValueError("Event source cell outside its day: " + eid)
                if original_cell in cells:
                    raise ValueError("Duplicate original Sheet cell: " + original_cell)
                # The website is public already; its title is the authorized
                # public content. Never merge historical private Sheet text.
                cells[original_cell] = {
                    "eventId": eid,
                    "value": (time + " " + title).strip(),
                    "inherited": bool(event.get("inherited")),
                    "date": day["date"],
                }
                if event.get("inherited"):
                    inherited_count += 1
                else:
                    source_count += 1
            else:
                if event.get("inherited"):
                    raise ValueError("Inherited event has no traceable source cell")
                no_cell.append(eid)

            group, kind, note = event.get("group") or "", event.get("kind") or event.get("origin") or "", event.get("note") or ""
            if not all(isinstance(x, str) for x in (group, kind, note)):
                raise ValueError("Unexpected nontext event metadata")
            mirror.append([day["date"], time, eid, title, original_cell, group, kind, note, sha])

    if len(mirror) != len(ids) or sum(counts) != len(mirror):
        raise ValueError("Website mirror row count/ID mismatch")
    if len(cells) + len(no_cell) != len(mirror):
        raise ValueError("Website projection dropped events")

    return {
        "schema": "tokyo-website-to-sheet-mirror-v1",
        "mode": "projection-only",
        "source": "halafish1224/tokyo-trip/main:2026/tokyo/trip.json",
        "sourceBlobSha": sha,
        "spreadsheetId": SHEET_ID,
        "targetTab": SHEET_TAB,
        "mirrorTab": "網站同步",
        "dateCount": len(DATES),
        "dayCounts": [{"date": date, "events": n} for date, n in zip(DATES, counts)],
        "summary": {
            "websiteEvents": len(mirror),
            "mirrorRows": len(mirror),
            "traceableSourceCells": source_count,
            "inheritedCells": inherited_count,
            "eventsWithoutOriginalCell": len(no_cell),
            "gridCandidates": len(cells),
        },
        "mirrorHeader": list(HEADERS),
        "mirrorRows": mirror,
        "gridCandidates": cells,
        "noOriginalCellEventIds": no_cell,
        "canWriteSheet": False,
        "canWriteWebsite": False,
        "requires": [
            "fresh Google Sheet metadata / bounded CellData",
            "manual protected-cell exceptions for confirmed 12/20 group plan and 12/26 Keisei",
            "historical values preserved as native Google Sheet notes",
            "source SHA recheck immediately before write",
            "full readback of target and untouched cells",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--compare-sha", help="Expected exact Git blob SHA from repository")
    parser.add_argument("--output", type=Path, help="Save projection JSON outside repo; exclusive new file")
    args = parser.parse_args()
    source = args.source.resolve()
    if not source.is_file():
        parser.error("source trip.json does not exist")
    report = project_trip(source.read_bytes(), args.compare_sha)

    if args.output:
        target = args.output.resolve()
        try:
            target.relative_to(ROOT)
            parser.error("--output must be outside Git repository")
        except ValueError:
            pass
        with target.open("x", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
            f.write("\n")
        try:
            target.chmod(0o600)
        except OSError:
            pass
        print(json.dumps({
            "schema": report["schema"], "mode": report["mode"],
            "sourceBlobSha": report["sourceBlobSha"], "summary": report["summary"],
            "destination": str(target), "wroteSheet": False,
        }, ensure_ascii=False))
    else:
        print(json.dumps({
            "schema": report["schema"], "mode": report["mode"],
            "sourceBlobSha": report["sourceBlobSha"], "summary": report["summary"],
            "wroteSheet": False, "wroteWebsite": False,
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()

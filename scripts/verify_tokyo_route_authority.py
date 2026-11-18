#!/usr/bin/env python3
"""Do not regress confirmed Dec 20 tower split or Dec 26 Keisei airport route.

The Google Sheet still contains an older 14:15 Tokyo Tower route. Until
its cells are reviewed and reconciled, Sheet-first compilers must not erase
the explicitly approved 09:00 climb or Shibuya-centered alternate plan.

No private Sheet data is read, logged, stored or published by this guard.
To change the day, update the test/guard in a separately reviewed PR.
"""
import argparse
import json
from pathlib import Path


APPROVED = {
    "plan-1220-tower-0900": "09:00",
    "plan-1220-return-1030": "10:30",
    "plan-1220-shibuya-1330": "13:30",
    "plan-1220-blue-1800": "18:00",
}
APPROVED_DEC26 = {"sheet-2026-12-26-r8": "12:50", "sheet-2026-12-26-r9": "13:30"}
TRIP = Path(__file__).resolve().parents[1] / "2026/tokyo/trip.json"


def validate_trip(trip):
    days = trip.get("days")
    if not isinstance(days, list) or len(days) != 14:
        raise ValueError("Must preserve all 14 days before publication")
    selected = [day for day in days if day.get("date") == "2026-12-20"]
    if len(selected) != 1:
        raise ValueError("Missing or duplicate 12/20 itinerary")
    events = selected[0].get("events")
    if not isinstance(events, list):
        raise ValueError("Missing 12/20 events")
    by_id = {}
    for e in events:
        event_id = e.get("id")
        if event_id in by_id:
            raise ValueError("Duplicate 12/20 event ID")
        by_id[event_id] = e
    for event_id, expected_time in APPROVED.items():
        if by_id.get(event_id, {}).get("time") != expected_time:
            raise ValueError("Owner-confirmed morning split itinerary changed: " + event_id)
    # Avoid a replacement afternoon climb from the un-reconciled old Sheet.
    for e in events:
        if e.get("time") == "14:15" and ("東京鐵塔" in e.get("title", "") or "登塔" in e.get("title", "")):
            raise ValueError("Old 14:15 Tokyo Tower plan was reintroduced")
    title = by_id["plan-1220-tower-0900"].get("title", "")
    if "長輩" not in title or "澀谷" not in title:
        raise ValueError("Morning climb must preserve the Shibuya/rest split")
    airport_days = [day for day in days if day.get("date") == "2026-12-26"]
    if len(airport_days) != 1 or not isinstance(airport_days[0].get("events"), list):
        raise ValueError("Missing or duplicate 12/26 airport itinerary")
    airport_by_id = {}
    for e in airport_days[0]["events"]:
        if e.get("id") in airport_by_id:
            raise ValueError("Duplicate 12/26 event ID")
        airport_by_id[e.get("id")] = e
        if "Jumbo Taxi" in str(e.get("title", "")):
            raise ValueError("Old Jumbo Taxi primary route reintroduced")
    for event_id, expected in APPROVED_DEC26.items():
        planned = airport_by_id.get(event_id, {})
        if planned.get("time") != expected or "京成 Access" not in str(planned.get("title", "")):
            raise ValueError("Owner-confirmed Dec 26 Keisei primary route changed: " + event_id)
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--trip", type=Path, default=TRIP)
    args = parser.parse_args()
    validate_trip(json.loads(args.trip.read_text(encoding="utf-8")))
    print("Tokyo owner-approved 12/20 morning tower and 12/26 Keisei primary airport route: verified")


if __name__ == "__main__":
    main()

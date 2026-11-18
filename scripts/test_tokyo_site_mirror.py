import copy
import json
import unittest
from pathlib import Path

from export_tokyo_site_mirror import DATES, SOURCE, SHEET_ID, git_blob_sha, project_trip


def fixture():
    return {"days": [{"date": day, "events": []} for day in DATES]}


def sample_event(cell="B6", eid="sheet-2026-12-13-r6", inherited=False):
    return {
        "id": eid, "time": "10:00", "title": "到機場",
        "cell": cell, "origin": "sheet", "kind": "transit",
        "note": "", "inherited": inherited,
    }


def encode(trip):
    return json.dumps(trip, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class WebsiteToSheetProjection(unittest.TestCase):
    def test_real_website_projection_keeps_every_stable_id_and_14_days(self):
        raw = SOURCE.read_bytes()
        trip = json.loads(raw.decode("utf-8"))
        manifest = project_trip(raw, git_blob_sha(raw))
        expected_ids = [e["id"] for day in trip["days"] for e in day["events"]]
        self.assertEqual(manifest["summary"]["websiteEvents"], len(expected_ids))
        self.assertEqual([row[2] for row in manifest["mirrorRows"]], expected_ids)
        self.assertEqual(len(manifest["mirrorRows"]), len(set(expected_ids)))
        self.assertEqual(manifest["dateCount"], 14)
        self.assertEqual(sum(row["events"] for row in manifest["dayCounts"]), len(expected_ids))
        self.assertEqual(
            manifest["summary"]["gridCandidates"] + manifest["summary"]["eventsWithoutOriginalCell"],
            len(expected_ids)
        )
        self.assertEqual(manifest["mode"], "projection-only")
        self.assertFalse(manifest["canWriteWebsite"])
        self.assertFalse(manifest["canWriteSheet"])
        self.assertEqual(manifest["spreadsheetId"], SHEET_ID)
        self.assertEqual(manifest["sourceBlobSha"], git_blob_sha(raw))

    def test_projection_handles_new_stops_without_hard_coding_118(self):
        trip = fixture()
        trip["days"][0]["events"].append(sample_event())
        trip["days"][7]["events"].append({
            "id": "plan-1220-new-stop", "time": "17:30", "title": "澀谷集合",
            "cell": "", "kind": "place", "note": "依長輩體力彈性調整"
        })
        report = project_trip(encode(trip))
        self.assertEqual(report["summary"]["websiteEvents"], 2)
        self.assertEqual(report["summary"]["traceableSourceCells"], 1)
        self.assertEqual(report["summary"]["eventsWithoutOriginalCell"], 1)
        self.assertEqual(report["noOriginalCellEventIds"], ["plan-1220-new-stop"])
        self.assertEqual(report["gridCandidates"]["B6"]["eventId"], "sheet-2026-12-13-r6")
        self.assertEqual(report["mirrorRows"][1][4], "")  # do not invent a cell
        self.assertEqual(report["mirrorRows"][1][7], "依長輩體力彈性調整")

    def test_inherited_cells_are_separate_from_actual_source_cells(self):
        trip = fixture()
        trip["days"][1]["events"].append(sample_event(
            cell="C18", eid="sheet-2026-12-14-r18", inherited=True
        ))
        report = project_trip(encode(trip))
        self.assertEqual(report["summary"]["inheritedCells"], 1)
        self.assertEqual(report["summary"]["traceableSourceCells"], 0)
        self.assertEqual(report["gridCandidates"]["C18"]["inherited"], True)

    def test_duplicate_ids_and_source_cell_overlaps_fail(self):
        trip = fixture()
        trip["days"][0]["events"] = [sample_event(), sample_event(cell="B7")]
        with self.assertRaisesRegex(ValueError, "duplicate stable event"):
            project_trip(encode(trip))
        trip = fixture()
        trip["days"][0]["events"] = [sample_event(), sample_event(eid="other")]
        with self.assertRaisesRegex(ValueError, "Duplicate original Sheet"):
            project_trip(encode(trip))

    def test_bad_date_out_of_date_column_and_time_fail_closed(self):
        trip = fixture()
        trip["days"][5]["date"] = "2026-12-28"
        with self.assertRaisesRegex(ValueError, "Website date order"):
            project_trip(encode(trip))
        trip = fixture()
        trip["days"][7]["events"].append(sample_event(cell="B6"))
        with self.assertRaisesRegex(ValueError, "outside its day"):
            project_trip(encode(trip))
        trip = fixture()
        ev = sample_event()
        ev["time"] = "25:78"
        trip["days"][0]["events"].append(ev)
        with self.assertRaisesRegex(ValueError, "Invalid website event time"):
            project_trip(encode(trip))

    def test_missing_rows_or_titles_fail_closed(self):
        trip = fixture()
        trip["days"].pop()
        with self.assertRaisesRegex(ValueError, "all 14"):
            project_trip(encode(trip))
        trip = fixture()
        ev = sample_event()
        ev["title"] = ""
        trip["days"][0]["events"].append(ev)
        with self.assertRaisesRegex(ValueError, "Empty website event title"):
            project_trip(encode(trip))

    def test_source_git_blob_sha_prevents_stale_snapshot(self):
        trip = fixture()
        raw = encode(trip)
        sha = git_blob_sha(raw)
        self.assertEqual(project_trip(raw, sha)["sourceBlobSha"], sha)
        with self.assertRaisesRegex(ValueError, "source blob SHA changed"):
            project_trip(raw, "0" * 40)
        updated = raw + b" "
        with self.assertRaisesRegex(ValueError, "source blob SHA changed"):
            project_trip(updated, sha)

    def test_projection_does_not_expose_private_sheet_snapshot_or_write_permissions(self):
        trip = fixture()
        trip["days"][0]["events"].append(sample_event())
        report = project_trip(encode(trip))
        self.assertNotIn("sheetRaw", str(report))
        self.assertFalse(report["canWriteSheet"])
        self.assertFalse(report["canWriteWebsite"])
        self.assertTrue(all(len(row) == 9 for row in report["mirrorRows"]))


if __name__ == "__main__":
    unittest.main()

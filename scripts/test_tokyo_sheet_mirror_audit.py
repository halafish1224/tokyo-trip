import copy
import json
import unittest

from audit_tokyo_sheet_mirror import audit_snapshot
from export_tokyo_site_mirror import DATES, HEADERS, SHEET_ID, project_trip


def fixture():
    trip = {"days": [{"date": date, "events": []} for date in DATES]}
    trip["days"][0]["events"].append({
        "id": "sheet-2026-12-13-r6", "title": "到機場", "time": "10:00",
        "cell": "B6", "origin": "sheet", "kind": "transit",
        "note": "", "inherited": False
    })
    return trip


def make_snapshot(manifest):
    grid = [["時間"]+[f"12/{int(date[-2:])}(日)" for date in DATES]]
    while len(grid) < 6:
        grid.append([])
    grid[5] = ["10:00", "10:00 到機場"]
    mirror = [list(HEADERS)] + copy.deepcopy(manifest["mirrorRows"])
    return {
        "spreadsheetId": SHEET_ID,
        "grid": {"range": "'工作表1'!A1:O100", "values": grid},
        "mirror": {
            "range": f"'網站同步'!A4:I{len(manifest['mirrorRows'])+4}",
            "values": mirror,
        },
    }


def manifest_for(trip=None):
    src = fixture() if trip is None else trip
    return project_trip(json.dumps(src, ensure_ascii=False).encode("utf-8"))


class TokyoMirrorAudit(unittest.TestCase):
    def test_precise_snapshot_passes_value_audit_not_write_authority(self):
        manifest = manifest_for()
        report = audit_snapshot(manifest, make_snapshot(manifest))
        self.assertTrue(report["mirrorVerified"])
        self.assertTrue(report["normalGridVerified"])
        self.assertEqual(report["actualMirrorEntries"], 1)
        self.assertEqual(report["mirrorMismatchIds"], [])
        self.assertFalse(report["canWriteSheet"])
        self.assertFalse(report["canWriteWebsite"])

    def test_mirror_drift_reports_event_id_not_private_value(self):
        manifest = manifest_for()
        sheet = make_snapshot(manifest)
        sheet["mirror"]["values"][1][3] = "PRIVATE MESSAGE OR BOOKING"
        result = audit_snapshot(manifest, sheet)
        self.assertEqual(result["mirrorMismatchIds"], ["sheet-2026-12-13-r6"])
        self.assertFalse(result["mirrorVerified"])
        self.assertNotIn("PRIVATE MESSAGE", json.dumps(result))

    def test_grid_drift_reports_cell_not_private_value(self):
        manifest = manifest_for()
        sheet = make_snapshot(manifest)
        sheet["grid"]["values"][5][1] = "PRIVATE OLD ROUTE"
        result = audit_snapshot(manifest, sheet)
        self.assertEqual(result["gridMismatchCells"], ["B6"])
        self.assertFalse(result["normalGridVerified"])
        self.assertNotIn("PRIVATE OLD", json.dumps(result))

    def test_unexpected_stale_sheet_event_is_not_silently_imported_to_website(self):
        manifest = manifest_for()
        sheet = make_snapshot(manifest)
        sheet["grid"]["values"][4] = ["09:00"] + [""]*14
        sheet["grid"]["values"][4][14] = "PRIVATE STALE 12/26 EVENT"
        result = audit_snapshot(manifest, sheet)
        self.assertEqual(result["unexpectedFilledGridCells"], ["O5"])
        self.assertFalse(result["normalGridVerified"])
        self.assertFalse(result["canWriteWebsite"])
        self.assertNotIn("PRIVATE STALE", json.dumps(result))

    def test_fail_closed_on_wrong_spreadsheet_range_or_dates(self):
        manifest = manifest_for()
        sheet = make_snapshot(manifest)
        sheet["spreadsheetId"] = "wrong"
        with self.assertRaisesRegex(ValueError, "Wrong Google Sheet"):
            audit_snapshot(manifest, sheet)
        sheet = make_snapshot(manifest)
        sheet["grid"]["range"] = "'工作表1'!A1:O50"
        with self.assertRaisesRegex(ValueError, "bounded Sheet read"):
            audit_snapshot(manifest, sheet)
        sheet = make_snapshot(manifest)
        sheet["grid"]["values"][0][8] = "12/22(日)"
        with self.assertRaisesRegex(ValueError, "Wrong source date"):
            audit_snapshot(manifest, sheet)

    def test_incomplete_mirror_is_failure_not_auto_healed(self):
        manifest = manifest_for()
        sheet = make_snapshot(manifest)
        sheet["mirror"]["values"].pop()
        with self.assertRaisesRegex(ValueError, "Mirror row count"):
            audit_snapshot(manifest, sheet)

    def test_read_only_reports_special_approved_layout_separately(self):
        trip = fixture()
        trip["days"][7]["events"].append({
            "id": "plan-1220-tower-0900", "title": "上午登階／長輩留澀谷",
            "time": "09:00", "cell": "", "kind": "place"
        })
        manifest = manifest_for(trip)
        sheet = make_snapshot(manifest)
        result = audit_snapshot(manifest, sheet)
        self.assertIn("I5", result["missingEditorialCells"])
        self.assertIn("I8", result["manualReviewCells"])
        self.assertFalse(result["normalGridVerified"])
        self.assertFalse(result["canWriteWebsite"])


if __name__ == "__main__":
    unittest.main()

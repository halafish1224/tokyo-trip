import copy
import unittest
from verify_tokyo_route_authority import validate_trip, APPROVED, APPROVED_DEC26


def sample():
    days = [{"date":f"2026-12-{day:02}", "events": []} for day in range(13, 27)]
    events = days[7]["events"]
    for event_id, time in APPROVED.items():
        events.append({"id":event_id,"time":time,"title":(
            "東京鐵塔外樓梯登階，長輩留在澀谷休息" if event_id=="plan-1220-tower-0900" else "澀谷行程"
        )})
    days[13]["events"].extend([
        {"id": eid, "time": tm, "title":
            "飯店集合\n大眾交通規劃:浜町住宿據點>成田機場"
            if eid.endswith("-r8") else "京成 Access 特急往成田 Terminal 2"}
        for eid, tm in APPROVED_DEC26.items()
    ])
    return {"days":days}


class RouteAuthority(unittest.TestCase):
    def test_owner_confirmed_morning_climb_and_shibuya_split(self):
        self.assertTrue(validate_trip(sample()))

    def test_older_sheet_1415_route_cannot_overwrite(self):
        trip=sample()
        trip["days"][7]["events"].append({
            "id":"sheet-old-tower","time":"14:15","title":"東京鐵塔登塔"
        })
        with self.assertRaisesRegex(ValueError,"Old 14:15"):
            validate_trip(trip)

    def test_missing_or_moved_morning_0900_fails(self):
        trip=sample()
        trip["days"][7]["events"][0]["time"]="14:15"
        with self.assertRaisesRegex(ValueError,"plan-1220-tower-0900"):
            validate_trip(trip)

    def test_missing_shibuya_rest_split_fails(self):
        trip=sample()
        trip["days"][7]["events"][0]["title"]="東京鐵塔登階"
        with self.assertRaisesRegex(ValueError,"Shibuya/rest"):
            validate_trip(trip)

    def test_owner_confirmed_dec26_keisei_primary(self):
        self.assertTrue(validate_trip(sample()))

    def test_dec26_old_jumbo_taxi_regression_fails(self):
        trip = sample()
        trip["days"][13]["events"][0]["title"] = "12:50 飯店集合搭 Jumbo Taxi"
        with self.assertRaisesRegex(ValueError, "Old Jumbo Taxi"):
            validate_trip(trip)

    def test_dec26_generic_assembly_is_valid_without_invented_train_at_1250(self):
        trip=sample()
        self.assertIn("飯店集合",trip["days"][13]["events"][0]["title"])
        self.assertNotIn("京成 Access",trip["days"][13]["events"][0]["title"])
        self.assertTrue(validate_trip(trip))

    def test_dec26_assembly_cannot_be_deleted(self):
        trip=sample()
        trip["days"][13]["events"][0]["title"]="未知集合地點"
        with self.assertRaisesRegex(ValueError, "airport assembly"):
            validate_trip(trip)

    def test_dec26_change_time_or_delete_keisei_fails(self):
        trip = sample()
        trip["days"][13]["events"][1]["time"] = "14:15"
        with self.assertRaisesRegex(ValueError, "sheet-2026-12-26-r9"):
            validate_trip(trip)
        trip = sample()
        trip["days"][13]["events"].pop()
        with self.assertRaisesRegex(ValueError, "sheet-2026-12-26-r9"):
            validate_trip(trip)

    def test_missing_days_or_duplicate_ids_fails(self):
        trip=sample()
        trip["days"].pop()
        with self.assertRaisesRegex(ValueError,"14 days"):
            validate_trip(trip)
        trip=sample()
        trip["days"][7]["events"].append(copy.deepcopy(trip["days"][7]["events"][0]))
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            validate_trip(trip)


if __name__ == "__main__":
    unittest.main()

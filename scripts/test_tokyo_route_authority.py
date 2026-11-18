import copy
import unittest
from verify_tokyo_route_authority import validate_trip, APPROVED


def sample():
    days = [{"date":f"2026-12-{day:02}", "events": []} for day in range(13, 27)]
    events = days[7]["events"]
    for event_id, time in APPROVED.items():
        events.append({"id":event_id,"time":time,"title":(
            "東京鐵塔外樓梯登階，長輩留在澀谷休息" if event_id=="plan-1220-tower-0900" else "澀谷行程"
        )})
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

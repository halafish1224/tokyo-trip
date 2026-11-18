#!/usr/bin/env python3
import copy
import datetime as dt
import json
import unittest
from tokyo_sync_mode import get_mode,DEFAULT

class SyncPolicyTest(unittest.TestCase):
    def setUp(self):
        self.policy=json.loads(DEFAULT.read_text(encoding="utf-8"))
    def at(self,text,policy=None):
        return get_mode(policy or self.policy,dt.datetime.fromisoformat(text))
    def test_before_cutover_only_website_is_authoritative(self):
        self.assertEqual(self.at("2026-11-18T21:30:00+08:00"),"website_to_sheet")
        self.assertEqual(self.at("2026-11-30T23:59:59+08:00"),"website_to_sheet")
        self.assertEqual(self.at("2026-11-30T15:59:59Z"),"website_to_sheet")
    def test_december_1_requires_explicit_verified_activation(self):
        self.assertEqual(self.at("2026-12-01T00:00:00+08:00"),"bidirectional_pending_verification")
        self.assertEqual(self.at("2026-12-01T08:00:00+08:00"),"bidirectional_pending_verification")
    def test_reject_no_verified_approval_even_if_flag_enabled(self):
        p=copy.deepcopy(self.policy);p["bidirectionalEnabled"]=True
        with self.assertRaisesRegex(ValueError,"verifiable evidence"):
            self.at("2026-12-01T09:00:00+08:00",p)
    def test_approved_writes_only_after_cutover_and_valid_evidence(self):
        p=copy.deepcopy(self.policy);p["bidirectionalEnabled"]=True
        p["activationEvidence"]={"approvedCommit":"abcdef012345","sheetVersion":"rev1",
            "readbackVerifiedAt":"2026-12-01T08:55:00+08:00"}
        self.assertEqual(self.at("2026-11-30T22:00:00+08:00",p),"website_to_sheet")
        self.assertEqual(self.at("2026-12-01T09:00:00+08:00",p),"bidirectional")
    def test_wrong_sheet_and_cutoff_are_rejected(self):
        p=copy.deepcopy(self.policy);p["sheetId"]="unrelated"
        with self.assertRaisesRegex(ValueError,"Sheet identity"):
            self.at("2026-11-30T22:00:00+08:00",p)
        p=copy.deepcopy(self.policy);p["bidirectionalEarliest"]="2026-11-30T00:00:00+08:00"
        with self.assertRaisesRegex(ValueError,"owner-approved cutoff"):
            self.at("2026-11-30T22:00:00+08:00",p)
    def test_no_naive_datetime(self):
        with self.assertRaisesRegex(ValueError,"timezone-aware"):
            get_mode(self.policy,dt.datetime(2026,12,1))
    def test_activation_evidence_must_be_after_cutover(self):
        p=copy.deepcopy(self.policy);p["bidirectionalEnabled"]=True
        p["activationEvidence"]={"approvedCommit":"abcdef012345","sheetVersion":"rev1",
            "readbackVerifiedAt":"2026-11-30T22:00:00+08:00"}
        with self.assertRaisesRegex(ValueError,"after cutover"):
            self.at("2026-12-01T09:00:00+08:00",p)
if __name__=="__main__":
    unittest.main()

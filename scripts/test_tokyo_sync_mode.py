#!/usr/bin/env python3
import copy
import datetime as dt
import json
import unittest
from tokyo_sync_mode import get_mode, DEFAULT
from export_tokyo_site_mirror import git_blob_sha, SOURCE


class SyncPolicyTest(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads(DEFAULT.read_text(encoding="utf-8"))

    def at(self, text, policy=None):
        return get_mode(self.policy if policy is None else policy,
                        dt.datetime.fromisoformat(text))

    def activated(self):
        p = copy.deepcopy(self.policy)
        p["bidirectionalEnabled"] = True
        p["activationEvidence"] = {
            "approvedCommit": "a" * 40,
            "sourceBlobSha": git_blob_sha(SOURCE.read_bytes()),
            "sheetVersion": "verified-2026-12-01",
            "readbackVerifiedAt": "2026-12-01T08:55:00+08:00",
            "conflictCount": 0,
            "mirrorVerified": True,
            "nativeNotesPreserved": True,
            "publicDataSanitized": True,
            "approvedByOwner": True,
        }
        return p

    def test_before_cutover_only_website_is_authoritative(self):
        self.assertEqual(self.at("2026-11-18T21:30:00+08:00"), "website_to_sheet")
        self.assertEqual(self.at("2026-11-30T23:59:59+08:00"), "website_to_sheet")
        self.assertEqual(self.at("2026-11-30T15:59:59Z"), "website_to_sheet")
        self.assertEqual(self.at("2026-11-30T22:00:00+08:00", self.activated()), "website_to_sheet")

    def test_december_1_requires_explicit_verified_activation(self):
        self.assertEqual(self.at("2026-12-01T00:00:00+08:00"), "bidirectional_pending_verification")
        self.assertEqual(self.at("2026-12-01T08:00:00+08:00"), "bidirectional_pending_verification")

    def test_reject_no_verified_approval_even_if_flag_enabled(self):
        p = copy.deepcopy(self.policy)
        p["bidirectionalEnabled"] = True
        with self.assertRaisesRegex(ValueError, "verifiable evidence"):
            self.at("2026-12-01T09:00:00+08:00", p)

    def test_approved_writes_only_after_cutover_and_valid_evidence(self):
        p = self.activated()
        self.assertEqual(self.at("2026-11-30T22:00:00+08:00", p), "website_to_sheet")
        self.assertEqual(self.at("2026-12-01T09:00:00+08:00", p), "bidirectional")

    def test_wrong_sheet_and_cutoff_are_rejected(self):
        p = copy.deepcopy(self.policy)
        p["sheetId"] = "unrelated"
        with self.assertRaisesRegex(ValueError, "Sheet identity"):
            self.at("2026-11-30T22:00:00+08:00", p)
        p = copy.deepcopy(self.policy)
        p["bidirectionalEarliest"] = "2026-11-30T00:00:00+08:00"
        with self.assertRaisesRegex(ValueError, "owner-approved cutoff"):
            self.at("2026-11-30T22:00:00+08:00", p)

    def test_no_naive_datetime(self):
        with self.assertRaisesRegex(ValueError, "timezone-aware"):
            get_mode(self.policy, dt.datetime(2026, 12, 1))

    def test_reject_shorthand_or_invalid_git_commits(self):
        p = self.activated()
        p["activationEvidence"]["approvedCommit"] = "abcdef012345"
        with self.assertRaisesRegex(ValueError, "full approved Git commit SHA"):
            self.at("2026-12-01T09:00:00+08:00", p)

    def test_reject_malformed_website_blob_sha(self):
        p = self.activated()
        p["activationEvidence"]["sourceBlobSha"] = "short"
        with self.assertRaisesRegex(ValueError, "full source Git blob SHA"):
            self.at("2026-12-01T09:00:00+08:00", p)

    def test_runtime_does_not_pin_initial_source_blob_after_legitimate_future_site_updates(self):
        p = self.activated()
        # Git/Sheet CAS still required from the connected writer per operation.
        # A later authorized website commit will have a different blob hash;
        # this evidence-shape gate must not permanently block bidirectional use.
        p["activationEvidence"]["sourceBlobSha"] = "b" * 40
        self.assertEqual(self.at("2026-12-02T09:00:00+08:00", p), "bidirectional")

    def test_reject_any_unresolved_conflict_or_missing_readback_proof(self):
        for field, value, reason in (
            ("conflictCount", 1, "zero unresolved"),
            ("mirrorVerified", False, "mirrorVerified"),
            ("nativeNotesPreserved", False, "nativeNotesPreserved"),
            ("publicDataSanitized", False, "publicDataSanitized"),
            ("approvedByOwner", False, "approvedByOwner"),
            ("sheetVersion", "", "verified Sheet revision"),
        ):
            p = self.activated()
            p["activationEvidence"][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, reason):
                self.at("2026-12-01T09:00:00+08:00", p)

    def test_readback_must_be_after_cutover_and_not_future_dated(self):
        p = self.activated()
        p["activationEvidence"]["readbackVerifiedAt"] = "2026-11-30T22:00:00+08:00"
        with self.assertRaisesRegex(ValueError, "after cutover"):
            self.at("2026-12-01T09:00:00+08:00", p)
        p = self.activated()
        p["activationEvidence"]["readbackVerifiedAt"] = "2026-12-01T10:00:00+08:00"
        with self.assertRaisesRegex(ValueError, "after cutover"):
            self.at("2026-12-01T09:00:00+08:00", p)

    def test_naive_readback_date_rejected(self):
        p = self.activated()
        p["activationEvidence"]["readbackVerifiedAt"] = "2026-12-01T08:55:00"
        with self.assertRaisesRegex(ValueError, "after cutover"):
            self.at("2026-12-01T09:00:00+08:00", p)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Owner-authorized Tokyo sync direction gate. NEVER enables writes by date alone."""
import argparse
import datetime as dt
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEFAULT=ROOT/"2026/tokyo/research/sync-policy.json"

def get_mode(policy,now):
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("timezone-aware timestamp required")
    if policy.get("schema")!="tokyo-sync-direction-v1":
        raise ValueError("unknown sync policy version")
    if policy.get("sheetId")!="1kEuyUBricseI1Ihyz8EGp2JHKD1PWWuHnSS6EWmT5-E":
        raise ValueError("wrong Google Sheet identity")
    if policy.get("websiteRepository")!="halafish1224/tokyo-trip" or policy.get("websitePath")!="2026/tokyo/trip.json":
        raise ValueError("wrong website source identity")
    if policy.get("timezone")!="Asia/Taipei":
        raise ValueError("wrong timezone")
    cutoff=dt.datetime.fromisoformat(policy["bidirectionalEarliest"])
    if cutoff!=dt.datetime.fromisoformat("2026-12-01T00:00:00+08:00"):
        raise ValueError("owner-approved cutoff changed")
    if dt.datetime.fromisoformat(policy["websiteAuthoritativeUntil"])!=cutoff:
        raise ValueError("policy cutoff mismatch")
    if now<cutoff:
        return "website_to_sheet"
    if policy.get("bidirectionalEnabled") is not True:
        return "bidirectional_pending_verification"
    evidence=policy.get("activationEvidence")
    if not isinstance(evidence,dict) or not evidence.get("approvedCommit") or not evidence.get("readbackVerifiedAt") or not evidence.get("sheetVersion"):
        raise ValueError("bidirectional activation requires verifiable evidence")
    approved=dt.datetime.fromisoformat(evidence["readbackVerifiedAt"])
    if approved.tzinfo is None or approved<cutoff:
        raise ValueError("bidirectional verification must happen after cutover")
    return "bidirectional"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--policy",type=Path,default=DEFAULT)
    parser.add_argument("--now",help="Timezone-aware test timestamp (UTC if omitted)")
    parser.add_argument("--allow-sheet-to-site",action="store_true")
    args=parser.parse_args()
    policy=json.loads(args.policy.read_text(encoding="utf-8"))
    now=dt.datetime.fromisoformat(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
    mode=get_mode(policy,now)
    print(("true" if mode=="bidirectional" else "false") if args.allow_sheet_to_site else mode)

if __name__=="__main__":
    main()

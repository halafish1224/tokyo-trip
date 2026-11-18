#!/usr/bin/env python3
"""Owner-authorized Tokyo sync direction gate. NEVER enables writes by date alone."""
import argparse
import datetime as dt
import json
import re
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
    if not isinstance(evidence,dict):
        raise ValueError("bidirectional activation requires verifiable evidence")
    if not re.fullmatch(r"[0-9a-f]{40}",str(evidence.get("approvedCommit",""))):
        raise ValueError("bidirectional activation requires a full approved Git commit SHA")
    if not re.fullmatch(r"[0-9a-f]{40}",str(evidence.get("sourceBlobSha",""))):
        raise ValueError("bidirectional activation requires a full source Git blob SHA")
    if not isinstance(evidence.get("sheetVersion"),str) or not evidence["sheetVersion"].strip():
        raise ValueError("bidirectional activation requires the verified Sheet revision")
    if type(evidence.get("conflictCount")) is not int or evidence["conflictCount"]!=0:
        raise ValueError("bidirectional activation requires zero unresolved cell conflicts")
    for field in ("mirrorVerified","nativeNotesPreserved","publicDataSanitized","approvedByOwner"):
        if evidence.get(field) is not True:
            raise ValueError("bidirectional activation requires verified approval: "+field)
    try:
        approved=dt.datetime.fromisoformat(evidence["readbackVerifiedAt"])
    except (ValueError,TypeError,KeyError) as exc:
        raise ValueError("bidirectional activation requires a valid readback timestamp") from exc
    if approved.tzinfo is None or approved<cutoff or approved>now:
        raise ValueError("bidirectional verification must be timestamped after cutover and before now")
    # This runtime gate validates evidence SHAPE and timing only. A source blob
    # must be verified against live trip.json when activating, but must not
    # be permanently pinned here: legitimate bidirectional site changes will
    # change that blob, and should not implicitly disable all later runs.
    # The connected writer must independently check live Sheet revision,
    # Git commit CAS, notes and approval before EACH write.
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

# Sheet-first synchronization

Source: 工作表1 A1:O100. Read the complete bounded range; the API may omit trailing blank rows. Do not equate fewer than 100 returned rows with a failed read. Verify the returned range, all 14 date columns, and fresh target CellData before writing. Q:S notes are outside the itinerary compiler; preserve them.

1. Read current main and the full Sheet range; keep private snapshots outside git.
2. Run `python scripts/plan_tokyo_sync.py --rows /private/rows.json`. Review every conflict. A missing/empty formerly populated cell now blocks automatic deletion. Resolve intentional deletions explicitly in a reviewed transaction, never by replacing the baseline first.
3. Sheet changes are primary for this authorized itinerary update. Preserve unrelated website edits. For dual edits, timestamps alone are insufficient: evidence must include cell-specific Sheet revision, website commit, hashes of both observed values, and timezone-aware timestamps. The connector must verify those references; the planner only validates their shape and binding. Otherwise stop for review.
4. Write only intended Sheet cells/notes, read back the full range, and verify all target values and untouched cells. Then compile and validate the staged bundle. Publish data, source code and staged baseline together using a compare-and-swap on main; a failed publication must not be reported as completed sync.
5. Verify the new main commit and published trip.json. Record actual verification results, not an assumed connector execution. The compiler's local baseline is provisional until the verified transaction is published.

`build_tokyo.py` already calls `protect_web_edits`; tests cover this gate. Date headers and deletion conflicts protect against common partial reads, but do not prove arbitrary remote responses complete. Never compile a truncated or errored response.

## Public data

Latin reservation names become initials (synthetic example: TEST PERSON NAME → T.P.N.). Preserve 網路訂位/已訂位 without asserting a new booking confirmation. Chinese names without an established romanization are omitted, not guessed. Personal contact information, codes, room numbers and private snapshots must not be committed. Public business phone/address and ordinary official booking pages are not automatically private.

Hashes cover public normalized values, not private originals. Different private strings may intentionally yield the same public output; do not require different redacted outputs to expose private distinctions. SHA-256 is not encryption. Introducing HMAC requires private key management and a separate migration; this update does not claim it exists.

## Display and research

Compiler emits `kind` (place/transit/info/reminder); local edited events use the UI fallback. 築地逛與午餐 is a summary. Transit events do not inherit an attraction merely because its name occurs in a transfer note. Current route maps fail closed on changed basis; never certify an old map by overwriting its basis alone.

Dec 20 Forest is removed; 3COINS Harajuku is the current stop. Blue Cave 2026 is unconfirmed, not declared cancelled. Dec 20 Oedo and Dec 25 Shintoyosu are optional market notes; Dec 25 Shiba remains the planned market. Official evidence checked 2026-10-14, in trip.json optionalEvents and matching Sheet notes. No tickets were purchased.

## Validation

`python -m unittest discover -s scripts -p 'test_tokyo_*.py'`

`node scripts/check_tokyo.cjs`

`node scripts/test_tokyo_dom.cjs` (requires jsdom)

Do not describe static tests as browser visual verification or a successful scheduled task. The daily connector schedule and Actions compiler are separate jobs; check their real execution logs when diagnosing automation.

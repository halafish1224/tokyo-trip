# Tokyo handbook maintenance

This trip uses `index.html` → `boot.js` → one validated `trip.json` → `app.js` → `extra.js`.
Do not generate a replacement HTML page with a language model. `extra.js` is the field-use, family-sharing, weather, journal and backup implementation; it must pass syntax and runtime checks together with `app.js`.

## Source and publishing

The source is Google Sheet 工作表1 A1:O100, read-only. The connected nightly content task enriches verified venues, route-specific notes, titles and correctly matched local covers. The separate 03:17 Asia/Taipei Actions compiler reads `GOOGLE_SHEET_CSV_URL` from repository Secrets; if absent, malformed or unavailable, it fails without replacing public data. Actions scheduling is best effort, not an exact-time guarantee. The content task runs around 02:00 Asia/Taipei and is the authoritative research workflow.

Run `python scripts/build_tokyo.py --rows /tmp/latest-sheet.json` with an authorized complete row snapshot, then `node scripts/check_tokyo.cjs`. The compiler retains source cell IDs, verifies all 14 dates, removes private identifiers and surfaces reservation-date conflicts. It never writes to the Sheet. Never commit the raw private Sheet snapshot.

For researched metadata, add `--enrichment /tmp/public-research.json`. This input may contain public venues, travel notes, decisions, sources, foods, places, guides keyed by full trip date, seniorStops, optionalEvents and the complete 14-entry covers array. Cover entries are accepted only for the matching date-based local path with complete Commons credit. It must not contain the private Sheet rows. Each guide records a route fingerprint; subsequent destination changes invalidate its old route explanation. Re-running unchanged rows and research must leave `trip.json` unchanged. Run `python scripts/test_tokyo_compiler.py` for reservation-time, stable-ID, privacy and closed-day regression checks.

The 2026/10/08 public research input `research/senior-stops.json` supplies route-anchored orange rest cards for 12/20–24, together with current route guides, decision actions, venue facts and the complete cover array. A changed Sheet row causes validation to fail instead of attaching a rest card to the wrong place. Meals with seating are not duplicated; 12/25 has no listed attraction to match. Seasonal opening and actual seats must be rechecked before travel. Forest of Lights is now a Sheet event on 12/23. Its separate information card explains the still unbooked time slot and 1.8-kilometre walk, while the orange pre-entry rest suggestion stays anchored to the Sheet row. The café inside SHIBUYA109 is an earlier rest stop; it is not an on-course refuge.

`trip.json` is the only runtime itinerary source. Do not reintroduce the baseline grid, the browser's stale grid cache, or a live Sheet CSV override. `archive.json` is loaded only on explicit request and contains old, non-authoritative reference data. Do not copy reservation names, codes, room numbers or insurance identifiers into public data. Noindex is indexing guidance, not authentication. Old Git history and older HTML snapshots are not access-controlled.

## Covers and verified content

All runtime covers must be under `images/covers/`, match the actual day's route, and include the original author, license and source. Existing `images/1213.webp` etc. are older annotated illustrations with mismatched days: do not use them for the current itinerary. Current cover photos are historical, never proof that 2026 illuminations are announced. `images/share.jpg` must remain a genuine local JPEG, not an external hotlink.

When a route changes, revise that day's title and cover together. If no suitable image can be lawfully obtained, keep a labelled previous cover or add a neutral atmosphere image; never pretend it depicts the destination. Do not put times, dates or store labels into newly generated covers. Every verified information item needs an official URL and checked date. Blank address/exit/phone fields must remain visibly unverified, not be guessed.

The two Maps lists claim 228 total source places. The public bundle currently has 18 text excerpts after one duplicate clock entry was merged. This is not a complete 228-place import. Only complete reads may replace a source list; failed or partial reads cannot delete notes. GPS requires finite coordinates and a `coordinateSource` URL plus checked date. Older unattested note coordinates remain outside distance calculations and cannot replace researched points. Wikipedia coordinate extracts are explicitly labelled non-official and do not identify entrances. Distances are approximate straight lines.

Venue `availability` rules describe only source-backed opening times or weekly closures, with optional date bounds. The compiler flags conflicts in red decisions and event warnings; it does not move a Sheet event or infer future train times. Reservation dates at the start of a cell remain visible even when their actual clock time is extracted.

## Offline and state

Geographic route illustrations for December 20–24 are reviewed snapshots in `images/routes/`. They appear below the daily cover, include independent scale bars, and open as local SVGs in a new tab. All five maps and their source records are in CORE. `DAY_ROUTE_MAPS` compares the full date's time/title basis before rendering; changed itineraries suppress the old illustration. Do not call `scripts/build_route_maps.py` in nightly compilation: review its dated coordinates, labels, candidates and route lines before intentionally renewing a snapshot. The changed December 20–23 routes suppress their old maps until new maps are separately reviewed. Their current rail and rest directions are in the dated guides and Sheet cells. Diagram connections are not road or timetable navigation.

Bump `sw.js` VERSION on any deployment changing application code, data or covers. CORE caches the text handbook and sharing assets; the explicit full-offline action also downloads all 14 covers, notes and local shopping photos. First visit must be online. Storage can be evicted by the OS: users should export a backup.

Weather is a dated seven-day forecast; selected December dates outside that window display no temperature. Cached forecasts show the original update time. Exchange rates are estimates, never bank sell rates.

Family links `?day=12-21&mode=family` show the public single-day route with no editing, local overrides or accounting state. They are not authenticated links. Full v4 backups include local overrides, photos, private notes, expenses and shopping checks. TT4 compressed codes exclude private notes, photos and custom routes; both must validate before import. Existing v3 local edits and IDs are preserved.

## Review checklist

Test 390px and desktop layouts, pre-trip date, in-trip Japan date, post-trip date, family link, diary status and photo, complete backup round trip, compressed-code round trip, no storage permission, forecast failure, GPS denial, offline reload after full cache, matching covers, and no visible Sheet editing links. Record what actually passed; do not report browser visual or offline tests as successful if only syntax/DOM checks ran.

# Tokyo handbook design review — 2026-10-17

What this change does: The 14-day overview now has a six-day Shonan chapter and an eight-day Tokyo chapter. Dates, places and public budget totals are easier to scan. The existing picture-book art, daily colors, large text, date bus and offline use stay in place.

Looks good. Ship.

Reviewed the changed renderers and styles, their callers in `app.js` and `picturebook.js`, the existing event handlers, family mode, the budget data, the offline cache and the maintenance instructions. This review assumes one personal travel handbook with 14 days, used on separate family devices. It is not a new multi-user editing service.

## Verification

- Chromium: 320, 390, 768 and 1440 CSS-pixel widths, each with compact, large and huge reading sizes. All four tabs and the December 23 route fit without document-wide horizontal scrolling.
- The two overview chapters contain six and eight days. Their buttons use the existing day IDs and navigation flow. Japanese-calendar dates and weekdays remain explicit.
- The public P1/P2 totals match `trip.json`. The estimate labels and exclusions stay visible. Actual expenses are still separate.
- Family mode opens the public budget summary and keeps personal accounting controls hidden.
- Real browser date-bus checks passed at 390 and 1280 pixels: forward/reverse motion, rapid changes, reduced motion, reading-size changes, selected-day heading clearance and missing-SVG fallback.
- A real full-cache/offline reload passed at 390 pixels, including the date bus. The service-worker version was changed for this release.
- DOM checks cover pre-trip, during-trip, post-trip and family views, existing backup state, all 14 overview destinations and both budget totals. Structure and service-worker tests also pass.
- No itinerary, price, insurance estimate, Sheet cell or stored-data key is changed by this release. No new runtime dependency or external font is added.

Not checked: physical phones, Safari and Firefox. This review does not certify a scheduled Sheet/GitHub sync or recheck travel prices.

## Design method

Taste's existing-project workflow was used: scan, diagnose, then improve the existing vanilla CSS/JavaScript. The changes reduce repeated heavy borders, add a clear date/place hierarchy, expose budget totals first, retain visible keyboard focus and honor reduced motion. The project's existing Huninn font and daily color coding were retained because they are established user requirements.

Ponytail Review was applied to the diff and connected code. No unresolved must-fix or should-fix issue was found. This is a review by the implementing assistant, not a separate human or independent agent review.

Sources read for this work:

- [Taste — redesign existing projects](https://github.com/Leonxlnx/taste-skill/blob/main/skills/redesign-skill/SKILL.md), blob `287737220e15cb226e5bd854f7098f698faaf3f0`.
- [Ponytail Review](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail-review/SKILL.md), blob `a50e3ac6ded6fccc9edae34ce37877bbce11e3fa`.

Verdict: Ship.

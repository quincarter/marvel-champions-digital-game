# Wave 7 QA: NeXt Evolution campaign client (story pages, retry Briefing)

Looked at in the browser on 2026-10-06 (Vite dev, 1440x900 and 390x844). Openers were read through the real comic
reader (Opener, `campaignId` + `nodeId`), aftermaths through the real Aftermath screen on a staged won game, retry and
Dossier through a staged run. Screenshots: scratchpad `campaign-client/` (`i<issue>-opener-b<beat>-<width>.png`,
`i<issue>-aftermath-b<beat>-<width>.png`, `i1-retry-briefing-*`, `dossier-*`, `finale-*`).
Staging added `seedNextEvolRun(service, stop)` to `packages/client/src/campaign/dev-fixtures.ts` (stops `fresh`,
`afterIssue1..4`, `lostIssue1`, `finished`); it is not listed on `__mcCampaign` in `main.ts` (spec loads it by import).

## 1. Story pages

Rectangles are on the page's 1800x1800 grid. "Fine" means the panel and its balloons are whole at both widths.

| Issue / beat              | Page file       | Verdict     | Note and suggested rect                                                                                          |
| ------------------------- | --------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| 1 opener 1-4              | 01-graymalkin   | fine        | whole panels, balloons intact                                                                                    |
| 2 opener 1                | 02-construction | fine        | wide strip: tiny text at 390                                                                                     |
| 2 opener 2                | 02-construction | crop is off | includes panel 1's inset and a cut balloon; visible part of the panel is y 515-875: `{x:120,y:515,w:1630,h:360}` |
| 2 opener 3                | 02-construction | fine        | sliver of panel 4's balloon at right; `w:930` would trim it                                                      |
| 2 opener 4                | 02-construction | crop is off | balloon "IN THE CONSTRUCTION SITE" loses its left end: `{x:1000,y:938,w:750,h:805}`                              |
| 3 opener 1                | 04-omaha        | crop is off | rect is half the panel (h 375 of ~740) and the caption's "S" is cut: `{x:30,y:55,w:430,h:740}`                   |
| 3 opener 2                | 04-omaha        | crop is off | half the panel, only ceiling and a balloon, no characters: `{x:480,y:55,w:500,h:740}`                            |
| 3 opener 3                | 04-omaha        | crop is off | half the panel (top of the BOOM): `{x:1010,y:55,w:735,h:740}`                                                    |
| 3 opener 4                | 04-omaha        | crop is off | starts at y 430 but the panel starts ~790, so the three small panels show above it: `{x:0,y:790,w:1800,h:1010}`  |
| 4 opener 1, 2             | 05-elevator     | fine        | thin white sliver at right of 2                                                                                  |
| 4 opener 3                | 05-elevator     | crop is off | bottom balloon "TEAM, WE'VE FOUND AN ELEVATOR" is cut off (panel runs to y ~1750): `{x:55,y:790,w:650,h:960}`    |
| 4 opener 4                | 05-elevator     | crop is off | Cable's and Hope's heads cut at the bottom: `{x:730,y:790,w:1020,h:960}`                                         |
| 5 opener 1                | 06-portal       | fine        | tall strip; text is small on desktop                                                                             |
| 5 opener 2, 3             | 06-portal       | crop is off | each includes the previous panel's edge and a cut balloon; 3 should start at x 830: `{x:830,y:142,w:262,h:1530}` |
| 5 opener 4                | 06-portal       | fine        |                                                                                                                  |
| Finale 1 (plaque inset)   | 08-xavier       | fine        | a thin strip of the main art at the right edge                                                                   |
| Finale 2 (whole page)     | 08-xavier       | fine        | small on phone, whole page is legible on desktop                                                                 |
| 1 aftermath (reuses 02#0) | 02-construction | fine        | same panel as 2 opener 1; reads as "the retreat"                                                                 |
| 2 aftermath 1-3           | 03-harpoon      | fine        | 2 has a small left wedge of panel 1                                                                              |
| 2 aftermath 4             | 03-harpoon      | crop is off | right sliver of panel 5's art: `{x:885,y:745,w:330,h:975}`                                                       |
| 2 aftermath 5             | 03-harpoon      | fine        | left strip of panel 4 shows with its balloon cut (same overlap)                                                  |
| 3 aftermath (reuses 05#0) | 05-elevator     | fine        | reads fine as "the house is searched"                                                                            |
| 4 aftermath (reuses 06#0) | 06-portal       | fine        | reads fine; very narrow strip on a wide screen                                                                   |
| 5 aftermath 1-4           | 07-stryfe-down  | not shown   | see finding 2; rects check out against the page                                                                  |

Counts (30 beats seen, not counting issue 5's unreachable aftermath): 19 fine, 11 crop is off, 0 wrong page. Worst three: 04-omaha beats 1-4 (half
panels, a missing caption letter, and a strip of neighbors), 05-elevator beats 3-4 (balloon and faces cut at the bottom),
02-construction beat 2 (panel 1's inset inside the frame).

Findings

1. Three aftermaths reuse the next issue's first panel (02#0, 05#0, 06#0). They read as a "next up" teaser, not as this
   issue's outcome; Juggernaut's and Mister Sinister's aftermath show a mission-start panel. Acceptable, but the
   boxes' own aftermath pages do not exist.
2. Issue 5's aftermath beats (07-stryfe-down) are never shown. `scenes/campaign/aftermath.ts` `#onFolded` goes straight
   to the Finale when the folded run is won, so `aftermathBeats` for the last issue is unreachable. Not fixed here.
3. On the Aftermath screen the "Logged / Removed" chips sit on top of the art at the top left, over the first balloon on
   desktop (02#0, 03#0) and over balloons on phone (03 beats 4, 5).
4. Wide strips (02 beats 1-2, aftermath of 1) and 06's tall strips are small at 390 and 1440 respectively; text is hard
   to read there.

## 2. Retry Briefing and Dossier

- Retry Briefing (`i1-retry-briefing-1440/390.png`): after `lostIssue1` the Side scheme section shows one row,
  "Establish Safehouse -> Safehouse Established", with a blue "SAME AS LAST TIME" line and its Scheme / Environment /
  Encounter chips, plus "Encounter cards added: 1 (Vanisher)". No PICK button and no other row. Open Issue #1 is
  enabled (pressing it leaves the Briefing). Verdict: fine at both widths.
  Small copy mismatch: the "Handled for you" first line still says "The group picks one player side scheme".
- Dossier after issue 1 won (scheme not defeated), Overview tab: "Establish Safehouse" is struck through with
  "X REMOVED"; the other five rows show OPEN. The Log tab lists both "Establish Safehouse removed" and "Safehouse
  Established removed" under issue 1. Issue 2's Briefing then offers the five remaining schemes; Open Issue stays
  disabled until one is picked. Verdict: fine.
- Pinned by `packages/client/e2e/next-evol-campaign-retry.spec.ts` (desktop).

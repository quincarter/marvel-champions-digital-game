# Design reference: seeing the canvases

## Start here: one PNG per screen

`artifacts/design-screenshots/` (added 2026-09-18 by the owner; regenerate with `pnpm capture:screens`, i.e. `scripts/capture-design-screenshots.mjs`, which needs Playwright and Chrome) holds **one full PNG per design screen**, which beats stitching the overlapping tiles described further down:

- `individual/screens-desktop.dc/NN-sNN.png` — D01–D14 (`01-s01` Title, `02-s02` Scenario select, `03-s03` Hero select, `04-s04` Deck check, `05-s05` Table setup, `06-s06` Setup deal & mulligan, then `s08`–`s14`; `14-14-collection` is Decks & Collection). There is no `s07`.
- `individual/screens-phone.dc/NN-pNN-<name>.png` — P01–P17, named (`04-p04-deck-check`, `12-p12-table-setup`, `16-p16-pause`, …).
- `individual/screens-tablet.dc/NN-tNN-<name>.png` — T01–T08.
- `board-long-table.dc.png`, `board-phone.dc.png`, `components.dc.png` and the three `screens-*.dc.png` — each whole canvas as one tall image; `manifest.json` lists every capture.

**The `Read` tool shows a PNG as an image.** Worktrees don't carry untracked files, so read these by absolute path from the main checkout. Open the screen you are building *before* writing layout code, and put your own screenshot beside it at the end.

## The older tile renders

The design canvases in `Marvel Champions game screens/` are `.dc.html` files driven by `support.js`. Nothing in an agent's toolset renders them, which is why past screen work matched the tokens and the widgets but not the *compositions* — the arrangement, grounds, proportions and hierarchy each screen actually has.

`scripts/render-design-canvases.sh` renders every canvas to PNG tiles in `docs/design-renders/` (gitignored; run the script once per checkout, it takes about a minute and needs Google Chrome). Each tile is a viewport-sized capture (1600 or 2000 px wide, 1200 px tall) at 1100 px steps, so consecutive tiles overlap by 100 px. **The `Read` tool shows a PNG as an image.** Worktrees don't carry the renders, so read them by absolute path from the main checkout.

## Tile index

Section heading → the tile it starts on. A section usually runs into the next tile too.

**`ScreensDesktop_NN.png`** (1600 wide)

| Section | Starts on tile |
|---|---|
| 00 Flow map | 00 |
| D01 Title | 00 (menu panel continues on 01) |
| D02 Scenario select | 01–02 |
| D03 Hero select | 02–03 |
| D04 Deck builder | 03–04 |
| D05 Table setup | 04–05 |
| D06 Setup deal & mulligan | 05–06 |
| D08 Card inspect | 06–07 |
| D09 Targeting | 07–08 |
| D10 Pending choice — defend | 08–09 |
| D11 Villain phase | 09–10 |
| D12 Game over | 10–11 |
| D13 Pause & rules | 11–12 |
| D14 Decks & collection | 12–13 |

**`ScreensPhone_NN.png`** (2000 wide; four phones per row, left to right)

| Row (tile) | Sections |
|---|---|
| 00 | P01 Title · P02 Scenario · P03 Hero select · P04 Deck check |
| 00–01 | P05 Table · threat · P06 Enemies · targeting · P07 Me · paying |
| 01–02 | P08 Team · P09 Villain phase · P10 Log & game over (P11 defeat beside it) |
| 02–03 | P12 Table setup · P13 Setup & mulligan · P14 Inspect card |
| 03–04 | P15 Pending choice · P16 Pause & rules · P17 Victory |

**`ScreensTablet_NN.png`** (2000 wide)

| Section | Starts on tile |
|---|---|
| L01 Landscape table | 00 |
| L02 Landscape · villain phase | 00–01 |
| T-P01 Portrait table · T-P02 Portrait setup (side by side) | 01–02 |
| L05 Setup & mulligan | 02–03 |
| L06 Inspect & target | 03–04 |
| L07 Pause & rules | 04–05 |
| L08 Victory | 05 |

**`BoardLongTable_00.png`**, **`BoardPhone_00.png`**: the whole board, one tile each (tile 01 is padding).

**`Components_NN.png`**

| Section | Starts on tile |
|---|---|
| 01 Palette · 02 Type | 00 |
| 03 Actions & states · 04 Parts for reuse | 01–02 |
| 05 Status tokens | 02–03 |
| 06 Design decisions | 03 |

## How a screen workstream uses this

1. **Look before building.** Read the tiles for every canvas that draws the screen (desktop, tablet *and* phone). Write down the composition in words in the view-model or layout file's header comment: which grounds (void / ink / paper / parchment / card), how the space is split, what is fixed vs. scrolling, where the one red action sits, what's dashed. That paragraph is the spec the layout function implements; `tokens.ts` already carries the palette, type roles and border weights.
2. **Content comes from `@mc/content`**, never from the mock's placeholder text (see `phase4-screen-gaps.md` §5).
3. **Prove it side by side.** Run the client (Vite from Bash on a free port) and screenshot the built screen at desktop (1440×900), tablet (1024×768 and 768×1024) and phone (390×844) beside the matching tile. Fix what differs in composition, grounds, hierarchy and density. Put the screenshots in the scratchpad and name them in the report — a workstream isn't "landed" until this comparison has been done and the remaining differences are written down.
4. Layout tests still assert no-overlap at those sizes; the screenshot pass is on top of them, not instead of them.

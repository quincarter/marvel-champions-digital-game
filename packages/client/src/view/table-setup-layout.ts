/**
 * Table setup (docs/phase4-screen-gaps.md §3 W2, D05/P12), composition read
 * off the owner's own D05 screenshot (2026-09-18 correction, which supersedes
 * the brief this module was first written against — see that correction's
 * full text for the exact wording, reproduced here as the composition this
 * layout implements):
 *
 * A full-width **ink** header bar: "◂ Seats" (Bangers), the Bangers page
 * title "Set the table", "STEP 4 OF 4" on the right — the same shape
 * Scenario select/Take your seats use.
 *
 * **Wide (desktop/tabletLandscape):** the ground below the header is
 * **paper**, split into a body column and a fixed ~300px full-height **ink**
 * sidebar inset 24px from the body's own top/right/bottom (`scenario-select-
 * layout.ts`'s own pattern, reused so the setup flow reads as one product).
 * The body stacks four sections, each a Bangers header + a full-bleed ink
 * rule (`ui/widgets.ts`'s `sectionHeader`), some carrying a right-aligned
 * label:
 *  - **DIFFICULTY** — up to three equal-width cards (Heroic stays out of
 *    scope, §4, so at most two are ever drawn against a three-wide row,
 *    leaving the third slot empty rather than stretching to fill it).
 *  - **MODULAR SETS** ("N REQUIRED · N CHOSEN") — a wrapped grid, the
 *    scenario's own required set(s) first (ink-filled, not toggleable),
 *    then every candidate modular set.
 *  - **SEATING & FIRST PLAYER** — one row of seat cards, with a small quiet
 *    "Random" control on the header's own line.
 *  - **THE ENCOUNTER DECK YOU'RE BUILDING** ("N CARDS · SHUFFLED AT DEAL")
 *    — three equal bordered panels (Composition / What's in there / Nemesis
 *    sets held back) filling the rest of the body's own height.
 *
 * The sidebar carries "THE GAME YOU'LL GET" (six label/value rows), a rule,
 * the seed field with Reroll and its own helper text, and the single red
 * "Deal it out" pinned at the sidebar's own foot.
 *
 * **Narrow (phone/tabletPortrait), read against the owner's own P12
 * screenshot and the coordinator's tablet-portrait note ("adapt D05: portrait
 * stacks it under the body with DEAL IT OUT in a sticky footer"):** no room
 * for a second column, so the whole screen is one **ink** ground and one
 * column (`title-menu-layout.ts`'s own "no split" convention), and every
 * section is drawn compactly rather than at the wide layout's own card sizes
 * — P12 draws Modular sets and First player as dense list/row controls, not
 * the wide layout's description cards, and this module follows that same
 * compaction for Difficulty too, for the same reason (P12 doesn't carry a
 * difficulty picker at all, but the setup flow needs one on every form
 * factor — dropping a legal choice on one device would be the client
 * inventing a rule, so it stays, just compact). Seating draws as **one**
 * horizontal row of small cards, Random included as its own dashed cell (P12
 * embeds it in the row; the wide layout, per the owner's correction, keeps it
 * on the section-header line instead — two different homes for the same
 * control, each matching its own screenshot).
 *
 * Difficulty, modular sets and seating stay at their full, real, functional
 * sizes — they're controls, never trimmed. "Deal it out" pins to the
 * screen's own foot as a sticky footer, like the board's action bar
 * ("content scrolls under the bar", `view/layout.ts`). Whatever vertical
 * room is left above it goes to the encounter-deck panels first and then the
 * game-summary block, **laid out sequentially** — the panels get their real
 * height (trimmed row-first, down to zero rows, never negative), then the
 * summary block starts exactly where the panels actually ended, so the two
 * can never overlap by construction (a fixed pre-split of the same room, tried
 * first, could let one block's real minimum height run into the other's
 * fixed start — this doesn't have that failure mode). On a wide-enough
 * narrow viewport (tablet portrait) the three panels still sit side by side,
 * exactly like the wide layout; only true phone width stacks them.
 */
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";
import { hit } from "../tokens.js";
import { LABEL_ROOM, setupMetrics } from "./setup-metrics.js";

export const HEADER_HEIGHT = 64;
export const GUTTER = 24;
export const SIDEBAR_WIDTH = 300;
/** A section's own Bangers-title-plus-rule row (drawn by `ui/widgets.ts`'s `sectionHeader`, top-aligned at this height). */
export const SECTION_HEADER_HEIGHT = 26;
export const SECTION_GAP = 20;
export const ROW_GAP = 8;
/** A difficulty card: a Bangers name plus one wrapped description line. Wide only — narrow uses `NARROW_DIFFICULTY_CARD_HEIGHT`. */
export const DIFFICULTY_CARD_HEIGHT = 76;
/** A modular-set / required-set card: a Bangers name plus one label line. Wide only — narrow uses `NARROW_MODULAR_CARD_HEIGHT`. */
export const MODULAR_CARD_HEIGHT = 58;
const MODULAR_CARD_MIN_WIDTH = 170;
/** A seat card: a radio dot, the hero's name, and a small "FIRST PLAYER"/"SEAT N" label. Wide only — narrow uses `NARROW_SEATING_CARD_HEIGHT`. */
export const SEAT_CARD_HEIGHT = 60;
/** One row inside a description-only panel (Composition / What's in there / Nemesis / the sidebar's own summary rows). */
export const PANEL_ROW_HEIGHT = 18;
export const PANEL_HEADER_HEIGHT = 22;
export const PANEL_PAD = 10;
export const GAME_SUMMARY_ROW_COUNT = 6;

// Narrow (phone/tabletPortrait) is compact throughout (P12's own dense list/row treatment) — exported so the
// scene's own cell math (`modularGrid.height` divided into `modularRows` cells, say) uses exactly the same
// numbers this layout was computed with, rather than a second, potentially-drifting copy of them.
// 66/64 (not 52/50): a difficulty card's description ("Standard encounter set only. Starts at stage I.") and a
// modular card's label ("Chosen · 6 cards · Treacheries") both wrap to two lines at a phone-width card
// (`docs/design-renders` fidelity pass, 2026-09-18 — 52/50 clipped the description to one word and let the
// modular label's second line spill past its own card into whatever sat below it).
export const NARROW_DIFFICULTY_CARD_HEIGHT = 66;
export const NARROW_MODULAR_CARD_HEIGHT = 64;
export const NARROW_MODULAR_GRID_GAP = 6;
export const NARROW_SEATING_CARD_HEIGHT = 56;

export interface TableSetupLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly difficultyCount: number;
  /** Every card the modular-set section draws: the scenario's own required set(s) plus every candidate. */
  readonly modularCardCount: number;
  readonly seatCount: number;
  readonly compositionRows: number;
  readonly whatsInThereRows: number;
  /** The nemesis panel's own body: 0 when there's nothing held back (the panel still gets its header), else the wrapped sentence's line count plus one for the "N CARDS ON STANDBY" foot line. */
  readonly nemesisLines: number;
}

export interface EncounterPanelsLayout {
  readonly composition: Rect;
  readonly whatsInThere: Rect;
  readonly nemesis: Rect;
  /** How many body rows each panel actually has room to draw, after this layout's own trimming — the scene draws exactly this many and a "+N more" for the rest. Composition/whatsInThere/nemesis, in that order. */
  readonly rowBudgets: readonly [number, number, number];
}

export interface TableSetupLayout {
  readonly formFactor: FormFactor;
  readonly wide: boolean;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  /** The ink sidebar (wide) — null on narrow, where its content joins the single column instead. */
  readonly sidebar: Rect | null;
  readonly difficultyHeader: Rect;
  readonly difficultyRow: Rect;
  readonly modularHeader: Rect;
  readonly seatingHeader: Rect;
  /**
   * The "Random" control. On `wide` it sits on the seating header's own line
   * (the owner's correction: "the tile has none, we need it") and
   * `seatingRow` holds exactly `seatCount` cells. On narrow it's zero-area
   * (unused) — P12 draws Random as the seat row's own extra dashed cell
   * instead, so the scene splits `seatingRow` into `seatCount + 1` cells
   * there and never reads this field.
   */
  readonly randomControl: Rect;
  readonly modularGrid: Rect;
  readonly modularColumns: number;
  readonly modularRows: number;
  readonly seatingRow: Rect;
  readonly encounterHeader: Rect;
  readonly encounterPanels: EncounterPanelsLayout;
  /** "THE GAME YOU'LL GET": header, then `GAME_SUMMARY_ROW_COUNT` label/value rows. */
  readonly gameSummaryHeader: Rect;
  readonly gameSummaryRows: Rect;
  readonly rule: Rect;
  readonly seed: Rect;
  readonly reroll: Rect;
  /** Room for the seed field's own helper text, right under it — empty (zero height) when there's no room at all. */
  readonly seedHelper: Rect;
  readonly dealItOut: Rect;
}

/**
 * Every drawn *content* region, for a no-overlap test — deliberately excludes `sidebar` itself (wide only), which
 * is the ink ground every sidebar row is meant to sit inside, not content to keep clear of (`bodyPanel` got the
 * same exclusion before this module's rewrite).
 */
export function tableSetupLayoutRects(layout: TableSetupLayout): readonly Rect[] {
  const rects: Rect[] = [
    layout.back,
    layout.step,
    layout.difficultyHeader,
    layout.difficultyRow,
    layout.modularHeader,
    layout.modularGrid,
    layout.seatingHeader,
    layout.randomControl,
    layout.seatingRow,
    layout.encounterHeader,
    layout.encounterPanels.composition,
    layout.encounterPanels.whatsInThere,
    layout.encounterPanels.nemesis,
    layout.gameSummaryHeader,
    layout.gameSummaryRows,
    layout.rule,
    layout.seed,
    layout.reroll,
    layout.seedHelper,
    layout.dealItOut,
  ];
  return rects;
}

/** How many columns the modular grid gets at `width`: as many `MODULAR_CARD_MIN_WIDTH`-wide cards as fit, 4 at most (D05's own "~4 per row"), 1 at least. */
function modularColumnsFor(width: number): number {
  return Math.max(1, Math.min(4, Math.floor((width + ROW_GAP) / (MODULAR_CARD_MIN_WIDTH + ROW_GAP))));
}

/** Shrinks `rowCounts` (in place, by index) one row at a time — always from whichever budget is currently largest — until their combined height (`rowCounts.reduce + headers*eachHeaderHeight`) fits `maxHeight`, or every budget has hit `floor`. Mirrors the single-panel version this module used before the correction, generalized to more than one panel at once so no one panel is starved while another still has rows to give up. */
function trimRowBudgets(rowCounts: number[], rowHeight: number, floor: number, fixedHeight: number, maxHeight: number): void {
  const totalHeight = (): number => fixedHeight + rowCounts.reduce((sum, n) => sum + n * rowHeight, 0);
  while (totalHeight() > maxHeight && rowCounts.some((n) => n > floor)) {
    let maxIndex = 0;
    for (let i = 1; i < rowCounts.length; i++) if (rowCounts[i]! > rowCounts[maxIndex]!) maxIndex = i;
    if (rowCounts[maxIndex]! <= floor) break;
    rowCounts[maxIndex]! -= 1;
  }
}

function wideLayout(input: TableSetupLayoutInput, formFactor: FormFactor): TableSetupLayout {
  const { width, height } = input;
  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 90;
  const stepWidth = Math.min(160, Math.max(90, width * 0.28));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  const bodyTop = HEADER_HEIGHT + GUTTER;
  const bodyBottom = height - GUTTER;
  const sidebar: Rect = { x: width - GUTTER - SIDEBAR_WIDTH, y: bodyTop, width: SIDEBAR_WIDTH, height: bodyBottom - bodyTop };
  const bodyLeft = GUTTER;
  const bodyWidth = sidebar.x - GUTTER - bodyLeft;

  let y = bodyTop;
  const difficultyHeader: Rect = { x: bodyLeft, y, width: bodyWidth, height: SECTION_HEADER_HEIGHT };
  y += SECTION_HEADER_HEIGHT + 8;
  const difficultyRow: Rect = { x: bodyLeft, y, width: bodyWidth, height: DIFFICULTY_CARD_HEIGHT };
  y += DIFFICULTY_CARD_HEIGHT + SECTION_GAP;

  const modularHeader: Rect = { x: bodyLeft, y, width: bodyWidth, height: SECTION_HEADER_HEIGHT };
  y += SECTION_HEADER_HEIGHT + 8;
  const modularColumns = modularColumnsFor(bodyWidth);
  const modularRows = Math.max(1, Math.ceil(input.modularCardCount / modularColumns));
  const modularGrid: Rect = { x: bodyLeft, y, width: bodyWidth, height: modularRows * MODULAR_CARD_HEIGHT + (modularRows - 1) * ROW_GAP };
  y += modularGrid.height + SECTION_GAP;

  const randomWidth = 90;
  const seatingHeader: Rect = { x: bodyLeft, y, width: bodyWidth - randomWidth - 10, height: SECTION_HEADER_HEIGHT };
  const randomControl: Rect = { x: bodyLeft + bodyWidth - randomWidth, y, width: randomWidth, height: SECTION_HEADER_HEIGHT };
  y += SECTION_HEADER_HEIGHT + 8;
  const seatingRow: Rect = { x: bodyLeft, y, width: bodyWidth, height: SEAT_CARD_HEIGHT };
  y += SEAT_CARD_HEIGHT + SECTION_GAP;

  const encounterHeader: Rect = { x: bodyLeft, y, width: bodyWidth, height: SECTION_HEADER_HEIGHT };
  y += SECTION_HEADER_HEIGHT + 8;
  const panelsTop = y;
  const panelsHeight = Math.max(PANEL_HEADER_HEIGHT + PANEL_ROW_HEIGHT, bodyBottom - panelsTop);
  const panelGap = 16;
  const panelWidth = (bodyWidth - panelGap * 2) / 3;
  const composition: Rect = { x: bodyLeft, y: panelsTop, width: panelWidth, height: panelsHeight };
  const whatsInThere: Rect = { x: bodyLeft + panelWidth + panelGap, y: panelsTop, width: panelWidth, height: panelsHeight };
  const nemesis: Rect = { x: bodyLeft + (panelWidth + panelGap) * 2, y: panelsTop, width: panelWidth, height: panelsHeight };
  const bodyRows = Math.max(0, Math.floor((panelsHeight - PANEL_HEADER_HEIGHT - PANEL_PAD) / PANEL_ROW_HEIGHT));
  const rowBudgets: readonly [number, number, number] = [Math.min(bodyRows, input.compositionRows), Math.min(bodyRows, input.whatsInThereRows), Math.min(bodyRows, input.nemesisLines)];

  // Sidebar content.
  const inset = 16;
  const sLeft = sidebar.x + inset;
  const sWidth = sidebar.width - inset * 2;
  let sy = sidebar.y + inset + SECTION_HEADER_HEIGHT + 8;
  const gameSummaryHeader: Rect = { x: sLeft, y: sidebar.y + inset, width: sWidth, height: SECTION_HEADER_HEIGHT };
  const gameSummaryRows: Rect = { x: sLeft, y: sy, width: sWidth, height: GAME_SUMMARY_ROW_COUNT * PANEL_ROW_HEIGHT };
  sy += gameSummaryRows.height + 14;
  const rule: Rect = { x: sLeft, y: sy, width: sWidth, height: 1 };
  sy += 14;
  const rerollWidth = 96;
  const seedWidth = sWidth - rerollWidth - 10;
  const seed: Rect = { x: sLeft, y: sy, width: seedWidth, height: hit.target };
  const reroll: Rect = { x: sLeft + seedWidth + 10, y: sy, width: rerollWidth, height: hit.target };
  sy += hit.target + 6;
  const dealItOut: Rect = { x: sLeft, y: sidebar.y + sidebar.height - inset - hit.primary, width: sWidth, height: hit.primary };
  const seedHelperHeight = Math.max(0, dealItOut.y - 6 - sy);
  const seedHelper: Rect = { x: sLeft, y: sy, width: sWidth, height: seedHelperHeight };

  return {
    formFactor,
    wide: true,
    headerBar,
    back,
    step,
    sidebar,
    difficultyHeader,
    difficultyRow,
    modularHeader,
    seatingHeader,
    randomControl,
    modularGrid,
    modularColumns,
    modularRows,
    seatingRow,
    encounterHeader,
    encounterPanels: { composition, whatsInThere, nemesis, rowBudgets },
    gameSummaryHeader,
    gameSummaryRows,
    rule,
    seed,
    reroll,
    seedHelper,
    dealItOut,
  };
}

/** Below this column width the three encounter panels stack full-width instead of sitting side by side (tablet portrait's own 688px-ish column comfortably holds three ~220px panels; a phone's ~358px-360px does not). */
const NARROW_PANELS_SIDE_BY_SIDE_MIN = 560;

function narrowLayout(input: TableSetupLayoutInput, formFactor: FormFactor): TableSetupLayout {
  const { width, height } = input;
  const { pad } = setupMetrics(width, height);
  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 12;
  const backWidth = 70;
  const stepWidth = Math.min(120, Math.max(70, width * 0.26));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  const left = pad;
  const column = width - pad * 2;
  const dealItOut: Rect = { x: left, y: height - pad - hit.primary, width: column, height: hit.primary };
  const gap = 12;

  // Mandatory blocks — real controls, drawn at a real, functional size regardless of how little room is left.
  // Compact throughout (P12's own dense list/row treatment), not the wide layout's roomier cards.
  let y = HEADER_HEIGHT + pad;
  const difficultyHeader: Rect = { x: left, y, width: column, height: SECTION_HEADER_HEIGHT };
  y += SECTION_HEADER_HEIGHT + 6;
  const difficultyRow: Rect = { x: left, y, width: column, height: NARROW_DIFFICULTY_CARD_HEIGHT };
  y += difficultyRow.height + gap;

  const modularHeader: Rect = { x: left, y, width: column, height: SECTION_HEADER_HEIGHT };
  y += SECTION_HEADER_HEIGHT + 6;
  const modularColumns = modularColumnsFor(column);
  const modularRows = Math.max(1, Math.ceil(input.modularCardCount / modularColumns));
  const modularGrid: Rect = { x: left, y, width: column, height: modularRows * NARROW_MODULAR_CARD_HEIGHT + (modularRows - 1) * NARROW_MODULAR_GRID_GAP };
  y += modularGrid.height + gap;

  // Seating: one horizontal row (P12's own "FIRST PLAYER" row), Random as the row's own extra dashed cell — no
  // header-line control here, unlike `wideLayout`'s (the owner's correction was written against D05, which has no
  // Random control at all yet; P12 already draws one as part of the row, so there's nothing to add on the header
  // line on narrow).
  const seatingHeader: Rect = { x: left, y, width: column, height: SECTION_HEADER_HEIGHT };
  const randomControl: Rect = { x: left, y, width: 0, height: 0 };
  y += SECTION_HEADER_HEIGHT + 6;
  const seatingRow: Rect = { x: left, y, width: column, height: NARROW_SEATING_CARD_HEIGHT };
  y += seatingRow.height + gap;

  const mandatoryBottom = y;
  const seedHeight = hit.target;
  const rerollWidth = 96;
  const seedWidth = column - rerollWidth - 10;
  const seedY = dealItOut.y - 10 - seedHeight;
  const roomAbove = Math.max(0, seedY - gap - mandatoryBottom);

  // The two flexible, description-only blocks are laid out **sequentially**, each starting exactly where the
  // previous one actually ended — so the two can never overlap by construction, unlike computing both from a
  // fixed up-front split of `roomAbove` (tried first; a block's real minimum height could run past its own
  // share and into whatever a *different*, independently-positioned rect assumed was clear).
  //
  // The game-summary block goes first and gets first claim on the room: six short label/value facts (villain,
  // threat, deck size…) answer "what am I about to play", which matters more on a cramped phone than the
  // per-set composition breakdown below it — so summary rows trim last, encounter-panel rows trim first. But
  // summary is capped at `roomAbove` *minus the encounter section's own absolute floor* (its two headers plus
  // every panel at zero rows), so a summary greedy for all six rows can never itself starve the encounter
  // section below the one thing it can't shrink past — its own headers and empty panel frames.
  const panelGap = 8;
  const sideBySide = column >= NARROW_PANELS_SIDE_BY_SIDE_MIN;
  const perPanelFixed = PANEL_HEADER_HEIGHT + PANEL_PAD;
  const encounterFloor = SECTION_HEADER_HEIGHT + 6 + (sideBySide ? perPanelFixed : perPanelFixed * 3 + panelGap * 2);

  const gameSummaryHeader: Rect = { x: left, y: mandatoryBottom, width: column, height: SECTION_HEADER_HEIGHT };
  const summaryCap = Math.max(0, roomAbove - gap - encounterFloor);
  const summaryRoomLeft = Math.max(0, summaryCap - SECTION_HEADER_HEIGHT - 6);
  const summaryRowsAvailable = Math.max(0, Math.min(GAME_SUMMARY_ROW_COUNT, Math.floor((summaryRoomLeft - 1 - 6) / PANEL_ROW_HEIGHT)));
  const gameSummaryRows: Rect = { x: left, y: mandatoryBottom + SECTION_HEADER_HEIGHT + 6, width: column, height: summaryRowsAvailable * PANEL_ROW_HEIGHT };
  const rule: Rect = { x: left, y: gameSummaryRows.y + gameSummaryRows.height + 6, width: column, height: 1 };

  const encounterTop = rule.y + rule.height + gap;
  const encounterHeader: Rect = { x: left, y: encounterTop, width: column, height: SECTION_HEADER_HEIGHT };
  const panelsTop = encounterTop + SECTION_HEADER_HEIGHT + 6;
  const encounterCap = Math.max(0, seedY - gap - panelsTop);

  const rowCounts = [input.compositionRows, input.whatsInThereRows, input.nemesisLines];
  let composition: Rect;
  let whatsInThere: Rect;
  let nemesis: Rect;
  if (sideBySide) {
    // Side by side, all three panels share one row height (the tallest content decides it, same as `wideLayout`'s
    // own fixed-height panels) — so what's trimmed is that one shared row budget, not three independent ones.
    let sharedRows = Math.max(...rowCounts);
    while (sharedRows > 0 && perPanelFixed + sharedRows * PANEL_ROW_HEIGHT > encounterCap) sharedRows -= 1;
    rowCounts[0] = Math.min(rowCounts[0]!, sharedRows);
    rowCounts[1] = Math.min(rowCounts[1]!, sharedRows);
    rowCounts[2] = Math.min(rowCounts[2]!, sharedRows);
    const panelHeight = Math.max(perPanelFixed, perPanelFixed + sharedRows * PANEL_ROW_HEIGHT);
    const panelWidth = (column - panelGap * 2) / 3;
    composition = { x: left, y: panelsTop, width: panelWidth, height: panelHeight };
    whatsInThere = { x: left + panelWidth + panelGap, y: panelsTop, width: panelWidth, height: panelHeight };
    nemesis = { x: left + (panelWidth + panelGap) * 2, y: panelsTop, width: panelWidth, height: panelHeight };
  } else {
    trimRowBudgets(rowCounts, PANEL_ROW_HEIGHT, 0, perPanelFixed * 3 + panelGap * 2, encounterCap);
    const panelHeights = rowCounts.map((rows) => perPanelFixed + rows * PANEL_ROW_HEIGHT);
    let py = panelsTop;
    composition = { x: left, y: py, width: column, height: panelHeights[0]! };
    py += panelHeights[0]! + panelGap;
    whatsInThere = { x: left, y: py, width: column, height: panelHeights[1]! };
    py += panelHeights[1]! + panelGap;
    nemesis = { x: left, y: py, width: column, height: panelHeights[2]! };
  }

  const seed: Rect = { x: left, y: seedY, width: seedWidth, height: seedHeight };
  const reroll: Rect = { x: left + seedWidth + 10, y: seedY, width: rerollWidth, height: seedHeight };
  const seedHelper: Rect = { x: left, y: 0, width: column, height: 0 };

  // A final defensive clamp, not a normal case: on a viewport shorter than any this module was designed against
  // (below the "short desktop"/"very short" cases its own tests cover), the flexible blocks' own *fixed* overhead
  // (two section headers, three panel frames) can exceed `roomAbove` even at zero rows everywhere, which would
  // otherwise push the sequential flow past `seed`'s pinned position — a fixed, non-negotiable control — and
  // overlap it. Every rect below `seedY - gap` is capped there; nothing above `mandatoryBottom` is touched, so
  // the real controls (Difficulty/Modular/Seating/Deal it out) are never affected, only how much of the
  // descriptive tail is actually visible.
  // Never less than `mandatoryBottom`: on a viewport short enough that even the *mandatory* blocks alone reach past
  // where `seed` is pinned (`limit < mandatoryBottom`), collapsing a flexible rect to `y: limit` would pull it
  // backward past `seatingRow`'s own end — trading one overlap (with `seed`) for another (with a mandatory
  // control). Clamping to whichever is later keeps every flexible rect at or after `mandatoryBottom`, where the
  // sequential flow itself already starts.
  const limit = Math.max(seedY - gap, mandatoryBottom);
  // A zero-height rect still registers as "overlapping" (`rectsOverlap`'s own strict inequalities) anything whose
  // y-range it sits strictly inside, so a collapsed rect's `y` is pulled back to `limit` too, not left wherever
  // the sequential flow originally put it — a point exactly at another rect's own edge never overlaps it.
  const clampBottom = (r: Rect): Rect => (r.y >= limit ? { ...r, y: limit, height: 0 } : r.y + r.height > limit ? { ...r, height: limit - r.y } : r);

  return {
    formFactor,
    wide: false,
    headerBar,
    back,
    step,
    sidebar: null,
    difficultyHeader,
    difficultyRow,
    modularHeader,
    seatingHeader,
    randomControl,
    modularGrid,
    modularColumns,
    modularRows,
    seatingRow,
    encounterHeader: clampBottom(encounterHeader),
    encounterPanels: {
      composition: clampBottom(composition),
      whatsInThere: clampBottom(whatsInThere),
      nemesis: clampBottom(nemesis),
      rowBudgets: [rowCounts[0]!, rowCounts[1]!, rowCounts[2]!],
    },
    gameSummaryHeader: clampBottom(gameSummaryHeader),
    gameSummaryRows: clampBottom(gameSummaryRows),
    rule: clampBottom(rule),
    seed,
    reroll,
    seedHelper,
    dealItOut,
  };
}

export function tableSetupLayout(input: TableSetupLayoutInput): TableSetupLayout {
  const formFactor = formFactorFor(input.width, input.height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  return wide ? wideLayout(input, formFactor) : narrowLayout(input, formFactor);
}

export { LABEL_ROOM };

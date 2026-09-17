/**
 * Title's own layout, as a pure function — the same "layout function the
 * scene uses" a plain-TS test can check for overlap
 * (docs/phase4-screen-gaps.md §2 "S8", "the search and the list share one
 * layout function with the rest of the screen, and a test checks the list's
 * viewport never overlaps the controls above or below it").
 *
 * **Rows are plain (no card art)** for both the scenario and hero rosters,
 * unlike the picker this replaced. That's a deliberate simplification: a
 * fixed-height text row (`ROW_HEIGHT`) makes every section's height a
 * constant, so this function needs no text measurement (which needs a live
 * Phaser scene) to decide how tall anything is — every rect below is
 * computable from `width`/`height` alone, which is what makes it plain-TS
 * testable in the first place. Reading a card's own art is still one press
 * away (Inspect, `I` / long-press), the same as every other blocked or
 * inspectable row already worked.
 *
 * **Quick-filter chips** (S8) get their own strip (`scenarioChips`,
 * `heroChips`) between each search field and its list. A chip strip's own
 * *row count* is decided outside this module (`view/chip-layout.ts`'s
 * `wrapChipsToRows`, over `contentColumnWidth`) — this module only turns
 * that count into a rect, via `chipStripHeight`. Splitting it this way keeps
 * `titleLayout` free of chip *labels* (it would need `@mc/content` and the
 * scene's own filter state to know those) while staying exactly as testable
 * as everything else here.
 *
 * **The list viewport flexes to fit the viewport height, in whole rows.**
 * Every fixed-height control here (search fields, chip strips, difficulty,
 * seed, Start) adds up to more than a short viewport's own height before the
 * two rosters even get a single row — a real bug found in the browser at
 * 800×600, where Start game landed below the fold with no way to reach it,
 * and (less severely) at 375×812. Rather than guess a set of breakpoints
 * that happens to fit today's exact copy and control set, `titleLayout` lays
 * out once at the full `LIST_VISIBLE_ROWS`, measures how far `start`'s
 * bottom edge would land past `height`, and removes exactly enough whole
 * rows from *each* roster (never below one row — a list still scrolls for
 * the rest, `ui/virtual-list.ts`) to bring it back inside the viewport. This
 * guarantees Start stays reachable at any height that has room for the fixed
 * chrome plus one row per roster; below that hard floor no pure layout fix
 * exists short of scrolling the whole page, which is out of scope here.
 * `titleLayoutRects`'s "every rect stays within the screen bounds" test
 * exercises the same invariant.
 */
import { hit } from "../tokens.js";
import { chipStripHeight } from "./chip-layout.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export const ROW_HEIGHT = hit.target;
export const LIST_VISIBLE_ROWS = 3;
export const LIST_HEIGHT = LIST_VISIBLE_ROWS * ROW_HEIGHT;

/**
 * How many multiples of `titleSize` the two-line "MARVEL / CHAMPIONS" logo
 * needs before the next label — found wanting in the browser: the "Scenario"
 * label overlapped the bottom of "CHAMPIONS" at every size checked (375×812,
 * 800×600, 1280×1000). Phaser's own two-line text height (no live canvas
 * here to measure it, per this module's own "no text measurement" rule
 * above) runs close to `2.2×` the font size for Bangers' metrics plus the
 * title's own negative `lineSpacing`; `2.35` adds a deliberate margin on top
 * of that rather than the exact number, since a slightly generous gap here
 * costs far less than another round of "still overlapping".
 */
const TITLE_BLOCK_RATIO = 2.35;

/** How far above its control a section label ("Scenario", "Difficulty"…) is drawn, and so the least room the layout leaves for one. */
export const LABEL_ROOM = 16;

/** Below this height, spacing (not control sizes — a 44px touch target never shrinks) compacts further; see `titleLayout`'s "the list viewport flexes" note. */
const SHORT_HEIGHT = 700;

function metricsFor(width: number, height: number): { readonly formFactor: FormFactor; readonly phone: boolean; readonly short: boolean; readonly pad: number; readonly gap: number; readonly labelGap: number; readonly smallGap: number } {
  const formFactor = formFactorFor(width, height);
  const phone = formFactor === "phone";
  const short = height < SHORT_HEIGHT;
  return {
    formFactor,
    phone,
    short,
    pad: phone ? 16 : short ? 12 : height < 820 ? 24 : 40,
    gap: phone ? 12 : short ? 8 : 18,
    // Never below LABEL_ROOM: a section label is drawn `LABEL_ROOM` above its control (`scenes/title.ts`), so a
    // smaller gap slides it under the control before it — seen in the browser at 800×600.
    labelGap: LABEL_ROOM,
    smallGap: short ? 2 : 8,
  };
}

/**
 * The content column's width alone — everything else in `titleLayout` stacks
 * vertically inside it. Exposed so a caller can decide how many rows a chip
 * strip needs (`view/chip-layout.ts`'s `wrapChipsToRows`) *before* calling
 * `titleLayout`, from the same width this module itself would compute.
 */
export function contentColumnWidth(width: number, height: number): number {
  const { pad } = metricsFor(width, height);
  return Math.min(width - pad * 2, 640);
}

export interface TitleLayoutInput {
  readonly width: number;
  readonly height: number;
  /** A saved game adds a "Continue" row above everything else. */
  readonly continuable: boolean;
  /** How many rows the Scenario roster's quick-filter chips need (`view/chip-layout.ts`'s `wrapChipsToRows(...).length`, over `contentColumnWidth`). */
  readonly scenarioChipRows: number;
  /** Same, for the Heroes roster's chips. */
  readonly heroChipRows: number;
}

export interface TitleLayout {
  readonly formFactor: FormFactor;
  readonly pad: number;
  readonly left: number;
  readonly column: number;
  /** The logo's font size — the scene draws with this rather than re-deriving it. */
  readonly titleSize: number;
  readonly titleBlockHeight: number;
  readonly continueRow: Rect | null;
  readonly scenarioSearch: Rect;
  /** S8's quick-filter chips (product), between the search field and the list. May be more than one row tall (`TitleLayoutInput.scenarioChipRows`). */
  readonly scenarioChips: Rect;
  readonly scenarioList: Rect;
  readonly difficulty: Rect;
  readonly heroSearch: Rect;
  /** S8's quick-filter chips (aspect, source, "playable now"), between the search field and the list. May be more than one row tall (`TitleLayoutInput.heroChipRows`). */
  readonly heroChips: Rect;
  readonly heroList: Rect;
  /** How many rows `scenarioList`/`heroList` actually got, after the fit pass below — `LIST_VISIBLE_ROWS` unless the viewport was too short for that many. */
  readonly listRows: number;
  /** A row of its own, phone only — wider layouts share the seed row (`manageDecksInline`). */
  readonly manageDecksRow: Rect | null;
  readonly seed: Rect;
  readonly newSeed: Rect;
  readonly manageDecksInline: Rect | null;
  readonly start: Rect;
}

/** Every rect this layout places, in the order a screen reader of the layout (or a test) would want to check pairwise. */
export function titleLayoutRects(layout: TitleLayout): readonly Rect[] {
  return [
    ...(layout.continueRow ? [layout.continueRow] : []),
    layout.scenarioSearch,
    layout.scenarioChips,
    layout.scenarioList,
    layout.difficulty,
    layout.heroSearch,
    layout.heroChips,
    layout.heroList,
    ...(layout.manageDecksRow ? [layout.manageDecksRow] : []),
    layout.seed,
    layout.newSeed,
    ...(layout.manageDecksInline ? [layout.manageDecksInline] : []),
    layout.start,
  ];
}

/** True when two rects share any pixel. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Builds the full layout at a specific `listRows` count — `titleLayout` below calls this twice (see its own doc comment: lay out once at the max, then again at whatever fits). */
function layoutAt(input: TitleLayoutInput, listRows: number): TitleLayout {
  const { width, height } = input;
  const { formFactor, phone, short, pad, gap, labelGap, smallGap } = metricsFor(width, height);
  const column = Math.min(width - pad * 2, 640);
  const left = (width - column) / 2;
  const listHeight = listRows * ROW_HEIGHT;

  // A short viewport takes its room back from the logo, not from the labels or the 44px controls.
  const titleSize = phone ? 38 : Math.min(92, Math.round(width / 10), Math.round(height * (short ? 0.055 : 0.085)));
  const titleBlockHeight = titleSize * TITLE_BLOCK_RATIO;

  let y = pad + titleBlockHeight;
  let continueRow: Rect | null = null;
  if (input.continuable) {
    continueRow = { x: left, y, width: column, height: hit.target };
    y += hit.target + gap;
  }

  // Scenario: a label (not part of the rect flow — text, not a control), a
  // search field, the quick-filter chip strip, then the scrolling roster.
  y += labelGap; // "Scenario" label
  const scenarioSearch: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + smallGap;
  const scenarioChipsHeight = chipStripHeight(input.scenarioChipRows);
  const scenarioChips: Rect = { x: left, y, width: column, height: scenarioChipsHeight };
  y += scenarioChipsHeight + smallGap;
  const scenarioList: Rect = { x: left, y, width: column, height: listHeight };
  y += listHeight + gap;

  y += labelGap; // "Difficulty" label
  const difficulty: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;

  y += labelGap; // "Heroes" label
  const heroSearch: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + smallGap;
  const heroChipsHeight = chipStripHeight(input.heroChipRows);
  const heroChips: Rect = { x: left, y, width: column, height: heroChipsHeight };
  y += heroChipsHeight + smallGap;
  const heroList: Rect = { x: left, y, width: column, height: listHeight };
  y += listHeight + gap;

  let manageDecksRow: Rect | null = null;
  if (phone) {
    manageDecksRow = { x: left, y, width: column, height: hit.target };
    y += hit.target + gap;
  }

  const newSeedWidth = 110;
  const manageDecksWidth = phone ? 0 : 150;
  const seedFieldWidth = column - newSeedWidth - 10 - (phone ? 0 : manageDecksWidth + 10);
  const seedRowY = y + labelGap;
  const seed: Rect = { x: left, y: seedRowY, width: seedFieldWidth, height: hit.target };
  const newSeed: Rect = { x: left + seedFieldWidth + 10, y: seedRowY, width: newSeedWidth, height: hit.target };
  const manageDecksInline: Rect | null = phone ? null : { x: newSeed.x + newSeedWidth + 10, y: seedRowY, width: manageDecksWidth, height: hit.target };
  y += labelGap + hit.target + gap;

  const start: Rect = { x: left, y, width: column, height: hit.primary };

  return {
    formFactor,
    pad,
    left,
    column,
    titleSize,
    titleBlockHeight,
    continueRow,
    scenarioSearch,
    scenarioChips,
    scenarioList,
    difficulty,
    heroSearch,
    heroChips,
    heroList,
    listRows,
    manageDecksRow,
    seed,
    newSeed,
    manageDecksInline,
    start,
  };
}

export function titleLayout(input: TitleLayoutInput): TitleLayout {
  const trial = layoutAt(input, LIST_VISIBLE_ROWS);
  const overflow = trial.start.y + trial.start.height - input.height;
  if (overflow <= 0) return trial;
  // Cutting one row off *each* roster (two lists) saves `2 * ROW_HEIGHT`; round up so the cut always covers the
  // overflow, never leaves a sliver still past the fold.
  const rowsToCut = Math.ceil(overflow / (2 * ROW_HEIGHT));
  const rows = Math.max(1, LIST_VISIBLE_ROWS - rowsToCut);
  return layoutAt(input, rows);
}

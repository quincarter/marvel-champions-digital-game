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
 * **Uncapped, not fixed-height overflow**: `scenarioList`/`heroList` are a
 * fixed *viewport* height (`LIST_VISIBLE_ROWS` rows), not a cap on how many
 * rows exist — the list scrolls for the rest (`ui/virtual-list.ts`). A
 * fixed viewport is what makes the rest of the page's layout independent of
 * how many scenarios or decks exist, which is the actual fix for "Start
 * game pushed off an 800×600 window" (PLAN.md Phase 7 wave 1).
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export const ROW_HEIGHT = hit.target;
export const LIST_VISIBLE_ROWS = 3;
export const LIST_HEIGHT = LIST_VISIBLE_ROWS * ROW_HEIGHT;

export interface TitleLayoutInput {
  readonly width: number;
  readonly height: number;
  /** A saved game adds a "Continue" row above everything else. */
  readonly continuable: boolean;
  /** Breakout's per-villain version row (only at standard/expert). */
  readonly showVillainVersions: boolean;
}

export interface TitleLayout {
  readonly formFactor: FormFactor;
  readonly pad: number;
  readonly left: number;
  readonly column: number;
  readonly titleBlockHeight: number;
  readonly continueRow: Rect | null;
  readonly scenarioSearch: Rect;
  readonly scenarioList: Rect;
  readonly difficulty: Rect;
  readonly villainVersions: Rect | null;
  readonly heroSearch: Rect;
  readonly heroList: Rect;
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
    layout.scenarioList,
    layout.difficulty,
    ...(layout.villainVersions ? [layout.villainVersions] : []),
    layout.heroSearch,
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

export function titleLayout(input: TitleLayoutInput): TitleLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const phone = formFactor === "phone";
  const pad = phone ? 16 : height < 820 ? 24 : 40;
  const column = Math.min(width - pad * 2, 640);
  const left = (width - column) / 2;
  const gap = phone ? 12 : 18;

  const titleSize = phone ? 38 : Math.min(92, Math.round(width / 10), Math.round(height * 0.085));
  const titleBlockHeight = titleSize * 2.05;

  let y = pad + titleBlockHeight;
  let continueRow: Rect | null = null;
  if (input.continuable) {
    continueRow = { x: left, y, width: column, height: hit.target };
    y += hit.target + gap;
  }

  // Scenario: a label (not part of the rect flow — text, not a control), a
  // search field, then the fixed-height scrolling roster.
  y += 16; // "Scenario" label
  const scenarioSearch: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + 8;
  const scenarioList: Rect = { x: left, y, width: column, height: LIST_HEIGHT };
  y += LIST_HEIGHT + gap;

  y += 16; // "Difficulty" label
  const difficulty: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;

  let villainVersions: Rect | null = null;
  if (input.showVillainVersions) {
    y += 16; // "Villain versions" label
    villainVersions = { x: left, y, width: column, height: hit.target };
    y += hit.target + gap;
  }

  y += 16; // "Heroes" label
  const heroSearch: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + 8;
  const heroList: Rect = { x: left, y, width: column, height: LIST_HEIGHT };
  y += LIST_HEIGHT + gap;

  let manageDecksRow: Rect | null = null;
  if (phone) {
    manageDecksRow = { x: left, y, width: column, height: hit.target };
    y += hit.target + gap;
  }

  const newSeedWidth = 110;
  const manageDecksWidth = phone ? 0 : 150;
  const seedFieldWidth = column - newSeedWidth - 10 - (phone ? 0 : manageDecksWidth + 10);
  const seedRowY = y + 16;
  const seed: Rect = { x: left, y: seedRowY, width: seedFieldWidth, height: hit.target };
  const newSeed: Rect = { x: left + seedFieldWidth + 10, y: seedRowY, width: newSeedWidth, height: hit.target };
  const manageDecksInline: Rect | null = phone ? null : { x: newSeed.x + newSeedWidth + 10, y: seedRowY, width: manageDecksWidth, height: hit.target };
  y += 16 + hit.target + 16;

  const start: Rect = { x: left, y, width: column, height: hit.primary };

  return {
    formFactor,
    pad,
    left,
    column,
    titleBlockHeight,
    continueRow,
    scenarioSearch,
    scenarioList,
    difficulty,
    villainVersions,
    heroSearch,
    heroList,
    manageDecksRow,
    seed,
    newSeed,
    manageDecksInline,
    start,
  };
}

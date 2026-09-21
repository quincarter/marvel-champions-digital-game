/**
 * Decks & Collection's own layout (W9b, docs/phase4-screen-gaps.md §3, D14),
 * as a pure function — same "layout function a plain-TS test can check for
 * overlap" every other screen's own layout module already does.
 *
 * **The composition, read straight off D14's own markup** (`ScreensDesktop_12`/
 * `_13`.png plus `Marvel Champions game screens/Screens - Desktop.dc.html`'s
 * `#s14`, docs/design-reference.md): an ink chrome bar (Back, "DECKS &
 * COLLECTION") over a paper ground. Below it, three columns, full body
 * height:
 *  - **"YOUR DECKS"** (`listPane`): a scrollable list of deck cards — the
 *    *selected* one drawn ink-filled with paper text (and, only for the
 *    selected deck, a second "last played · record" line), an illegal/WIP
 *    deck drawn with a red border and red title, everything else plain white
 *    on ink border, then a dashed "+ NEW DECK" tile as the list's own last
 *    row — followed by a fixed parchment "IMPORT / EXPORT" box.
 *  - **"CARD POOL"** (`poolPane`): a filter-chip row, then a grid of the
 *    selected deck's own legal card pool (art, a cost pip, name, and "Type ·
 *    X of Y in deck").
 *  - **The stats rail** (`statsPane`), on the same dark ink ground the mock
 *    draws it on: the deck's name/count/legality, curve, composition,
 *    "Recently changed", and a footer of DUPLICATE + the single red "PLAY
 *    THIS DECK ▸" — D14's own bottom two controls, side by side.
 *
 * **What's deliberately not the mock, and why** (`scenes/decks.ts`'s own doc
 * comment has the rest): the mock's Import/Export box carries no visible
 * controls, only description text — this build already has paste-import,
 * MarvelCDB-import and export, so those controls are folded into that box
 * rather than dropped. The mock's deck note and "N of N cards owned" line are
 * both skipped per docs/phase4-screen-gaps.md §4 (advice text and owned-card
 * tracking are undecided/out of scope), and S8's search field and quick-filter
 * chips (added to this screen after D14 was drawn, as the deck pool grew past
 * a fixed list) sit above the deck list rather than being invented by the
 * mock.
 *
 * **Wide (desktop only): three panes side by side.** D14 needs real room for
 * a five-column card-pool grid alongside a 260–320px deck list and a
 * 280–360px stats rail; `tabletLandscape` (as narrow as 768px) doesn't have
 * it, so — unlike this screen's own two-pane version before W9b, which
 * treated `tabletLandscape` as wide — three columns are reserved for
 * `formFactor === "desktop"` (>=1280px) alone.
 *
 * **Narrow (phone/both tablet orientations): one column, via a three-way
 * "Decks"/"Cards"/"Stats" tab strip**, the same tab-scoped pattern P04 Deck
 * check already uses for its own Curve/Cards/Aspect tabs — one column stacking
 * all three groups would either give each too little height to be usable, or
 * push the footer actions off a short viewport with no scroll
 * (`title-layout.ts`'s own doc comment documents hitting exactly that at
 * 800×600 for a shorter page than this one).
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export type DecksTab = "decks" | "cards" | "stats";

export interface DecksLayoutInput {
  readonly width: number;
  readonly height: number;
}

export interface DecksLayout {
  readonly formFactor: FormFactor;
  /** True when `listPane`/`poolPane`/`statsPane` are populated (three-pane); false when `tabs`/`content` are (single column via tabs). Never both. */
  readonly wide: boolean;
  readonly pad: number;
  /** Back and the screen title. */
  readonly header: Rect;
  /** Wide only: "YOUR DECKS" — search, quick-filter chips, the deck list (ending in "+ New deck"), then Import/Export. */
  readonly listPane: Rect | null;
  /** Wide only: "CARD POOL" — the filter-chip row and the card grid, for the *selected* deck. */
  readonly poolPane: Rect | null;
  /** Wide only: the selected deck's stats rail (curve, composition, recently changed, Duplicate/Play). */
  readonly statsPane: Rect | null;
  /** Narrow only: the "Decks" / "Cards" / "Stats" tab strip. */
  readonly tabs: Rect | null;
  /** Narrow only: whichever tab's own content — the scene draws that pane's contents into this same rect, full height. */
  readonly content: Rect | null;
}

/** Every rect this layout places, for a no-overlap test. */
export function decksLayoutRects(layout: DecksLayout): readonly Rect[] {
  return [
    layout.header,
    ...(layout.listPane ? [layout.listPane] : []),
    ...(layout.poolPane ? [layout.poolPane] : []),
    ...(layout.statsPane ? [layout.statsPane] : []),
    ...(layout.tabs ? [layout.tabs] : []),
    ...(layout.content ? [layout.content] : []),
  ];
}

const GAP = 16;
/** D14's own list column reads narrower than a full reading measure; clamped so it never crowds the pool grid out at the low end of "wide" (desktop's own 1280px floor) or run away with the screen at 4K. */
const LIST_WIDTH_MIN = 260;
const LIST_WIDTH_MAX = 320;
const LIST_WIDTH_FRACTION = 0.19;
/** D14's own sidebar width, same clamp shape as the list column. */
const STATS_PANE_WIDTH_MIN = 280;
const STATS_PANE_WIDTH_MAX = 360;
const STATS_PANE_WIDTH_FRACTION = 0.22;
/**
 * Never reached at the desktop breakpoint this screen actually uses (1280px already leaves the pool comfortably
 * above this once the list/stats columns take their own minimums) — kept as a documented floor rather than removed,
 * so a future change to the other two panes' minimums can't silently squeeze the pool pane to nothing.
 */
const POOL_MIN_WIDTH = 260;

export function decksLayout(input: DecksLayoutInput): DecksLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop";
  const pad = wide ? 32 : 16;
  // Wide uses the full width for its three columns; narrow keeps the single-column reading measure every other
  // narrow screen in this app centers its content at (`title-layout.ts` et al.), rather than stretching a search
  // field and a card grid edge to edge on a tablet held sideways.
  const maxColumn = wide ? Infinity : 640;
  const column = Math.min(Math.max(0, width - pad * 2), maxColumn);
  const left = (width - column) / 2;

  const header: Rect = { x: left, y: pad, width: column, height: hit.target };
  const bodyTop = header.y + header.height + GAP;
  const bodyHeight = Math.max(0, height - bodyTop - pad);

  if (!wide) {
    const tabs: Rect = { x: left, y: bodyTop, width: column, height: hit.target };
    const contentTop = tabs.y + tabs.height + 10;
    const content: Rect = { x: left, y: contentTop, width: column, height: Math.max(0, height - contentTop - pad) };
    return { formFactor, wide, pad, header, listPane: null, poolPane: null, statsPane: null, tabs, content };
  }

  const listWidth = Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, column * LIST_WIDTH_FRACTION));
  const statsWidth = Math.min(STATS_PANE_WIDTH_MAX, Math.max(STATS_PANE_WIDTH_MIN, column * STATS_PANE_WIDTH_FRACTION));
  const poolWidth = Math.max(POOL_MIN_WIDTH, column - listWidth - statsWidth - GAP * 2);

  const listPane: Rect = { x: left, y: bodyTop, width: listWidth, height: bodyHeight };
  const poolPane: Rect = { x: left + listWidth + GAP, y: bodyTop, width: poolWidth, height: bodyHeight };
  const statsPane: Rect = {
    x: left + listWidth + GAP + poolWidth + GAP,
    y: bodyTop,
    width: statsWidth,
    height: bodyHeight,
  };
  return { formFactor, wide, pad, header, listPane, poolPane, statsPane, tabs: null, content: null };
}

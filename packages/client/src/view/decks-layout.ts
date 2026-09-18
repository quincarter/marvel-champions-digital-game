/**
 * Decks & Collection's own layout (W9, docs/phase4-screen-gaps.md §3, D14), as
 * a pure function — same "layout function a plain-TS test can check for
 * overlap" every other screen's own layout module already does.
 *
 * **The composition, read off D14 (`ScreensDesktop_12`/`_13`.png,
 * docs/design-reference.md):** an ink chrome bar (Back, "DECKS & COLLECTION",
 * a right-aligned "<pack> · N of N cards owned" line) over a paper ground.
 * Below it, D14 draws three columns — "YOUR DECKS" (a list), "CARD POOL" (a
 * browsable grid of the *selected* deck's own cards, with an Import/Export box
 * beneath it) and a dark ink sidebar for the selected deck's stats
 * (curve, composition, a deck note, "Recently changed", Duplicate and a red
 * "PLAY THIS DECK ▸"). This module builds only the first and third of those:
 * the middle "Card pool" column is D04's own live-editing grid (add/remove
 * counters on every card) — building a second copy of that editor inline here
 * isn't in W9's own scope (docs/phase4-screen-gaps.md §3 lists "deck list
 * beside … stats", not a second pool grid), and editing a deck already has a
 * home (`scenes/deck-builder.ts`, reached from "Edit"). So this layout is
 * **two panes, not three**: the deck list (with its own search field and
 * quick-filter chips, S8, plus the existing import/export boxes and "New
 * deck" folded into the same column, below the list) beside the selected
 * deck's stats pane, painted on the dark ground D14 uses for it.
 *
 * **Wide (tabletLandscape/desktop): two panes side by side**, `listPane` at
 * roughly D14's own list-column width and `statsPane` at roughly its sidebar
 * width, both spanning the same body height below the header.
 *
 * **Narrow (phone/tabletPortrait): one column, via a "Decks"/"Stats" tab
 * strip** rather than D14's own side-by-side split, which has no room to
 * exist at 440px — stacking the list above the stats pane instead would
 * either give the list too little height to be usable or push the stats pane
 * (and Duplicate/Export/Play) off the bottom of a short viewport with no
 * scroll, the exact failure `title-layout.ts`'s own doc comment documents
 * hitting at 800×600 for a *shorter* page than this one. A tab strip is
 * already this app's own answer to the same problem (P04 Deck check's own
 * Curve/Cards/Aspect tabs), so narrow Decks reuses the pattern rather than
 * inventing a second one: `tabs` picks "Decks" or "Stats", and `content` is
 * whichever one's full-height rect.
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export type DecksTab = "decks" | "stats";

export interface DecksLayoutInput {
  readonly width: number;
  readonly height: number;
}

export interface DecksLayout {
  readonly formFactor: FormFactor;
  /** True when `listPane`/`statsPane` are populated (two-pane); false when `tabs`/`content` are (single column via tabs). Never both. */
  readonly wide: boolean;
  readonly pad: number;
  /** Back, the screen title, and the pack-coverage line. */
  readonly header: Rect;
  /** Wide only: the deck list (its own search field, quick-filter chips, the virtualized list, then Import/Export and New deck below it — the scene subdivides this further). */
  readonly listPane: Rect | null;
  /** Wide only: the selected deck's stats pane (curve, composition, record, recently changed, Duplicate/Export/Play). */
  readonly statsPane: Rect | null;
  /** Narrow only: the "Decks" / "Stats" tab strip. */
  readonly tabs: Rect | null;
  /** Narrow only: whichever tab's own content — the scene draws the Decks pane's contents or the stats pane's contents into this same rect, full height. */
  readonly content: Rect | null;
}

/** Every rect this layout places, for a no-overlap test. */
export function decksLayoutRects(layout: DecksLayout): readonly Rect[] {
  return [layout.header, ...(layout.listPane ? [layout.listPane] : []), ...(layout.statsPane ? [layout.statsPane] : []), ...(layout.tabs ? [layout.tabs] : []), ...(layout.content ? [layout.content] : [])];
}

const GAP = 16;
/** D14's sidebar reads narrower than the list column; clamped so it never crowds out the list at the low end of "wide" (tabletLandscape, ~800px) or run away with the screen at 4K. */
const STATS_PANE_WIDTH_MIN = 280;
const STATS_PANE_WIDTH_MAX = 360;

export function decksLayout(input: DecksLayoutInput): DecksLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const phone = formFactor === "phone";
  const pad = phone ? 16 : 32;

  const maxColumn = wide ? 1100 : 640;
  const column = Math.min(width - pad * 2, maxColumn);
  const left = (width - column) / 2;

  const header: Rect = { x: left, y: pad, width: column, height: hit.target };
  const bodyTop = header.y + header.height + GAP;
  const bodyHeight = Math.max(0, height - bodyTop - pad);

  if (!wide) {
    const tabs: Rect = { x: left, y: bodyTop, width: column, height: hit.target };
    const contentTop = tabs.y + tabs.height + 10;
    const content: Rect = { x: left, y: contentTop, width: column, height: Math.max(0, height - contentTop - pad) };
    return { formFactor, wide, pad, header, listPane: null, statsPane: null, tabs, content };
  }

  const statsWidth = Math.min(STATS_PANE_WIDTH_MAX, Math.max(STATS_PANE_WIDTH_MIN, column * 0.3));
  const listWidth = column - GAP - statsWidth;
  const listPane: Rect = { x: left, y: bodyTop, width: listWidth, height: bodyHeight };
  const statsPane: Rect = { x: left + listWidth + GAP, y: bodyTop, width: statsWidth, height: bodyHeight };
  return { formFactor, wide, pad, header, listPane, statsPane, tabs: null, content: null };
}

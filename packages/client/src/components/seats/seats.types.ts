/**
 * Take your seats' contract: the props every section element takes and the one `mc-seats` event they raise. The page
 * (`views/seats/mc-seats-page`) composes the sections; the scene sets the page's `model` from its view model and handles the
 * events. Words arrive translated. Sections are built to this file alone, in parallel; add to it (never reshape it) and say so.
 *
 * Focus stops (`data-stop`) keep the names the specs and the pad route use: `back`, `seat:<n>`, `seat-clear:<deck id>`,
 * `clear-seat`, `hero-search-toggle`, `hero-search`, `filters-toggle`, `hero-chip:<id>`, `hero-chip-info:<aspect>`,
 * `hero-random`, `hero-art`, `preconstructed`, `rec-toggle`, `drill-back`, `hero:<card id>`, `hero-rec:<card id>`,
 * `hero-shelf:<pack id>`, `hero-clear`, `deck-check`, `play`, `conflict-notice`, `seat-details-toggle`, `aspect-tip-link`.
 */
import type { ControlGlyph, FilterChip, GlyphSpec, PictureSource } from "@mc/ui";
import type { AspectTipContent } from "../../view/aspect-tip-model.js";
import type { SeatFrame } from "../../view/seats-panel-model.js";

export type { SeatFrame, AspectTipContent, ControlGlyph, FilterChip, PictureSource };

/** The one event Take your seats' elements raise (composed, bubbling), `detail` discriminated by `type`. It is in `GUARDED_EVENTS`. */
export const SEATS_EVENT = "mc-seats";

/** A press on a plain button of the screen: which one. */
export type SeatsAction =
  | "back"
  | "play"
  | "deck-check"
  | "random"
  | "game-art"
  | "preconstructed"
  | "rec-toggle"
  | "drill-back"
  | "hero-clear"
  | "conflict-notice";

export type SeatsEvent =
  /** A reachable seat card or chip was pressed: it becomes the active seat. */
  | { readonly type: "seat"; readonly index: number }
  /** The ✕ on a filled seat card: clears that deck from that seat. */
  | { readonly type: "clear"; readonly index: number; readonly deckId: string | null }
  /** The seat summary's Clear seat (the narrow layouts). */
  | { readonly type: "clear-seat" }
  /** A plain button. */
  | { readonly type: "action"; readonly action: SeatsAction }
  /** The search field's text changed (debounced by the field). */
  | { readonly type: "search"; readonly text: string }
  /** The magnifier that opens or shuts the search field (narrow layouts), or the Filters button that folds the chips, or the seat summary's disclosure ("details"). */
  | { readonly type: "toggle"; readonly what: "search" | "filters" | "details" }
  /** A filter chip's body pressed (`id` is the chip id: `aspect:justice`, `source:precon`, `playable-now`, `sort:wave`). */
  | { readonly type: "chip"; readonly id: string }
  /** An aspect chip's "i" segment: opens or shuts its tip. */
  | { readonly type: "chip-info"; readonly id: string }
  /** The open tip's "Aspects ▸" link. */
  | { readonly type: "tip-link" }
  /** A shelf header: fold or unfold it (`fold`), or open its pack as a full grid (`all`). */
  | { readonly type: "shelf"; readonly id: string; readonly change: "fold" | "all" }
  /** A hero tile: pressed (seat it, or open its decks) or inspected (hold, right-click, or the Inspect key). `key` is the stop key. */
  | { readonly type: "hero"; readonly key: string; readonly via: "press" | "inspect" }
  /** A deck row's Seat button on the Pick a deck sheet. */
  | { readonly type: "deck"; readonly deckId: string }
  /** Pick a deck's Back, its backdrop, or Escape. */
  | { readonly type: "decks-close" };

// ---- Seat table (stage 1) -------------------------------------------------------------------------------------------

/** One seat's face. */
export interface SeatModel {
  readonly index: number;
  /** The deck seated here, which the ✕ names so a press clears that deck and no other. */
  readonly deckId: string | null;
  readonly frame: SeatFrame;
  /** "SEAT 1 · YOU", "SEAT 2 · PICKING". */
  readonly label: string;
  readonly name: string | null;
  /** "Justice · 14 HP · hand 5". */
  readonly meta: string | null;
  /** What an empty seat says ("Empty — pick a hero", "Fill seat 3 first"). */
  readonly empty: string | null;
  /** The identity card's picture for the thumbnail. */
  readonly picture: PictureSource | null;
  /** The ✕'s accessible name; a filled card has one. */
  readonly clearLabel: string | null;
  /** The narrow chip's own words, where they are shorter than the card's (`SEAT 1`, `Justice · 10 HP`, `Empty` / `Picking`). */
  readonly chip?: { readonly label: string; readonly meta: string | null; readonly empty: string | null };
}

/** A Team-Up pair under the seats: which two seats, and its pill's words. */
export interface SeatPairModel {
  readonly seats: readonly [number, number];
  readonly label: string;
  readonly picture: PictureSource | null;
}

/** The active seat's facts on one strip (narrow layouts). */
export interface SeatSummaryModel {
  /** The hint of an empty active seat ("Tap a hero below for seat 2."), or null with a hero seated. */
  readonly hint: string | null;
  /** Short lines (stats, hand, obligation, nemesis); each fades as `strong` says. */
  readonly lines: readonly { readonly text: string; readonly strong: boolean }[];
  readonly clearLabel: string;
  /** Why Clear does nothing (the last hero stays), or null when it works. */
  readonly clearBlocked: string | null;
  /**
   * The strip is a disclosure (the narrow layouts: "this stuff should be collapsible", the owner, 2026-09-21): a one-line
   * button, "Seat 2 · Justice · 14 HP ▸", that opens the hint or the lines and Clear seat under it. Null shows them always.
   */
  readonly toggle?: { readonly label: string; readonly open: boolean } | null;
}

// ---- Filters (stage 2): `mc-seats-filters` -----------------------------------------------------------------------------

/** A plain button of the filters row. */
export interface SeatsButtonModel {
  readonly action: Extract<SeatsAction, "random" | "game-art" | "preconstructed">;
  readonly label: string;
  /** Unavailable: why, as the tooltip words; the press still raises the event (the scene explains), it is not a dead control. */
  readonly disabled: string | null;
  /** The active seat's Pick state: drawn chosen (game art on). */
  readonly selected: boolean;
}

export interface SeatsFiltersModel {
  /** The narrow layouts' magnifier and Filters button; null where the field and chips are always shown (wide). */
  readonly searchToggle: { readonly label: string; readonly open: boolean } | null;
  readonly filtersButton: { readonly label: string; readonly open: boolean } | null;
  /** The search field: shown (open, or always on wide), its text and placeholder. */
  readonly search: { readonly visible: boolean; readonly text: string; readonly placeholder: string };
  /** The chips; empty while they are folded behind the Filters button. `rail`: one sideways row instead of wrapped rows. */
  readonly chips: readonly FilterChip[];
  readonly rail: boolean;
  readonly buttons: readonly SeatsButtonModel[];
  /** The open aspect tip, or null. Rendered over everything, clamped to the screen. */
  readonly tip: AspectTipContent | null;
  /** The aspect whose chip's "i" the tip belongs to (`aspect:<name>` chip id), when open. */
  readonly tipChipId: string | null;
}

// ---- Roster (stage 3): `mc-seats-roster` -------------------------------------------------------------------------------

/** A hero tile: a card with its picture, caption, aspect stamps and marks. */
export interface HeroTileModel {
  /** The focus stop key: `hero:<card id>`, `hero-rec:<card id>`. The events name it. */
  readonly key: string;
  readonly cardId: string;
  readonly title: string;
  /** The caption under the title: source and identity, or a recommendation's reason. */
  readonly subtitle: string;
  /** A short caution that replaces the caption, or null. */
  readonly warning: string | null;
  readonly stamps: readonly { readonly label: string; readonly fill: string; readonly ink: string }[];
  /** "SEAT 2", "LOCKED", "NOT READY": top right of the picture. */
  readonly tag: string | null;
  /** "Team-Up with Phoenix": top left, on an outlined plate. */
  readonly plate: string | null;
  /** The active seat's pick: the heavy red frame. */
  readonly selected: boolean;
  /** Dimmed (not seatable now). */
  readonly dim: boolean;
  readonly picture: PictureSource | null;
  /** Whether a hold or right-click inspects it. */
  readonly inspect: boolean;
  /** The accessible name when it differs from the title, caption and tag. */
  readonly label?: string;
}

export interface HeroShelfModel {
  /** `recommended` for the Recommended shelf, else the pack id. */
  readonly id: string;
  readonly title: string;
  /** "6 heroes · Hide", "5 identities ·". */
  readonly count: string;
  /** The pack's cover picture, or null. */
  readonly cover: PictureSource | null;
  /** Whether the shelf is open; undefined where it never folds. */
  readonly open?: boolean;
  /** "See all ▸", or empty for none. */
  readonly seeAll: string;
  readonly tiles: readonly HeroTileModel[];
}

export interface SeatsRosterModel {
  /** `shelves`, or `grid`: one pack's tiles wrapped, no headers (a pack opened to see all of it). */
  readonly mode: "shelves" | "grid";
  readonly shelves: readonly HeroShelfModel[];
  /** The "◂ All packs" button of a grid, or null. */
  readonly drillBack: string | null;
  /** Words in place of the shelves (nothing matches), or null; and the Clear button under them. */
  readonly emptyText: string | null;
  readonly clearLabel: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
  /** LB/RB/LT/RT paging glyphs beside the active shelf's chevrons while a pad is used (stop keys `hero-shelf:<id>`). */
  readonly pagingHintShelf: string | null;
  /** Addition: the glyphs `pagingHintShelf` draws (LT before the previous chevron, RT after the next); absent or null draws none. */
  readonly pagingGlyphs?: PagingGlyphs | null;
}

/** Addition: the trigger glyphs that page a shelf's row on a pad. */
export interface PagingGlyphs {
  readonly previous: readonly GlyphSpec[] | null;
  readonly next: readonly GlyphSpec[] | null;
  /** The glyph height in px, already scaled by the hint size setting. */
  readonly height: number;
  /** No open / close transition (reduced motion). */
  readonly still: boolean;
}

// ---- Pick a deck (stage 4): `mc-hero-decks-sheet` ----------------------------------------------------------------------

export interface DeckRowModel {
  readonly deckId: string;
  readonly name: string;
  /** "Precon · 40 cards", "Tested · by X · MarvelCDB". */
  readonly source: string;
  readonly stamps: readonly { readonly label: string; readonly fill: string; readonly ink: string }[];
  /** "✓ Legal", or the verdict's problem. */
  readonly verdict: string;
  readonly legal: boolean;
  readonly picture: PictureSource | null;
  /** The Seat button's word. */
  readonly seatLabel: string;
  /** Why this deck cannot be seated now, or null. */
  readonly disabled: string | null;
  /** Added by `mc-hero-decks-sheet`: the verdict's kind; left out, `ok` when `legal`, else `blocked`. */
  readonly status?: "ok" | "warning" | "blocked" | "locked";
  /** Added: the verdict's leading mark, already translated (`seats.lockedMark` for a locked deck); left out, ✓ ! or ✕ by `status`. */
  readonly mark?: string;
  /** Added: the hero's identity card, which the picture's hover popover and Inspect show; left out, none. */
  readonly cardId?: string | null;
}

export interface DecksSheetModel {
  readonly title: string;
  /** "3 decks. Pick the one this seat plays." */
  readonly subtitle: string;
  readonly backLabel: string;
  readonly decks: readonly DeckRowModel[];
}

// ---- Hero detail panel (stage 4): `mc-seats-detail` --------------------------------------------------------------------

export interface HeroDetailModel {
  readonly name: string;
  /** "Deck name · tested by ...", or null. */
  readonly credit: string | null;
  readonly stats: string;
  readonly obligationLabel: string;
  readonly obligation: string;
  readonly nemesisLabel: string;
  readonly nemesis: string;
}

export interface SeatsDetailModel {
  /** The hero's facts, or null before a hero is chosen (then `emptyText`). */
  readonly hero: HeroDetailModel | null;
  /** "Seat 1 is set · pick seat 2 below". */
  readonly seatNote: string | null;
  readonly emptyText: string;
  /** The insight lines under the facts (pair notes, conflicts), already worded. */
  readonly insights: readonly { readonly text: string; readonly tone: "meta" | "caution" }[];
}

// ---- The page (stage 5): `mc-seats-page` -------------------------------------------------------------------------------

export interface SeatsHeaderModel {
  readonly backLabel: string;
  readonly title: string;
  /** "STEP 2 OF 4 · 2 SEATS FILLED", already fitted to the width by the scene (short forms for a narrow bar). */
  readonly step: string;
  /** The Cancel key or button beside Back's word, while a keyboard or pad is in use. */
  readonly backGlyph?: ControlGlyph;
  /** How far the title drops, in px, and where it ends (px from the bar's left; null: no limit), to clear the dark mode tab that hangs from the top centre. */
  readonly titleDrop?: number;
  readonly titleMaxRight?: number | null;
}

export interface SeatsFooterModel {
  readonly deckCheckLabel: string;
  readonly playLabel: string;
  /** Why Play is off (no hero, a conflict), or null. */
  readonly playBlocked: string | null;
  readonly deckCheckBlocked: string | null;
  /** The Start / Menu button beside Play's word, on a pad. */
  readonly playGlyph?: ControlGlyph;
}

/** The wide layout's row above the filters: "Heroes, seat 2 of 4" and, while a keyboard or pad is in use, the keys that pick the seat, clear it and move between the filters and the list. */
export interface SeatsHintsModel {
  readonly heading: string;
  /** Each key or button with its word; only hints with a glyph are shown (a mouse or touch has no key to name). */
  readonly hints: readonly { readonly word: string; readonly glyph: ControlGlyph | null }[];
}

/** What the page shows; the scene rebuilds it from its state and sets `page.model`. */
export interface SeatsPageModel {
  readonly header: SeatsHeaderModel;
  /** Four seats (cards on a wide screen, chips on a narrow one: the page's own CSS decides by width). */
  readonly seats: readonly SeatModel[];
  readonly pairs: readonly SeatPairModel[];
  /** Narrow layouts: the active seat's strip under the chips. */
  readonly summary: SeatSummaryModel | null;
  readonly filters: SeatsFiltersModel;
  readonly roster: SeatsRosterModel;
  readonly detail: SeatsDetailModel;
  readonly footer: SeatsFooterModel;
  /** The Pick a deck sheet over the page, or null. */
  readonly decks: DecksSheetModel | null;
  /** The wide layout (desktop, tablet landscape): the seats are cards and the detail panel stands beside the roster. The scene's form factor, so its words and the page's CSS agree. */
  readonly wide?: boolean;
  /** "2 cards can't be played with these heroes ▸" while a same-name clash is unanswered (stop `conflict-notice`), or null. */
  readonly notice?: string | null;
  /** The heading and key hints row, wide layouts only; null on a narrow one. */
  readonly hints?: SeatsHintsModel | null;
}

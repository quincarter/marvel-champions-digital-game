/**
 * Decks & Collection's contract: the props every section element takes and the one `mc-decks` event they raise. The page
 * (`views/decks/mc-decks-page`) composes the sections; the scene sets the page's `model` from its view models and handles the
 * events. Words arrive translated. Add to this file (never reshape it) when a section needs more.
 *
 * Focus stops (`data-stop`) keep the names the specs and the pad route use: `back`, `player-stats`, `tab:<id>`, `new-deck`,
 * `deck-search`, `filters-toggle`, `deck-chip:<id>`, `deck:<deck id>`, `ie-paste-toggle`, `ie-marvelcdb-toggle`, `ie-export`,
 * `paste-field`, `paste-import`, `marvelcdb-field`, `marvelcdb-import`, `pool-chip:filters`, `pool-chip:<id>`, `pool-search`,
 * `pool-card:<card id>` (made by the scene from the grid's geometry), `pane:deck`, `pane:games`, `games-against`,
 * `games-open`, `card-back`, `card-inspect`, `stats-check`, `stats-edit`, `stats-delete`, `stats-duplicate`, `stats-play`,
 * `stats-add`, `stats-preview`, `stats-copy-link`, `stats-open-link`.
 */
import type { BarChartBar, ControlGlyph, FilterChip, McDeckRowModel, PictureSource, TabRailTab } from "@mc/ui";

export type { BarChartBar, ControlGlyph, FilterChip, McDeckRowModel, PictureSource, TabRailTab };

/** The one event Decks & Collection's elements raise (composed, bubbling), `detail` discriminated by `type`. It is in `GUARDED_EVENTS`. */
export const DECKS_EVENT = "mc-decks";

/** The narrow layout's panes; the wide layout shows all three at once. */
export type DecksTab = "decks" | "cards" | "stats";

/** A press on a plain button of the screen: which one. */
export type DecksAction =
  | "back"
  | "player-stats"
  | "new-deck"
  | "filters-toggle"
  | "ie-paste-toggle"
  | "ie-marvelcdb-toggle"
  | "ie-export"
  | "paste-import"
  | "marvelcdb-import"
  | "pool-filters-toggle"
  | "pane-deck"
  | "pane-games"
  | "games-against"
  | "games-open"
  | "card-back"
  | "card-inspect"
  | "stats-check"
  | "stats-edit"
  | "stats-delete"
  | "stats-duplicate"
  | "stats-play"
  | "stats-add"
  | "stats-preview"
  | "stats-copy-link"
  | "stats-open-link";

export type DecksEvent =
  /** A plain button. */
  | { readonly type: "action"; readonly action: DecksAction }
  /** A narrow tab of the rail. */
  | { readonly type: "tab"; readonly tab: DecksTab }
  /** A deck row: tapped (select it) or inspected (hold, right-click, or the Inspect key). */
  | { readonly type: "deck"; readonly deckId: string; readonly via: "press" | "inspect" }
  /** A search field's text changed (debounced by the field): the deck list's or the card pool's. */
  | { readonly type: "search"; readonly list: "deck" | "pool"; readonly text: string }
  /** A filter chip of the deck list or the card pool (`id` is the chip id). */
  | { readonly type: "chip"; readonly list: "deck" | "pool"; readonly id: string }
  /** The text in the paste or the MarvelCDB field changed. */
  | { readonly type: "input"; readonly field: "paste" | "marvelcdb"; readonly text: string }
  /** A pool card: tapped (it opens in the stats pane) or inspected. */
  | { readonly type: "card"; readonly cardId: string; readonly via: "press" | "inspect" };

// ---- The bar -------------------------------------------------------------------------------------------------------------

export interface DecksHeaderModel {
  readonly backLabel: string;
  readonly backGlyph?: ControlGlyph | undefined;
  readonly title: string;
  /** "CARD POOL · 612 CARDS"; null on a phone. */
  readonly poolMeta: string | null;
  readonly statsLabel: string;
  readonly statsGlyph?: ControlGlyph | undefined;
  /** The title drops under, or ends before, the dark mode tab (`sheetThemeFor`). */
  readonly titleDrop: number;
  readonly titleMaxRight: number | null;
  /** A narrow bar: Back and Your stats on one row (the dark mode toggle between them) and the title on its own row under it. */
  readonly stacked: boolean;
}

// ---- The deck list -------------------------------------------------------------------------------------------------------

export interface DecksSearchModel {
  /** The text the screen has taken, never the field's live draft. */
  readonly text: string;
  readonly placeholder: string;
  readonly clearLabel: string;
  /** What the field says while a Steam pad has it (the on-screen keyboard's word). */
  readonly focusPlaceholder?: string;
}

/** The Import / Export box. */
export interface DecksImportModel {
  readonly heading: string;
  readonly description: string;
  readonly open: "paste" | "marvelcdb" | null;
  readonly pasteText: string;
  readonly marvelcdbText: string;
  readonly busy: boolean;
  readonly pasteLabel: string;
  readonly cdbLabel: string;
  readonly exportLabel: string;
  /** Why Export does nothing (nothing selected, a custom pack's card); null when it works. */
  readonly exportDisabled: string | null;
  readonly pastePlaceholder: string;
  readonly linkPlaceholder: string;
  readonly importListLabel: string;
  readonly importCdbLabel: string;
  readonly importingLabel: string;
}

export interface DecksListModel {
  readonly heading: string;
  readonly newDeckLabel: string;
  /** The banner under the heading: a success and a failure look different, and each leads with a mark. */
  readonly status: { readonly text: string; readonly tone: "success" | "error" } | null;
  readonly search: DecksSearchModel;
  readonly filtersLabel: string;
  readonly filtersOpen: boolean;
  /** The chips; empty while they are folded behind the Filters button. */
  readonly chips: readonly FilterChip[];
  readonly rows: readonly McDeckRowModel[];
  /** What the list says when no deck matches. */
  readonly empty: string | null;
  /** The row's height in px (the desktop's larger type needs more). */
  readonly rowHeight: number;
  /** A deck to scroll into view once (a new import, a `focusDeckId`); the key changes for each request. */
  readonly reveal: { readonly deckId: string; readonly key: number } | null;
  /** The list starts from its top (a new tab or list) when this key changes. */
  readonly topKey: number;
  readonly io: DecksImportModel;
}

// ---- The card pool -------------------------------------------------------------------------------------------------------

/** A pool card as a cell shows it: everything is worded already. */
export interface DecksPoolCard {
  readonly cardId: string;
  readonly picture: PictureSource;
  readonly title: string;
  /** The printed cost, or null for a card with none. */
  readonly cost: number | null;
  /** "Event · 1 of 3 in deck". */
  readonly caption: string;
  /** Copies in the deck: more than none draws a heavier frame. */
  readonly quantity: number;
  /** The card is the one shown in the stats pane. */
  readonly shown: boolean;
}

export interface DecksCardsModel {
  readonly title: string;
  /** The chips in the header; the phone folds them behind `foldable`. */
  readonly chips: readonly FilterChip[];
  readonly foldable: { readonly label: string; readonly open: boolean } | null;
  readonly search: DecksSearchModel | null;
  /** What the pane says instead of a grid (no deck selected, no match, still searching). */
  readonly empty: string | null;
  readonly cardIds: readonly string[];
  /** One card, asked for only while its row is in the window. */
  readonly cardAt: (index: number) => DecksPoolCard;
  /** The grid starts from its top when this key changes (a new search, filter or deck). */
  readonly topKey: number;
  /** The settings' card size factor (1 is the default). */
  readonly cardScale: number;
  /** A stable name for what the cells show: a changed value redraws every cell (a language, a pool, a shown card). */
  readonly version: string;
}

// ---- The stats rail ------------------------------------------------------------------------------------------------------

export interface DecksStatTile {
  readonly label: string;
  readonly count: number;
}

export interface DecksActionButton {
  readonly action: DecksAction;
  readonly label: string;
  readonly glyph?: ControlGlyph | undefined;
  /** Why it does nothing now; the press still raises its event (the screen says why). */
  readonly disabled?: string | null;
}

export interface DecksPaneTab {
  readonly action: "pane-deck" | "pane-games";
  readonly label: string;
  readonly selected: boolean;
  /** The LT / RT glyph on the tab that is not showing. */
  readonly glyph?: ControlGlyph | undefined;
}

/** The deck's own numbers: the curve, the composition and the actions on it. */
export interface DecksDeckBody {
  readonly curveHeading: string;
  readonly bars: readonly BarChartBar[];
  readonly compositionHeading: string;
  readonly tiles: readonly DecksStatTile[];
  readonly actions: readonly DecksActionButton[];
  readonly recentlyHeading: string;
  readonly recently: string;
}

/** One card a games section lists: its scan and what the games say about it. */
export interface DecksGamesEntry {
  readonly cardId: string;
  readonly name: string;
  readonly detail: string;
  readonly picture: PictureSource;
}

export type DecksGamesBlock =
  | { readonly kind: "section"; readonly title: string; readonly entries: readonly DecksGamesEntry[] }
  | { readonly kind: "against"; readonly label: string; readonly enabled: boolean }
  | { readonly kind: "note"; readonly text: string };

/** From your games (#529). */
export interface DecksGamesModel {
  /** Still reading the saves: this line, nothing else. */
  readonly reading: string | null;
  readonly headline: string | null;
  readonly insight: string | null;
  readonly blocks: readonly DecksGamesBlock[];
  readonly open: DecksActionButton;
}

/** A pool card shown in the pane in place of the deck's stats. */
export interface DecksCardViewModel {
  readonly cardId: string;
  readonly back: DecksActionButton;
  readonly inspect: DecksActionButton;
  readonly picture: PictureSource;
  readonly name: string;
  readonly typeLine: string;
  readonly blocks: readonly {
    readonly title: string;
    readonly lines: readonly { readonly label: string; readonly value: string }[] | null;
    readonly empty: string;
  }[];
  readonly inDecksHeading: string;
  readonly inDecks: readonly string[];
}

export interface DecksStatsFooter {
  readonly duplicate: DecksActionButton;
  readonly play: DecksActionButton;
}

export interface DecksDeckStatsModel {
  readonly kind: "deck";
  readonly title: string;
  readonly meta: string;
  readonly credit: string | null;
  /** Which of the pane's views shows. */
  readonly mode: "deck" | "games" | "card";
  readonly tabs: readonly DecksPaneTab[];
  readonly deck: DecksDeckBody;
  readonly games: DecksGamesModel | null;
  readonly card: DecksCardViewModel | null;
  readonly footer: DecksStatsFooter;
}

/** A community deck's rail: whose it is, that this game tested it, the notes and the one action. */
export interface DecksCommunityModel {
  readonly kind: "community";
  readonly from: string;
  readonly name: string;
  readonly credit: string;
  /** Aspect stamps, then the status stamp (a lock or a problem is red, a tested deck says so with a tick). */
  readonly stamps: readonly { readonly text: string; readonly fill: string; readonly ink: string }[];
  readonly meta: string;
  /** What keeps it from being added, or null. */
  readonly why: string | null;
  readonly notesHeading: string;
  readonly notes: string;
  readonly noNotes: string;
  readonly scrollCue: string;
  readonly url: string;
  readonly links: readonly DecksActionButton[];
  readonly check: DecksActionButton;
  readonly add: DecksActionButton;
}

export interface DecksEmptyStatsModel {
  readonly kind: "empty";
  readonly text: string;
}

export type DecksStatsModel = DecksDeckStatsModel | DecksCommunityModel | DecksEmptyStatsModel;

// ---- The page ------------------------------------------------------------------------------------------------------------

export interface DecksPageModel {
  /** Three panes side by side; narrow shows one at a time behind the tab rail. */
  readonly wide: boolean;
  readonly phone: boolean;
  readonly tab: DecksTab;
  readonly tabs: readonly TabRailTab[];
  /** The LB / RB glyph over the tab rail (narrow, a keyboard or pad in use). */
  readonly tabsGlyph?: ControlGlyph | undefined;
  readonly header: DecksHeaderModel;
  readonly list: DecksListModel;
  readonly cards: DecksCardsModel;
  readonly stats: DecksStatsModel;
}

/**
 * The Decks & Collection screen (PLAN.md Phase 9 / W9b, docs/phase4-screen-gaps.md
 * §3, D14): every precon plus every saved or imported deck, each with its
 * legality/playability status; a searchable, filterable list (S8); the
 * *selected* deck's own browsable card pool; its stats; import by paste
 * (works everywhere) and by MarvelCDB URL/id (dev/preview through the
 * same-origin route `vite-marvelcdb-import.ts` adds, and in a packaged app
 * through native HTTP — `platform/deck-fetch.ts`); save, delete, duplicate,
 * export, and "Play this deck ▸".
 *
 * **The composition, read straight off D14's own markup** (`ScreensDesktop_12`/
 * `_13`.png plus `Marvel Champions game screens/Screens - Desktop.dc.html`'s
 * `#s14` — see `view/decks-layout.ts`'s own header comment for the full
 * reasoning): an ink chrome bar (Back, a large Bangers screen title, a
 * right-aligned pool-count label) over a paper ground, then three columns —
 * **"YOUR DECKS"** (the list *owns* the column — search plus a collapsed-by-
 * default "Filters" toggle in one compact row, then deck cards filling
 * whatever's left, ink-filled selected with its record shown only there,
 * red-bordered illegal/WIP, "+ NEW DECK" on the column header's own line (always in view), a small
 * group label folded into the top of each group's first card rather than its
 * own full-height row, then a *compact* parchment Import/Export box pinned to
 * the column's bottom with its paste/MarvelCDB/export fields collapsed behind
 * three small buttons), **"CARD POOL"** (the *selected* deck's own browsable
 * legal cards, filter chips right-aligned on the header's own rule line, each
 * cell's art, a cost pip, and an uppercase "TYPE · X OF Y IN DECK" caption),
 * and the **ink stats rail** (a large Bangers deck title, curve bars with the
 * deck's most-common costs in red, composition tiles as a label over a
 * Bangers number, "Recently changed", ending in DUPLICATE + the single red
 * "PLAY THIS DECK ▸"). Narrow screens get the same three groups behind a
 * "Decks"/"Cards"/"Stats" tab strip.
 *
 * **Deliberately not the mock, each noted where it happens:** the mock's
 * Import/Export box shows description text only — this build already has
 * paste-import, MarvelCDB-import and export, so those controls live inside
 * that box, collapsed behind small buttons so the box stays compact by
 * default. The deck note and owned-card tracking are both skipped per
 * docs/phase4-screen-gaps.md §4 (advice text and owned-card tracking are
 * undecided/out of scope) — the header's right-aligned label says the real
 * pool size ("CARD POOL · N CARDS") rather than the mock's "Core Set · N of N
 * owned" wording, since this pool already spans Core and wave 1 and "Core
 * Set" would misstate that (docs/phase4-screen-gaps.md §5's own standard).
 * S8's search field and quick-filter chips (added after D14 was drawn) sit
 * above the deck list, collapsed by default so they cost one compact row
 * rather than crowding the list out. A precon's card title is its short
 * "HERO / ASPECT" form (its long printed name moves into the meta line);
 * a saved/imported deck's title is simply its own name, already short because
 * a player chose it. Check/Edit/Delete — real, needed actions the mock
 * doesn't draw at all — live as a row of small buttons in the stats rail,
 * under the composition tiles, so the rail's own footer still ends in exactly
 * Duplicate + the red Play button, as designed. The pool's art area draws a
 * real card's own 2.5:3.5 shape rather than the mock's arbitrarily-tall
 * placeholder box (`view/deck-pool-grid.ts`'s own header comment). Not
 * reproduced: the mock's red ring on a hovered/focused pool cell — this
 * screen's per-cell objects are torn down and redrawn on every scene
 * `#rebuild()` (`ui/virtual-list.ts`'s own documented pattern), so a
 * pointer-move-driven highlight would need a lighter-weight redraw path than
 * that; left as a follow-up rather than added under this pass's time budget.
 *
 * **Community decks** (2026-10-10, `view/community-decks-model.ts`): the tested public MarvelCDB decklists
 * (`@mc/cards`'s `communityDecks`) are a third list group, after the player's own decks. They are recommendations,
 * labeled as community decks from MarvelCDB and never as precons. Selecting one shows its own card list in the
 * middle pane (cards open in Inspect) and, in the stats rail's place, the author's credit, a Tested stamp, the
 * decklist's published date and version, the author's notes, the MarvelCDB link and one action: add an editable copy. A deck
 * whose hero or cards the player has not unlocked is shown dimmed with what opens it, and cannot be added.
 *
 * A deck row's tap **selects** it (updates the pool and stats panes) rather
 * than navigating away; a pool card's tap opens Inspect (this screen never
 * edits a deck's contents — that's `scenes/deck-builder.ts`, reached from
 * "Edit"). Every legality/playability/record fact shown here is `@mc/engine`'s
 * own (`view/deck-list-model.ts`'s `deckOptionsOf`, `view/deck-status.ts` for
 * the chip's words, `view/results-history.ts` for the record) — this scene
 * never decides whether a deck is legal or what its record is.
 */

import { sheetThemeFor } from "../ui/campaign-chrome.js";
import { t } from "../i18n/translate.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import type { DeckActionId } from "../view/deck-actions.js";
import type { DeckActionsSheet, DeckActionsSheetData } from "./deck-actions-sheet.js";
import type { PictureFocus } from "../art/focus.js";
import Phaser from "phaser";
import "@mc/ui";
import type { McInputDetail, McMediaRowModel, McSearchDetail, McSearchField, McSheet, McTextField } from "@mc/ui";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { aspectStampsOf } from "../view/aspect-stamp.js";
import { inputDevice } from "../platform/input-device.js";
import { aspectStampOf } from "../view/aspect-stamp.js";
import { type AnyCard, type CoreAspect, type Deck, type DeckId, type HeroIdentityCard } from "@mc/content";
import { communityDecks } from "@mc/cards";
import { DECK_MIN_CARDS } from "@mc/engine";
import {
  POOL_VERSION,
  currentDeps,
  currentHeroShelfPacks,
  currentPool,
  currentCardsById,
  currentPoolKey,
  packNameOf,
} from "../content/pool.js";
import { aspectLabelOf } from "../view/seat-slots.js";
import { packPictureFor } from "../art/pack-art.js";
import {
  CUSTOM_EXPORT_REASON,
  canExportToMarvelCdb,
  customBadgeOf,
  deckUsesCustomCards,
  isCustomCard,
} from "../view/custom-content.js";
import { heroPacksOf } from "../view/hero-deck-groups.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import type { SearchDocument } from "../view/deck-search.js";
import { localizedLabelOf } from "../view/card-text.js";
import { testedCatalog } from "../view/seatable-decks.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { cardArt, type ArtRedraw } from "../art/card-art.js";
import { artFor, artLanguageNow, type ArtSource } from "../art/art-source.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import { artKeyFor } from "../art/card-art.js";
import { markRenderDirty } from "../ui/idle-render.js";
import {
  browsablePool,
  duplicateDeck,
  subtitleCutFrom,
  typeWordOf,
  type PoolFilter,
} from "../view/deck-builder-model.js";
import {
  exportDecklistText,
  importFromPasteText,
  type ImportEnv,
  type ImportOutcome,
} from "../view/deck-import-model.js";
import {
  addCommunityDeck,
  communityCredit,
  communityEntryOf,
  communityMetaCandidates,
  communityNotesOf,
  communityOfferMatches,
  testedEntryOf,
  testedSearchFieldsOf,
  communityDeckAsDeck,
  communityOffers,
  communityStatusText,
  communityPublishedText,
  type CommunityOffer,
} from "../view/community-decks-model.js";
import {
  cachedDeckOption,
  deckOptionOf,
  deckRowIndexOf,
  pendingDeckOption,
  preconDecks,
  primeDeckOption,
  verdictOf,
  type DeckOption,
} from "../view/deck-list-model.js";
import { sortByRecency } from "../view/deck-recency.js";
import {
  compositionTilesOf,
  costCurveBars,
  deckCountText,
  deckStatsOf,
  type CompositionTile,
  type CostCurveBar,
} from "../view/deck-stats.js";
import { deckStatusOf } from "../view/deck-status.js";
import { cardTitleOf, deckAspectsText, deckMetaCandidates } from "../view/deck-title.js";
import { decksLayout, type DecksTab } from "../view/decks-layout.js";
import { poolGridGeometry } from "../view/deck-pool-grid.js";
import { cardSizeFactor } from "../settings.js";
import {
  deckListChips,
  deckListGroupOf,
  deckListShows,
  nextDeckList,
  freshDeckVisit,
  readLastDeckList,
  reconcileDeckSelection,
  writeLastDeckList,
  type DeckListId,
} from "../view/deck-list-open.js";
import {
  deckSourcesOf,
  heroAspectsOf,
  heroRosterMatches,
  withSelectionPinned,
  type RosterFilter,
} from "../view/roster-filter.js";
import { decksFocusOrder } from "../view/screen-focus.js";
import { deckKeyToString, resultsHistoryOf, type DeckKey, type ResultsHistory } from "../view/results-history.js";
import { CHIP_GAP, chipsFitBesideHeading, minChipCellWidth } from "../view/chip-layout.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { HoverPreview, hoverCardIdsOf, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import {
  NOTHING_STANDS_OUT,
  againstVillainOf,
  cardPlayOf,
  fromYourGamesOf,
  fromYourGamesType,
  villainsFacedOf,
  type DeckInsights,
  type SuggestedCard,
} from "../view/deck-insights.js";
import { layerTriggerGlyph } from "../view/input-glyph-model.js";
import { loadDeckInsights } from "../view/player-stats-client.js";
import { clipToView } from "../view/focus-list.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { drawCardPool, poolWindowKey } from "../dom/card-pool-sheet.js";
import type { CardPoolCard, CardPoolLayout } from "../dom/card-pool-sheet.types.js";
import type { Picture } from "../art/pictures.js";
import { deckReasonText } from "../view/deck-reason.js";
import { oneDecimal } from "../view/number-format.js";
import { PictureLeases } from "../dom/picture-leases.js";
import { heroPictureOf, type HeroPicture } from "../dom/hero-picture.js";
import { drawTintButton } from "../dom/tint-button.js";
import { CardPoolSearch, createPoolDocumentCache, poolSearchDocuments } from "../view/card-pool-search.js";
import { accent, border, hit, ink, minType, signal, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf } from "../ui/theme.js";
import { McButton, paintDotGrid, paintPanel, STAMP_CHIP_TYPE } from "../ui/widgets.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { appSession, deckStorage } from "../session.js";
import { isCommunityDeckId } from "../view/community-deck-id.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import type { TitleSceneData } from "./title.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { SCENES } from "./keys.js";
import type { PlayerStatsData } from "./player-stats.js";
import { importedDeckNote, importMarvelCdbDeck } from "../platform/marvelcdb-import.js";
import { openExternal } from "../platform/platform.js";
import { refreshUnlocks, unlocks } from "../progression/progression.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { onLanguageChange } from "../language-change.js";

/** What a caller (Title, on an `illegal_deck` refusal) hands over on launch. */
export interface DecksSceneData {
  /** Selected and scrolled into view; named in `message` — the deck `createGame` just refused. */
  readonly focusDeckId?: string | null;
  readonly message?: string | null;
}

/** Tall enough for a 1-line title + a 2-line precon meta + a selected row's record line, comfortably. */
const ROW_HEIGHT = 84;
/** A row on desktop: its larger description (`readingSize`) still fits the full line under a two-line name. */
const DESKTOP_ROW_HEIGHT = 100;
/** A deck row's hero picture, wide for its height: a cover crop of the hero's face and shoulders. */
const DECK_THUMB_ASPECT = 1.25;
/** How much of a group-starting row's own top is given to its small group label instead of the card. */
const GROUP_LABEL_HEIGHT = 16;

const importExportDescription = (): string => t("decks.io.description");

/** A compact chip/button row's own height — smaller than `hit.target`'s 44px touch target, matching D14's small filter/action controls (point 2/3/5 of the 2026-09-18 fidelity pass). Still comfortably tappable. */
const COMPACT_ROW = 28;
/** The same row on a touch layout (phone, tablet): a full touch target. */
const TOUCH_ROW = hit.target;

/** The community group's label, on its first row: says where the decks come from and that they are not precons. */
const communityGroupLabel = (): string => t("decks.group.community");
/** One line of the author's notes in the detail rail. */
const NOTES_LINE_HEIGHT = 17;

/** One row of the deck list: a deck row (optionally the first of a group, carrying that group's small label) or the empty-search message — see the module doc comment for why a group no longer gets its own full-height row. "+ New deck" is not a row: it sits on the pane's header line, always in view. */
type DeckRow =
  | {
      readonly kind: "deck";
      readonly option: DeckOption;
      readonly groupLabel?: string;
      /** Set on a community deck's row (`view/community-decks-model.ts`): a recommendation, not one of the player's decks. */
      readonly offer?: CommunityOffer;
    }
  | { readonly kind: "message"; readonly text: string };

/** `deck`'s namespaced record key — the same one `view/results-history.ts` keys `DeckRecord` by. */
function keyOf(deck: Deck): DeckKey {
  return deck.source.kind === "precon"
    ? { kind: "starter", starterDeckId: deck.source.starterDeckId as string }
    : { kind: "custom", deckId: deck.id as string };
}

/** The pool list's element key. */
const POOL_LIST = "list:pool";

/** One chip/button's own natural width — never less than it needs (`minChipCellWidth`'s own estimate is deliberately conservative), so a row of these can never truncate the way equal-width division could. */
interface ChipDef {
  readonly id: string;
  readonly text: string;
  readonly selected: boolean;
  readonly onClick: () => void;
  /** An aspect chip's stamp color (`view/aspect-stamp.ts`), matching the stamps on the deck rows it filters. */
  readonly tint?: { readonly fill: number; readonly ink: number };
}

interface PlacedChip {
  readonly chip: ChipDef;
  readonly rect: Rect;
}

/**
 * Packs `chips` at their own natural width (2026-09-18 fidelity pass, point 6: the truncation this screen's own
 * quick-filter and pool-filter chips used to show came from dividing a row's width *equally* among every chip in
 * it — `view/chip-layout.ts`'s `wrapChipsToRows`, built for exactly that shape — rather than from the width
 * estimate itself being wrong. Giving each chip exactly the width `minChipCellWidth` already says it needs removes
 * the truncation risk structurally, without touching that estimate or the other screens still using equal-width
 * rows). `align: "right"` packs each row from the row's own right edge backward (D14's own pool-filter placement).
 */
function packChipsNatural(
  chips: readonly ChipDef[],
  x: number,
  y: number,
  maxWidth: number,
  rowHeight: number,
  align: "left" | "right" = "left",
  widthOf: (chip: ChipDef) => number = (chip) => minChipCellWidth(chip.text),
): { readonly placed: readonly PlacedChip[]; readonly bottom: number } {
  const rows: { chip: ChipDef; width: number }[][] = [];
  let current: { chip: ChipDef; width: number }[] = [];
  let currentWidth = 0;
  for (const chip of chips) {
    const width = widthOf(chip);
    const needed = current.length === 0 ? width : currentWidth + CHIP_GAP + width;
    if (current.length > 0 && needed > maxWidth) {
      rows.push(current);
      current = [{ chip, width }];
      currentWidth = width;
    } else {
      current.push({ chip, width });
      currentWidth = needed;
    }
  }
  if (current.length > 0) rows.push(current);

  const placed: PlacedChip[] = [];
  rows.forEach((row, rowIndex) => {
    const rowY = y + rowIndex * (rowHeight + CHIP_GAP);
    const rowWidth = row.reduce((sum, entry, index) => sum + entry.width + (index > 0 ? CHIP_GAP : 0), 0);
    let cursorX = align === "right" ? x + maxWidth - rowWidth : x;
    for (const { chip, width } of row) {
      placed.push({ chip, rect: { x: cursorX, y: rowY, width, height: rowHeight } });
      cursorX += width + CHIP_GAP;
    }
  });
  return { placed, bottom: rows.length === 0 ? y : y + rows.length * (rowHeight + CHIP_GAP) - CHIP_GAP };
}

/**
 * This screen opts out of the desktop type bump (`ui/desktop-type.ts`) to keep its card grid tight, so its reading text
 * sizes up here: `px` on a phone or tablet, two sizes up on a desktop.
 */
/** How far the ink header bar reaches below the header row: short of the panes' top (`decks-layout.ts`'s GAP of 16), so a pane's first line (its heading and chips) is not set against the bar. */
const HEADER_FOOT = 8;

const readingSize = (px: number): number => (isDesktopType() ? px + 2 : px);

/** How tall the compact Import/Export box needs to be at `column` px wide, in its current accordion state — used both to reserve room above it and to draw it, so the two can't drift apart. */
function importExportBoxHeight(column: number, open: "paste" | "marvelcdb" | null, row: number): number {
  const pad = 12;
  const descLines = estimateWrappedLines(importExportDescription(), column - pad * 2, isDesktopType() ? 6.4 : 4.6);
  const lineHeight = isDesktopType() ? 17 : 13;
  let height = pad * 2 + 16 + descLines * lineHeight + 8 + row + 8; // padding + heading + description + button row
  if (open === "paste") height += 64 + 8 + row + 8; // textarea + its own Import button
  if (open === "marvelcdb") height += row + 8 + row + 8; // URL field + its own Import button
  return height;
}

/** How long a finished load waits for the others before the screen redraws. */
const REBUILD_COALESCE_MS = 40;

/** At most this many unchecked decks are checked on the main thread rather than sent to the worker. */
const STATUS_HERE_MAX = 4;

export class DecksScene extends Phaser.Scene {
  #savedDecks: readonly Deck[] = [];
  #data: DecksSceneData = {};
  /** The banner under the header. A success and a failure look different: an import that worked was drawn in error red. */
  #status: { readonly text: string; readonly tone: "success" | "error" } | null = null;
  #busy = false;
  #pasteText = "";
  #marvelcdbText = "";
  /** True while the caret is in the paste or MarvelCDB field (the route stands aside). */
  #fieldFocused = false;
  /** The card pool pane's text search (name, traits, type, rules text, and `field:value` terms), kept across rebuilds. */
  #poolSearchText = "";
  /** Both text searches run in a worker (view/deck-search-client.ts); each ranking is the last answer, shown until the next arrives. Null when no search is active. */
  readonly #deckSearch = new DeckSearchClient();
  #deckRanking: ReadonlyMap<string, number> | null = null;
  #deckDocsVersion: string | null = null;
  /** The deck list's first status pass also runs in the `#deckSearch` worker (`DeckSearchClient.checkDecks`); a deck is asked about once. */
  #statusAsked = new WeakSet<Deck>();
  /** The pool the asked decks were sent against; a change (a pack loaded) forgets them so each is checked again. */
  #statusAskedPool = "";
  /** Bumped whenever a worker's answer is remembered, so `#offersCache` is rebuilt from the new statuses. */
  #statusEpoch = 0;
  /** True while `#askStatuses` is calling `checkDecks`: an answer that comes back inside the call (no worker) is used by the draw already under way. */
  #askingStatuses = false;
  #rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  /** The pool search: `field:value` terms filter here, the free words are ranked by the worker (`view/card-pool-search.ts`). */
  #poolSearch!: CardPoolSearch;
  #poolDocsVersion: string | null = null;
  /** The deck and identity the pool pane draws now: what the search worker ranks. */
  #poolContext: { readonly deck: Deck; readonly identity: HeroIdentityCard } | null = null;
  /** The pool list starts from its top (a new search, filter or deck) on the next draw. */
  #poolFromTop = false;
  /** What the pool list last drew: its rows, for the scroll's window and the focus stops. */
  #poolMetrics = { rowHeight: 0, rowCount: 0, viewHeight: 0, window: "" };
  readonly #poolHooked = new WeakSet<HTMLElement>();
  /** `cardSearchDocumentOf` per card id: the rules text is built once, not per selected deck. */
  readonly #poolDocs = createPoolDocumentCache();
  /** The deck whose Delete was pressed once and awaits its confirming second press. */
  #deleteArmedId: string | null = null;
  #filter: RosterFilter = { text: "" };
  /** Collapsed by default (2026-09-18 fidelity pass, point 2): the quick-filter chips cost nothing until asked for, so the deck list itself gets the column's room. */
  #filtersExpanded = false;
  /** Whether a phone's pool chips are open under their Filters button; they start folded to leave the cards the room. */
  #poolFiltersOpen = false;
  /** Which of the Import/Export box's two fields is open, if either — collapsed by default so the box stays compact and pinned at the column's bottom. */
  #importExportOpen: "paste" | "marvelcdb" | null = null;
  #poolAspectFilter: CoreAspect | "basic" | "identity" | null = null;
  #poolSortByCost = false;
  #selectedDeckId: string | null = null;
  /** `#deckArtOf`, per identity. */
  readonly #deckArt = new Map<string, { url: string | null; tileUrl?: string; focus?: PictureFocus }>();
  /** The bundled hero picture chosen per identity this visit (a hero with several keeps one). */
  readonly #deckPictures = new Map<string, Picture | null>();
  /** The leases this screen holds on its mounted card and hero pictures (`dom/picture-leases.ts`). */
  readonly #pictures = new PictureLeases();
  #activeTab: DecksTab = "decks";
  #history: ResultsHistory | null = null;
  /** What each deck's finished games say (`view/deck-insights.ts`), folded in the stats worker; null until it answers. */
  #insights: DeckInsights | null = null;
  /** The villain the games pane reads your winning decks against (a stepper); null: the most faced. */
  #againstVillain: string | null = null;
  /** The stats pane's tab: the deck's own numbers, or what your games say about it (#529). LT / RT switch them. */
  #paneTab: "deck" | "games" = "deck";
  /**
   * The pool card shown in the stats pane (#529): a tap or A on a pool card puts it there with what your games say
   * about it, in place of opening Inspect; "◂ Deck stats" (or B) goes back to the deck. Null: the deck's stats.
   */
  #paneCard: AnyCard | null = null;
  /** The deck `#paneCard` was opened on: a different selection (a copy, an import) shows that deck's stats instead. */
  #paneCardDeckId: string | null = null;
  #buttons: McButton[] = [];
  /** Whether the narrow layout's Decks / Cards / Stats tabs are up this draw (null on the three-pane desktop). */
  #tabsShown = false;
  /** The chrome and the deck list pane: one Lit panel over the canvas, kept across draws so the search keeps its caret. */
  #region: DomRegion<McSheet> | null = null;
  #glyphs!: SheetGlyphs;
  /** What each key in the panel does when tapped (and when held), this draw. */
  #actions = new Map<string, () => void>();
  #inspects = new Map<string, () => void>();
  /** True while the caret is in the deck search field (the route stands aside). */
  #searchFocused = false;
  /** The Phaser-drawn panes (pool, stats, Import/Export), cut out of the panel to be seen through it. */
  #holes: Rect[] = [];
  /** The card pictures of the From your games view, for the hover popover (on screen: the view does not scroll). */
  #paneThumbs: { readonly cardId: string; readonly slot: string; readonly rect: Rect }[] = [];
  /** The deck rows pictures in the list content space, for the hover popover. */
  #thumbTargets: { readonly cardId: string; readonly slot: string; readonly rect: Rect }[] = [];
  /** The deck list starts from its top (a new tab or list) or reveals a deck on the next draw. */
  #listFromTop = false;
  #revealDeckId: string | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #obstacles: Rect[] = [];
  #stops = new Map<string, FocusStop>();
  /** A scan drawn outside the pool grid this draw was not on hand yet, so its arrival redraws the screen. */
  #paneArtMissing = false;
  /** The scans drawn outside the pool grid this draw, asked for again on each arrival. */
  #paneArt: { readonly source: ArtSource; readonly rect: Rect; readonly texture: unknown }[] = [];
  /** The list shown alone (the Preconstructed, Your decks or Community chip), or null for all three (#755). */
  #deckList: DeckListId | null = null;
  /** `communityOffers` for the saved decks and unlocks it was last built from (both are replaced, never mutated). */
  #offersCache: {
    readonly epoch: number;
    readonly saved: readonly Deck[];
    readonly gate: unknown;
    readonly offers: readonly CommunityOffer[];
  } | null = null;
  #focusedOnce = false;
  /** The desktop hover popover over the pool grid's cards and the deck rows' thumbnails (`ui/card-hover-preview.ts`). */
  #hover: HoverPreview | null = null;
  /** Each scrolling list's on-screen card rects, computed on demand from its scroll (a scroll draws nothing). */
  #hoverLists: (() => readonly (readonly [string, HoverCardIdRect])[])[] = [];
  /** Where each deck row's thumbnail sits inside its row, by deck id, recorded as the row draws. */
  /** The deck an import just added: the next list draw scrolls to it, once. */
  #scrollToDeckId: string | null = null;
  /** True while the selected row is only the first one, standing in for a `focusDeckId` deck not loaded yet. */
  #fallbackSelection = false;
  /** True until the list is changed: a `focusDeckId` deck opens on every list, but only on the way in. */
  #focusPinned = true;

  constructor() {
    super(SCENES.decks);
  }

  create(data: DecksSceneData = {}): void {
    rebuildOnPackChange(this, () => this.#rebuild());
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#data = data;
    // Title only sends a message here when a deck could not be seated.
    this.#status = data.message ? { text: data.message, tone: "error" } : null;
    this.#savedDecks = [];
    this.#busy = false;
    this.#pasteText = "";
    this.#marvelcdbText = "";
    this.#filter = { text: "" };
    this.#filtersExpanded = false;
    this.#poolFiltersOpen = false;
    this.#importExportOpen = null;
    this.#poolAspectFilter = null;
    this.#poolSortByCost = false;
    this.#poolSearchText = "";
    this.#deckSearch.cancel();
    this.#deckRanking = null;
    this.#deckDocsVersion = null;
    // A fresh search (and its worker) each visit: the last one was ended when the screen shut down.
    this.#poolSearch = new CardPoolSearch({
      alive: () => this.sys.isActive(),
      language: () => artLanguageNow(),
      documents: () => this.#poolDocuments(),
      onChange: () => {
        this.#poolFromTop = true;
        this.#rebuild();
      },
    });
    this.#poolDocsVersion = null;
    this.#poolContext = null;
    this.#deleteArmedId = null;
    this.#selectedDeckId = data.focusDeckId ?? null;
    this.#activeTab = "decks";
    this.#history = null;
    this.#insights = null;
    this.#listFromTop = true;
    this.#region = null;
    this.#searchFocused = false;
    this.#fieldFocused = false;
    this.#holes = [];
    this.#poolFromTop = true;
    // A deck asked for by id (just saved, or sent here) is looked for in every list, so it is never filtered away.
    const openSettings = appSession().settings;
    const visit = freshDeckVisit(
      data.focusDeckId,
      openSettings.deckListOnOpen,
      readLastDeckList(),
      openSettings.showPreconDecks,
    );
    this.#deckList = visit.deckList;
    this.#focusPinned = visit.focusPinned;
    this.#fallbackSelection = visit.fallbackSelection;
    this.#offersCache = null;
    this.#focusedOnce = false;

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    const offLanguage = onLanguageChange(() => this.#rebuild());
    appSession().music?.playTitle();
    const artOff = cardArt(this).onArrived((why) => this.#artArrived(why));
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      artOff();
      this.#hover?.destroy();
      this.#hover = null;
      if (this.#rebuildTimer !== null) clearTimeout(this.#rebuildTimer);
      this.#rebuildTimer = null;
      this.#deckSearch.destroy();
      this.#pictures.dispose();
      this.#poolSearch.destroy();
      this.#hints.dispose();
      this.#glyphs.dispose();
      offLanguage();
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
    this.#hints = new GlyphHints(this, () => this.#obstacles);
    this.#glyphs = new SheetGlyphs(
      this,
      () => this.#rebuild(),
      () => this.#obstacles,
    );
    // A pad that put the caret in a field can take it out again (B, A or Start).
    const covered = (): boolean => this.scene.isActive(SCENES.inspect);
    bindTextFieldEscape(
      this,
      () => ({ focused: this.#searchFocused, blur: () => this.#searchField()?.blurInput() }),
      covered,
    );
    bindTextFieldEscape(this, () => this.#poolSearchField(), covered);
    bindTextFieldEscape(
      this,
      () => ({
        focused: this.#fieldFocused,
        blur: () => {
          this.#importField("paste-field")?.blurInput();
          this.#importField("marvelcdb-field")?.blurInput();
        },
      }),
      covered,
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // B leaves for Title, as the Back button does (a field being typed in owns the keys, so this is not reached then).
      onCancel: () => {
        // A card in the stats pane goes back to the deck's stats first.
        if (this.#paneCard && this.#stops.has("card-back")) {
          this.#closePaneCard(true);
          return;
        }
        // An open Paste / CDB link box closes first; the next B leaves.
        if (this.#importExportOpen !== null) {
          this.#importExportOpen = null;
          this.#rebuild();
        } else this.#stops.get("back")?.activate();
      },
      // LB / RB step Decks, Cards and Stats on a narrow screen; on the three-pane layout there is no strip, so they page.
      onTab: (direction) => this.#stepTab(direction),
      // LT / RT: the stats pane's two tabs (LB / RB already step the narrow layout's tabs).
      onTrigger: (trigger) => this.#setPaneTab(trigger === "lt" ? "deck" : "games"),
      // X (G / H on the keyboard) opens Your stats.
      onToggle: () => this.#stops.get("player-stats")?.activate(),
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        this.scene.isActive(SCENES.deckActions) ||
        this.#fieldFocused ||
        this.#searchFocused ||
        (this.#poolSearchField()?.focused ?? false),
      onPage: (direction) => {
        const scroller = this.#pageScroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * 0.85 });
      },
      onScroll: (_dx, dy) => this.#pageScroller()?.scrollBy({ top: dy }),
      onHomeEnd: (edge) => this.#pageScroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });

    this.#rebuild();
    fadeScreenIn(this);
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#savedDecks = decks;
        this.#queueRebuild();
      });
    // A community deck is offered only when its hero and cards are open; the wins that decide that load here.
    void refreshUnlocks().then((changed) => {
      if (changed && this.sys.isActive()) this.#queueRebuild();
    });
    void appSession()
      .store.listSaves()
      .then((saves) => {
        if (!this.sys.isActive()) return;
        this.#history = resultsHistoryOf(saves);
        this.#queueRebuild();
        return loadDeckInsights(saves).then((insights) => {
          if (!this.sys.isActive()) return;
          this.#insights = insights;
          this.#queueRebuild();
        });
      })
      .catch(() => undefined);
  }

  /**
   * One redraw for the loads that finish together (saved decks, unlocks, saves, a worker's statuses): each used to
   * redraw the whole screen on its own, back to back, which on a slow device is most of a second apiece (#226).
   */
  #queueRebuild(): void {
    if (this.#rebuildTimer !== null) return;
    this.#rebuildTimer = setTimeout(() => {
      this.#rebuildTimer = null;
      if (this.sys.isActive()) this.#rebuild();
    }, REBUILD_COALESCE_MS);
  }

  #searchField(): McSearchField | null {
    return (this.#region?.element.elementOf("deck-search") as McSearchField | null) ?? null;
  }

  #listScroller(): HTMLElement | null {
    return this.#region?.element.elementOf("deck-list") ?? null;
  }

  /** A chip of a filter bar in the panel, on screen now, or null (the sheet finds it inside the bar). */
  #barCell(_barKey: string, cellKey: string): Rect | null {
    const cell = this.#region?.element.elementOf(cellKey);
    return cell ? this.#region!.rectOf(cell) : null;
  }

  /** Hands the built parts to the panel (made once) and renders them now; the Phaser panes show through its holes. */
  #mount(width: number, height: number, builder: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      // A pack scan that fails to load reads its file again (`mc-image-error` from a part with a retry key).
      this.#pictures.watch(element);
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-inspect", (event) => {
        this.#inspects.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-search", (event) => {
        const { value, key } = (event as CustomEvent<McSearchDetail & { key?: string }>).detail;
        if (key === "pool-search") {
          if (value !== this.#poolSearchText) {
            this.#poolSearchText = value;
            this.#poolSearch.request(value);
          }
          return;
        }
        if (value === this.#filter.text) return;
        this.#filter = { ...this.#filter, text: value };
        this.#requestDeckSearch(value);
      });
      element.addEventListener("mc-input", (event) => {
        const key = (event.composedPath()[0] as HTMLElement | undefined)?.dataset?.key;
        const { value } = (event as CustomEvent<McInputDetail>).detail;
        if (key === "paste-field") this.#pasteText = value;
        else if (key === "marvelcdb-field") this.#marvelcdbText = value;
      });
      element.addEventListener("mc-field-focus", (event) => {
        this.#fieldFocused = (event as CustomEvent<{ focused: boolean }>).detail.focused;
      });
      element.addEventListener("mc-search-focus", (event) => {
        this.#searchFocused = (event as CustomEvent<{ focused: boolean }>).detail.focused;
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
      this.#region.forwardMouseMoves();
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [...this.#holes, popover] : this.#holes;
    });
    region.element.nodes = builder.nodes;
    renderNow(region.element);
    // The new parts are mounted: the pictures the last pass held are given back now.
    this.#pictures.end();
    const pool = this.#poolScroller();
    if (pool) {
      if (!this.#poolHooked.has(pool)) {
        this.#poolHooked.add(pool);
        pool.addEventListener("scroll", () => this.#onPoolScroll(pool.scrollTop), { passive: true });
      }
      if (this.#poolFromTop) pool.scrollTop = 0;
    }
    this.#poolFromTop = false;
    const scroller = this.#listScroller();
    if (scroller && this.#listFromTop) {
      scroller.scrollTop = 0;
      this.#listFromTop = false;
    }
    if (scroller && this.#revealDeckId) {
      region.element.elementOf(`deck:${this.#revealDeckId}`)?.scrollIntoView({ block: "nearest" });
      this.#revealDeckId = null;
    }
  }

  /** The deck rows pictures on screen with their place, for the hover popover (the list scroll applied). */
  #deckThumbHovers(): readonly (readonly [string, HoverCardIdRect])[] {
    const scroller = this.#listScroller();
    const view = scroller ? this.#region!.rectOf(scroller) : null;
    if (!scroller || !view) return [];
    const found: (readonly [string, HoverCardIdRect])[] = [];
    for (const target of this.#thumbTargets) {
      const rect = clipHoverRect({ ...target.rect, y: view.y + target.rect.y - scroller.scrollTop }, view);
      if (rect) found.push([target.slot, { ...rect, cardId: target.cardId, through: true }]);
    }
    return found;
  }

  /** Precons (fixed order) plus saved decks, most recently changed first (W9's "Recently changed") — `deckOptionsOf` already puts precons ahead of whatever list it's given. */
  #deckOptions(): readonly DeckOption[] {
    return [...preconDecks(POOL_VERSION), ...sortByRecency(this.#savedDecks)].map((deck) => this.#optionOf(deck));
  }

  /** A deck's status if it is known, else a "Checking…" stand-in until the worker answers (`#askStatuses`). */
  #optionOf(deck: Deck): DeckOption {
    return cachedDeckOption(deck, currentPool(), POOL_VERSION, currentDeps()) ?? pendingDeckOption(deck, currentPool());
  }

  /**
   * Asks the worker for the status of every listed deck that has none yet (precons, saved and community decks, in one
   * message) and redraws once when it answers. The first visit used to check them all on the main thread before the
   * screen drew (#226). With no worker the answer comes back before this returns and nothing is redrawn.
   */
  #askStatuses(): void {
    const listed = [
      ...preconDecks(POOL_VERSION),
      ...this.#savedDecks,
      ...communityDecks().map((entry) => communityDeckAsDeck(entry, POOL_VERSION)),
    ];
    // The selected deck (the first row until one is picked) is checked here at once: its pane and "Play this deck" act
    // on it, and a deck still being checked can't be seated.
    const shownId = this.#selectedDeckId ?? this.#data.focusDeckId ?? null;
    const shown = shownId === null ? listed[0] : listed.find((deck) => (deck.id as string) === shownId);
    if (shown && cachedDeckOption(shown, currentPool(), POOL_VERSION, currentDeps()) === null) {
      deckOptionOf(shown, currentPool(), POOL_VERSION, currentDeps());
      this.#statusEpoch += 1;
    }
    if (this.#statusAskedPool !== currentPoolKey()) {
      this.#statusAskedPool = currentPoolKey();
      this.#statusAsked = new WeakSet<Deck>();
    }
    const unchecked = listed.filter(
      (deck) =>
        !this.#statusAsked.has(deck) && cachedDeckOption(deck, currentPool(), POOL_VERSION, currentDeps()) === null,
    );
    // The worker knows the base pool only: a deck with a custom pack's cards is checked here, against the loaded packs.
    const custom = unchecked.filter(deckUsesCustomCards);
    for (const deck of custom) deckOptionOf(deck, currentPool(), POOL_VERSION, currentDeps());
    if (custom.length > 0) this.#statusEpoch += 1;
    const decks = unchecked.filter((deck) => !deckUsesCustomCards(deck));
    if (decks.length === 0) return;
    // A deck or two (one just imported, saved or copied) is checked here at once, so it never shows "Checking…":
    // the worker is for the first visit's whole list, which is where the time went.
    if (decks.length <= STATUS_HERE_MAX) {
      for (const deck of decks) deckOptionOf(deck, currentPool(), POOL_VERSION, currentDeps());
      this.#statusEpoch += 1;
      return;
    }
    for (const deck of decks) this.#statusAsked.add(deck);
    this.#askingStatuses = true;
    try {
      this.#deckSearch.checkDecks(
        decks,
        (asked) => asked.map((deck) => verdictOf(deck, currentPool(), POOL_VERSION, currentDeps())),
        (verdicts) => {
          decks.forEach((deck, at) => primeDeckOption(deck, currentPool(), POOL_VERSION, currentDeps(), verdicts[at]!));
          this.#statusEpoch += 1;
          if (!this.#askingStatuses && this.sys.isActive()) this.#queueRebuild();
        },
      );
    } finally {
      this.#askingStatuses = false;
    }
  }

  /** The community decks (`@mc/cards`'s catalog), each with whether the player may add it yet. */
  #communityOffers(): readonly CommunityOffer[] {
    const gate = unlocks();
    if (
      this.#offersCache?.saved !== this.#savedDecks ||
      this.#offersCache.gate !== gate ||
      this.#offersCache.epoch !== this.#statusEpoch
    ) {
      this.#offersCache = {
        epoch: this.#statusEpoch,
        saved: this.#savedDecks,
        gate,
        offers: communityOffers({
          catalog: communityDecks(),
          savedDecks: this.#savedDecks,
          pool: currentPool(),
          poolVersion: POOL_VERSION,
          deps: currentDeps(),
          gate,
          optionOf: (deck) => this.#optionOf(deck),
        }),
      };
    }
    return this.#offersCache.offers;
  }

  #identityOf(deck: Deck): HeroIdentityCard | null {
    const card = currentCardsById().get(deck.identityCardId as string);
    return card?.type === "hero_identity" ? card : null;
  }

  /** The compact control row's height this draw: 44px on a touch layout, the small desktop row otherwise. */
  #row: number = COMPACT_ROW;

  /** Every plain card the popover may open on: those noted at draw time plus each list's, clipped to its viewport. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const all = new Map(hoverCardIdsOf(this));
    for (const provider of this.#hoverLists) for (const [slot, rect] of provider()) all.set(slot, rect);
    for (const thumb of this.#paneThumbs) all.set(thumb.slot, { ...thumb.rect, cardId: thumb.cardId, through: true });
    return all;
  }

  /**
   * Scans arrived. The card pool's tiles fill themselves in (`art/art-slot.ts`); only a scan the screen drew outside
   * the pool grid (a deck's card list, the stats pane's picture) needs the screen drawn again, and so does a change of every
   * face's source.
   */
  #artArrived(why: ArtRedraw): void {
    // "all": a new card language or a pack's pictures, so every tile may have a new source. A pane picture is asked
    // for again (so the cache counts it as in use); one the cache evicted anyway is drawn again with the screen.
    const art = cardArt(this);
    // Evicted (gone now), or evicted and loaded again (a new texture under the same key): either way the drawn picture
    // no longer shows, and the screen is drawn again.
    const paneEvicted = this.#paneArt.some(({ source, rect, texture }) => {
      const key = art.request(this, source);
      if (key === null) return !art.isMissing(source.key);
      // The texture `drawArt` would draw from now (the full copy arriving or leaving counts), not the table copy.
      return this.textures.get(artKeyFor(this, key, rect) ?? key) !== texture;
    });
    if (why === "all" || this.#paneArtMissing || paneEvicted) {
      this.#rebuild();
      return;
    }
    markRenderDirty();
  }

  #rebuild(): void {
    this.#pictures.begin();
    this.#paneArtMissing = false;
    this.#paneArt = [];
    // The deck's options, when up, redraw with this draw's statuses (#958 review).
    if (this.scene.isActive(SCENES.deckActions))
      this.time.delayedCall(0, () => (this.scene.get(SCENES.deckActions) as DeckActionsSheet | null)?.refresh());
    resetHoverCards(this);
    this.#hoverLists = [];
    this.#thumbTargets = [];
    this.#paneThumbs = [];
    this.#holes = [];
    this.#actions = new Map();
    this.#inspects = new Map();
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#hints.reset();
    this.#glyphs.reset();
    this.#obstacles = [];
    this.#tabsShown = false;
    // Both lists are recreated fresh every rebuild, in the normal draw order (`ui/virtual-list.ts` — reattaching
    // one across a sweep put it ahead of whatever the scene drew afterward, so a later background panel ended up
    // on top of it). Their scroll positions live in `#listScroll`/`#poolListScroll`, which survive this regardless.

    const { width, height } = this.scale.gameSize;
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const layout = decksLayout({ width, height });
    this.#row = layout.formFactor === "desktop" ? COMPACT_ROW : TOUCH_ROW;

    // The three list-pane DOM text fields (search, paste, MarvelCDB) belong to whatever draws the "Decks" group on
    // this pass — wide always draws them; narrow only while the "Decks" tab is active. They aren't Phaser
    // display-list objects (`McTextInput`/`McMultilineInput` are DOM-backed rexUI), so switching tabs and never
    // destroying them would leave them floating over another pane forever, invisible to
    // `destroyChildren(scene)` below — found in the browser switching tabs at a narrow width.

    // The surviving DOM text fields survive the sweep: every object they draw with is detached first and handed
    // back after, in the same order. The paste field is a rexUI sizer with children of its own in the display
    // list, so its root alone is not enough (`McMultilineInput.gameObjects`).
    destroyChildren(this);

    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", { spacing: 6, radius: 1, alpha: 0.1 });

    // The ink chrome bar behind Back and the title, over the paper ground everything else draws on.
    const chrome = this.add.graphics();
    paintPanel(
      chrome,
      { x: 0, y: 0, width, height: layout.header.y + layout.header.height + HEADER_FOOT },
      "onInk",
      "rest",
    );

    // The panel's ground and the ink chrome bar over it; the Phaser panes show through the holes cut below.
    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    b.dots({ x: 0, y: 0, width, height }, "paper", 6, 1, 0.1);
    b.box(
      { x: 0, y: 0, width, height: layout.header.y + layout.header.height + HEADER_FOOT },
      { fill: surface.ink.hex },
    );
    const backRect: Rect = { x: layout.header.x, y: layout.header.y, width: 100, height: layout.header.height };
    const goBack = (): void => {
      goToScreen(this, SCENES.title);
    };
    this.#glyphs.button(b, {
      key: "back",
      rect: backRect,
      label: t("decks.back"),
      look: "onInk",
      type: typeRole.rowTitle,
      ids: ["cancel"],
      ground: "paper",
    });
    this.#actions.set("back", goBack);
    this.#stops.set("back", { rect: backRect, activate: goBack });

    // "Your stats" at the header's right end: what you play, the other side of what you build.
    const statsWidth = layout.formFactor === "phone" ? 112 : 150;
    const statsRect: Rect = {
      x: layout.header.x + layout.header.width - statsWidth,
      y: layout.header.y,
      width: statsWidth,
      height: layout.header.height,
    };
    const openStats = (): void =>
      goToScreen(this, SCENES.playerStats, { from: SCENES.decks } satisfies PlayerStatsData);
    this.#glyphs.button(b, {
      key: "player-stats",
      rect: statsRect,
      // Never just "Stats": the narrow layout's own Stats tab is this deck's numbers.
      label: t("decks.yourStats"),
      look: "onInk",
      type: typeRole.rowTitle,
      ids: ["guide"],
      ground: "paper",
    });
    this.#actions.set("player-stats", openStats);
    this.#stops.set("player-stats", { rect: statsRect, activate: openStats });

    // The header's right-aligned meta label: the real pool size, never an owned-card claim. Skipped at phone width.
    const poolMetaText = t("decks.poolMeta", { count: currentPool().length });
    const poolMetaWidth =
      layout.formFactor === "phone"
        ? 0
        : b.measure(poolMetaText.toUpperCase(), typeRole.label, { letterSpacing: 1.2 }).width;
    if (layout.formFactor !== "phone") {
      b.text(statsRect.x - 16, layout.header.y + layout.header.height / 2, poolMetaText, typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.label,
        origin: [1, 0.5],
      });
    }

    // A large Bangers screen title beside the Back button, set under the dark mode tab when it would run under it.
    const titleLeft = backRect.x + backRect.width + 12;
    const titleRoom =
      layout.header.width - backRect.width - 24 - statsWidth - 16 - (poolMetaWidth ? poolMetaWidth + 16 : 0);
    const titleWidth = Math.min(titleRoom, b.measure(t("decks.title"), typeRole.barTitle, { size: 28 }).width);
    const titleSize = 28;
    const titleTop = layout.header.y + layout.header.height / 2 - titleSize / 2;
    const { drop: titleDrop, maxRight } = sheetThemeFor(this, {
      width,
      textLeft: titleLeft,
      textRight: titleLeft + titleWidth,
      textTop: titleTop,
      textHeight: titleSize,
      barHeight: layout.header.y + layout.header.height + HEADER_FOOT,
    });
    b.text(titleLeft, layout.header.y + layout.header.height / 2 + titleDrop, t("decks.title"), typeRole.barTitle, {
      size: titleSize,
      color: surface.paper.hex,
      origin: [0, 0.5],
      fitWidth: maxRight === null ? titleRoom : Math.max(40, Math.min(titleRoom, maxRight - titleLeft)),
    });

    // The player's own list (precons and saved decks), then the community decks: recommendations that can be
    // selected and previewed like any deck, and added as an editable copy rather than played or edited in place.
    this.#askStatuses();
    const ownOptions = this.#deckOptions();
    const offers = this.#communityOffers();
    const allOptions = [...ownOptions, ...offers.map((offer) => offer.option)];
    // Dev e2e hook (never referenced by product code): the decks the list offers (as imported decks, with the status
    // chip's words and the card total), the status line, and every control's current rect by focus key.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcDecksDebug?: unknown }).__mcDecksDebug = {
        stops: () =>
          [...this.#stops].map(([key, stop]) => ({
            key,
            ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
          })),
        community: () =>
          offers.map((offer) => ({
            id: offer.option.deck.id as string,
            marvelcdbId: offer.entry.marvelcdbId,
            name: offer.entry.name,
            hero: offer.entry.heroName,
            author: offer.entry.author,
            url: offer.entry.url,
            status: communityStatusText(offer),
            lock: offer.lock,
            added: offer.added,
            selected: (offer.option.deck.id as string) === this.#selectedDeckId,
          })),
        decks: () =>
          ownOptions.map((o) => ({
            id: o.deck.id as string,
            name: o.deck.name,
            source: o.deck.source.kind,
            selected: (o.deck.id as string) === this.#selectedDeckId,
            status: deckStatusOf(o).text,
            legal: o.legal,
            problems: o.problems.map((p) => p.message),
            warning: o.warning,
            cardCount: o.deck.cards.reduce((sum, entry) => sum + entry.quantity, 0),
          })),
        status: () => this.#status,
        /** The card the hover popover is showing, or null (a mouse over a deck row thumbnail or a pool card). */
        hoverShown: () => this.#hover?.shownKey ?? null,
        /** The tab shown on a phone or tablet; null on desktop, where every pane is up. */
        tab: () => (this.#tabsShown ? this.#activeTab : null),
        /** True while any listed deck's status is still on its way from the worker. */
        checking: () => allOptions.some((o) => o.checking === true),
      };
    }
    // Saved decks arrive after the first draw, so a deck asked for by `focusDeckId` (the one just saved in the builder)
    // may not exist yet: the first row stands in until it does, then the asked-for deck takes over once.
    const wanted = this.#data.focusDeckId ?? null;
    const wantedExists = wanted !== null && allOptions.some((o) => (o.deck.id as string) === wanted);
    if (
      this.#selectedDeckId === null ||
      !allOptions.some((o) => (o.deck.id as string) === this.#selectedDeckId) ||
      (this.#fallbackSelection && wantedExists)
    ) {
      // The first deck on the list as it is drawn (a hidden precon or an unopened list is not it); none when the list is empty.
      const firstShown = allOptions.find((o) =>
        o.deck.source.kind === "precon"
          ? deckListShows("precon", this.#deckList, appSession().settings.showPreconDecks)
          : deckListShows(isCommunityDeckId(o.deck.id as string) ? "community" : "build", this.#deckList, true),
      );
      this.#selectedDeckId = (wantedExists ? wanted : (firstShown?.deck.id as string | undefined)) ?? null;
      this.#fallbackSelection = !wantedExists;
    }
    // The selection stays only while it is on the displayed list (the asked-for deck excepted, until the list changes).
    const groupOf = (o: DeckOption): DeckListId =>
      deckListGroupOf(o.deck.source.kind === "precon", isCommunityDeckId(o.deck.id as string));
    const groupRank: Record<DeckListId, number> = { precon: 0, build: 1, community: 2 };
    this.#selectedDeckId = reconcileDeckSelection(
      this.#selectedDeckId,
      allOptions
        .map((o) => ({ id: o.deck.id as string, group: groupOf(o) }))
        .sort((a, b) => groupRank[a.group] - groupRank[b.group]),
      this.#deckList,
      appSession().settings.showPreconDecks,
      this.#focusPinned ? wanted : null,
    );
    const selected = allOptions.find((o) => (o.deck.id as string) === this.#selectedDeckId) ?? null;
    const selectedOffer = offers.find((offer) => offer.option === selected) ?? null;
    const drawStats = (rect: Rect): void => {
      if (selectedOffer) this.#drawCommunityPane(b, rect, selectedOffer, layout.wide);
      else this.#drawStatsPane(b, rect, selected);
    };

    if (layout.wide) {
      const deckIds = this.#drawListPane(b, layout.listPane!, ownOptions, offers, selected);
      const poolCardIds = this.#drawPoolPane(b, layout.poolPane!, selected, selectedOffer !== null);
      drawStats(layout.statsPane!);
      this.#route?.set(
        decksFocusOrder({
          showMarvelCdbImport: true,
          deckIds,
          chipIds: this.#chipDefs(ownOptions).map((c) => c.id),
          poolCardIds,
          poolChipIds: selected ? this.#poolChipDefs(selected.deck).map((c) => c.id) : [],
          wide: true,
          activeTab: this.#activeTab,
          hasSelection: selected !== null,
          community: selectedOffer !== null,
          editable: selected !== null && selectedOffer === null && selected.deck.source.kind !== "precon",
          filtersExpanded: this.#filtersExpanded,
          importOpen: this.#importExportOpen,
        }),
        this.#stops,
      );
    } else {
      this.#tabsShown = true;
      const tabRect = layout.tabs!;
      const tabType = { ...typeRole.label, size: Math.max(minType.phoneLabel, typeRole.label.size) };
      b.tabRail(
        tabRect,
        [
          { id: "decks", label: t("decks.tab.decks") },
          { id: "cards", label: t("decks.tab.cards") },
          { id: "stats", label: t("decks.tab.stats") },
        ],
        { selected: this.#activeTab, size: tabType.size },
      );
      const tabCell = (index: number): Rect => ({
        ...layout.tabs!,
        x: layout.tabs!.x + (index * layout.tabs!.width) / 3,
        width: layout.tabs!.width / 3,
      });
      for (const [index, id] of (["decks", "cards", "stats"] as const).entries()) {
        this.#actions.set(`tab:${id}`, () => this.#setTab(id));
        this.#stops.set(`tab:${id}`, { rect: tabCell(index), activate: () => this.#setTab(id) });
      }
      const strip = layout.tabs!;
      this.#obstacles.push(layout.content!);
      this.#glyphs.hint(b, {
        key: "tab-step",
        x: strip.x + strip.width,
        y: strip.y + strip.height + 11 + 7,
        ids: ["zonePrevious", "zoneNext"],
        idsNow: (set) => (set === "pad" ? ["zonePrevious", "zoneNext"] : null),
        height: 14,
        ground: "paper",
        alignRight: true,
      });

      let deckIds: readonly string[] = [];
      let poolCardIds: readonly string[] = [];
      if (this.#activeTab === "decks") deckIds = this.#drawListPane(b, layout.content!, ownOptions, offers, selected);
      else if (this.#activeTab === "cards")
        poolCardIds = this.#drawPoolPane(b, layout.content!, selected, selectedOffer !== null);
      else drawStats(layout.content!);
      if (this.#activeTab === "stats" && selectedOffer) this.#holes.push(layout.content!);

      this.#route?.set(
        decksFocusOrder({
          showMarvelCdbImport: true,
          deckIds,
          chipIds: this.#activeTab === "decks" ? this.#chipDefs(ownOptions).map((c) => c.id) : [],
          poolCardIds,
          poolChipIds:
            this.#activeTab === "cards" && selected
              ? ["filters", ...this.#poolChipDefs(selected.deck).map((c) => c.id)]
              : [],
          wide: false,
          activeTab: this.#activeTab,
          hasSelection: selected !== null,
          community: selectedOffer !== null,
          editable: selected !== null && selectedOffer === null && selected.deck.source.kind !== "precon",
          filtersExpanded: this.#filtersExpanded,
          importOpen: this.#importExportOpen,
        }),
        this.#stops,
      );
    }
    this.#mount(width, height, b);
    this.#hover?.onDraw();
  }

  #stepTab(direction: 1 | -1): void {
    if (!this.#tabsShown) {
      const scroller = this.#pageScroller();
      scroller?.scrollBy({ top: direction * scroller.clientHeight * 0.85 });
      return;
    }
    const order: readonly DecksTab[] = ["decks", "cards", "stats"];
    const next = order[order.indexOf(this.#activeTab) + direction];
    if (next) this.#setTab(next);
  }

  #setPaneTab(tab: "deck" | "games"): void {
    // Only while the tabs are on screen (not under a card, a community deck, or another narrow tab).
    if (this.#paneTab === tab || !this.#stops.has(`pane:${tab}`)) return;
    this.#paneTab = tab;
    this.#rebuild();
    this.#route?.focusKey(`pane:${tab}`);
  }

  /**
   * The stats pane's From your games tab (#529): how this hero's games go and what they say about this deck's cards,
   * to read. Changing the deck happens in the builder, which the one button at the bottom opens on the same tab: a
   * precon as a new deck of your own, one of your decks as itself.
   */
  #drawPaneGames(b: SheetBuilder, left: number, top: number, column: number, bottom: number, deck: Deck): void {
    let y = top;
    if (!this.#insights) {
      b.text(left, y, t("decks.games.reading").toUpperCase(), typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.meta,
      });
      return;
    }
    const type = fromYourGamesType(isDesktopType());
    const view = fromYourGamesOf(
      this.#insights,
      deck.identityCardId as string,
      deck.cards.map((line) => line.cardId as string),
      deck.aspects,
      POOL_STATS_NAMES,
    );
    const buttonTop = bottom - this.#row;
    if (view.headline) {
      b.text(left, y, view.headline.toUpperCase(), typeRole.label, {
        size: type.label,
        color: signal.caution.hex,
        wrapWidth: column,
      });
      y += type.label + 9;
    }
    if (view.insight) {
      const height = b.measure(view.insight, typeRole.body, { size: type.note, wrapWidth: column - 16 }).height;
      b.box({ x: left, y, width: column, height: height + 12 }, { fill: surface.paper.hex });
      b.text(left + 8, y + 6, view.insight, typeRole.body, {
        size: type.note,
        color: surface.ink.hex,
        wrapWidth: column - 16,
      });
      y += height + 20;
    }
    const { thumb } = type;
    const faced = villainsFacedOf(this.#insights);
    // The Cut and Try lists leave room for the Against stepper and a first card under it: the pane does not scroll.
    let limit = buttonTop - 8 - (faced.length > 0 ? this.#row + 8 + 20 + thumb.height + 16 : 0);
    const section = (title: string, cards: readonly SuggestedCard[]): void => {
      if (cards.length === 0 || y + 20 + thumb.height > limit) return;
      const head = b.text(left, y, title.toUpperCase(), typeRole.barTitle, {
        size: 17,
        color: surface.paper.hex,
        fitWidth: column,
      });
      b.box({ x: left, y: y + head.height + 2, width: column, height: 2 }, { fill: surface.paper.hex });
      y += head.height + 10;
      for (const entry of cards) {
        if (y + thumb.height > limit) return;
        const card = currentCardsById().get(entry.cardId);
        const pic: Rect = { x: left, y, width: thumb.width, height: thumb.height };
        // The card scan, fitted whole in a lazy `<img>`; the hover popover shows the card from it.
        const held = this.#pictures.image(card ? artFor(card, { kind: "front" }) : null);
        b.image(pic, {
          src: held.src,
          ...(held.retry !== undefined ? { retry: held.retry } : {}),
          fill: surface.parchment.hex,
          cover: { x: 0.5, y: 0.2 },
          key: `games-card:${entry.cardId}`,
        });
        this.#paneThumbs.push({
          cardId: entry.cardId,
          slot: hoverSlotOf(entry.cardId, `games${this.#paneThumbs.length}`),
          rect: pic,
        });
        b.text(left + thumb.width + 8, y + 4, `${card?.name ?? entry.cardId}\n${entry.detail}`, typeRole.body, {
          size: type.text,
          color: surface.paper.hex,
          alpha: ink.body,
          wrapWidth: column - thumb.width - 8,
          maxLines: type.lines,
        });
        y += thumb.height + 6;
      }
      y += 6;
    };
    section(deck.source.kind === "precon" ? t("decks.games.rarely") : t("decks.games.cut"), view.cut);
    // Only cards this deck's pool lists, as the builder's rail shows them.
    const identity = this.#identityOf(deck);
    const listed = identity
      ? new Set(browsablePool(currentPool(), identity, deck.aspects, {}).map((card) => card.id as string))
      : new Set<string>();
    section(
      t("decks.games.try"),
      view.tryCards.filter((entry) => listed.has(entry.cardId)),
    );
    limit = buttonTop - 8;
    if (faced.length > 0 && y + this.#row <= buttonTop - 8) {
      const villain = faced.includes(this.#againstVillain ?? "") ? this.#againstVillain! : faced[0]!;
      const against = againstVillainOf(
        this.#insights,
        villain,
        deck.identityCardId as string,
        deck.cards.map((line) => line.cardId as string),
        deck.aspects,
        POOL_STATS_NAMES,
      );
      const stepRect: Rect = { x: left, y, width: column, height: this.#row };
      const step = (): void => {
        this.#againstVillain = faced[(faced.indexOf(villain) + 1) % faced.length]!;
        this.#rebuild();
        this.#route?.focusKey("games-against");
      };
      b.button({
        key: "games-against",
        rect: stepRect,
        label: `${against?.headline ?? villain}${faced.length > 1 ? " ▸" : ""}`,
        look: "onInk",
        type: typeRole.label,
        ...(faced.length > 1 ? {} : { disabled: true as const }),
      });
      if (faced.length > 1) {
        this.#actions.set("games-against", step);
        this.#stops.set("games-against", { rect: stepRect, activate: step });
      }
      y += this.#row + 8;
      if (against) {
        const shown = new Set([...view.cut, ...view.tryCards].map((entry) => entry.cardId));
        const wins = against.tryCards.filter((entry) => listed.has(entry.cardId) && !shown.has(entry.cardId));
        const losses = against.cutCards.filter((entry) => !shown.has(entry.cardId));
        section(t("decks.games.tryWins"), wins);
        section(t("decks.games.cutLosses"), losses);
        const nothing = against.note ?? (wins.length + losses.length === 0 ? NOTHING_STANDS_OUT : null);
        if (nothing && y + 30 < buttonTop) {
          const note = b.text(left, y, nothing, typeRole.body, {
            size: type.note,
            color: surface.paper.hex,
            alpha: ink.secondary,
            wrapWidth: column,
          });
          y += note.height + 8;
        }
      }
    }
    section(t("decks.games.keep"), view.keep);
    if (view.note && y + 30 < buttonTop) {
      b.text(left, y, view.note, typeRole.body, {
        size: type.note,
        color: surface.paper.hex,
        alpha: ink.secondary,
        wrapWidth: column,
      });
    }
    // Decks reads; the builder changes. A precon is never changed in place: it starts a deck of your own.
    const precon = deck.source.kind === "precon";
    const rect: Rect = { x: left, y: buttonTop, width: column, height: this.#row };
    const open = (): void =>
      goToScreen(this, SCENES.deckBuilder, { deck, railTab: "games" } satisfies DeckBuilderSceneData);
    b.button({
      key: "games-open",
      rect,
      label: precon ? t("decks.games.buildOwn") : t("decks.games.editWith"),
      look: "onInk",
      type: typeRole.label,
    });
    this.#actions.set("games-open", open);
    this.#stops.set("games-open", { rect, activate: open });
  }

  #setTab(tab: DecksTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#listFromTop = true;
    this.#poolFromTop = true;
    this.#rebuild();
  }

  // ------------------------------------------------------------------------------------------------------------
  // The deck list pane (2026-09-18 fidelity pass, point 2): search plus a collapsed-by-default "Filters" toggle
  // in one compact row (under a header carrying "+ New deck"), then the list itself — the pane's dominant element — then a
  // compact, bottom-pinned Import/Export box. Returns the deck ids actually offered as rows, in list order, for
  // the focus route.
  // ------------------------------------------------------------------------------------------------------------
  #drawListPane(
    b: SheetBuilder,
    rect: Rect,
    allOptions: readonly DeckOption[],
    offers: readonly CommunityOffer[],
    selected: DeckOption | null,
  ): readonly string[] {
    const left = rect.x;
    const column = rect.width;
    let y = this.#drawListHeader(b, left, rect.y, column);

    if (this.#status) {
      const banner = b.text(left, y, this.#status.text, typeRole.body, {
        color: this.#status.tone === "error" ? accent.redDeep.hex : signal.heal.hex,
        wrapWidth: column,
      });
      y += banner.height + 10;
    }

    // Search (a real input in the panel) plus the "Filters" toggle share one compact row.
    const filtersToggleWidth = 78;
    const searchRect: Rect = { x: left, y, width: column - filtersToggleWidth - CHIP_GAP, height: this.#row };
    const steam = inputDevice().mode === "pad" && inputDevice().pad?.steam === true;
    b.search(searchRect, {
      key: "deck-search",
      value: this.#filter.text,
      placeholder: t("decks.search"),
      clearLabel: t("decks.clearSearch"),
      ...(steam ? { focusPlaceholder: t("reader.steamKeyboard") } : {}),
    });
    this.#stops.set("deck-search", { rect: searchRect, activate: () => this.#searchField()?.focusInput() });
    const filtersToggleRect: Rect = {
      x: left + column - filtersToggleWidth,
      y,
      width: filtersToggleWidth,
      height: this.#row,
    };
    const toggleFilters = (): void => {
      this.#filtersExpanded = !this.#filtersExpanded;
      this.#rebuild();
    };
    b.button({
      key: "filters",
      rect: filtersToggleRect,
      label: this.#filtersExpanded ? `${t("decks.filters")} ▴` : `${t("decks.filters")} ▾`,
      look: "secondary",
      type: typeRole.label,
      selected: this.#filtersExpanded,
    });
    this.#actions.set("filters", toggleFilters);
    this.#stops.set("filters-toggle", { rect: filtersToggleRect, activate: toggleFilters });
    y += this.#row + 8;

    const chipDefs = this.#filtersExpanded ? this.#chipDefs(allOptions) : [];
    if (chipDefs.length > 0) {
      // Each chip at its own natural width (the word, its padding and the check mark of an "on" chip).
      const widthOf = (chip: ChipDef): number =>
        Math.ceil(b.measure(caseOf(STAMP_CHIP_TYPE, chip.text), STAMP_CHIP_TYPE, { letterSpacing: 1.1 }).width) + 44;
      const packed = packChipsNatural(chipDefs, left, y, column, this.#row, "left", widthOf);
      const barRect: Rect = { x: left, y, width: column, height: Math.max(this.#row, packed.bottom - y) };
      b.filterBar(
        "deck-chips",
        barRect,
        chipDefs.map((chip) => ({ id: chip.id, label: chip.text, selected: chip.selected })),
        { prefix: "chip:", rowHeight: this.#row, gap: CHIP_GAP },
      );
      for (const chip of chipDefs) {
        this.#actions.set(`chip:${chip.id}`, chip.onClick);
        this.#stops.set(`deck-chip:${chip.id}`, {
          rect: () => this.#barCell("deck-chips", `chip:${chip.id}`) ?? barRect,
          activate: chip.onClick,
        });
      }
      y = barRect.y + barRect.height + 10;
    }

    // Reserve fixed room at the bottom for the Import/Export box, so the list gets exactly whatever's left.
    const boxHeight = importExportBoxHeight(column, this.#importExportOpen, this.#row);
    const listTop = y;
    const rowHeight = isDesktopType() ? DESKTOP_ROW_HEIGHT : ROW_HEIGHT;
    const listHeight = Math.max(rowHeight, rect.y + rect.height - boxHeight - 12 - listTop);
    const listRect: Rect = { x: left, y: listTop, width: column, height: listHeight };

    // The community decks are searched too (by name, author and tags), so the worker holds them with the player's own.
    this.#syncDeckDocuments([...allOptions, ...offers.map((offer) => offer.option)]);
    const rows = this.#buildRows(allOptions, offers);
    const deckIds = rows
      .filter((r): r is Extract<DeckRow, { kind: "deck" }> => r.kind === "deck")
      .map((r) => r.option.deck.id as string);

    // A tap selects the deck; on the three-pane layout it also opens its Check (#966), on a narrow one its actions
    // (#958). A pad or the keyboard only selects (the stop's own `activate`), so walking the list never leaves.
    const select = (row: Extract<DeckRow, { kind: "deck" }>): void => {
      this.#selectedDeckId = row.option.deck.id as string;
      this.#paneCard = null;
      this.#rebuild();
    };
    const hoverFocus: { cardId: string; slot: string; rect: Rect }[] = [];
    b.scroll("deck-list", listRect, rows.length * rowHeight, (inner) => {
      rows.forEach((row, index) => {
        const rowRect: Rect = { x: left, y: index * rowHeight, width: column, height: rowHeight };
        if (row.kind === "message") {
          inner.text(left + 4, rowRect.y + 8, t("decks.noMatch"), typeRole.body, {
            color: surface.ink.hex,
            alpha: ink.meta,
            wrapWidth: column - 8,
          });
          return;
        }
        const deckId = row.option.deck.id as string;
        const model = this.#deckRowModel(row, rowRect, hoverFocus);
        inner.mediaRow(`row:${deckId}`, rowRect, model);
        inner.tap(`deck:${deckId}`, rowRect, { inspect: true });
        this.#actions.set(`deck:${deckId}`, () => {
          select(row);
          if (this.#tabsShown) this.#openDeckActions(deckId);
          else if (!row.offer) this.#openDeckCheck(row.option.deck);
        });
        this.#inspects.set(`deck:${deckId}`, () => this.#inspectDeck(row.option));
        this.#stops.set(`deck:${deckId}`, {
          rect: () => {
            const found = this.#region?.element.elementOf(`deck:${deckId}`);
            return found ? this.#region!.rectOf(found) : listRect;
          },
          view: () => {
            const found = this.#listScroller();
            return found ? this.#region!.rectOf(found) : listRect;
          },
          activate: () => {
            select(row);
            if (this.#tabsShown) this.#openDeckActions(deckId);
          },
          inspect: () => this.#inspectDeck(row.option),
          ensureVisible: () => this.#region?.element.elementOf(`deck:${deckId}`)?.scrollIntoView({ block: "nearest" }),
        });
      });
    });
    this.#thumbTargets = hoverFocus;
    // A deck row's thumbnail opens its hero's card: the cards are `through`, only the part in the list window counts.
    this.#hoverLists.push(() => this.#deckThumbHovers());
    if (!this.#focusedOnce && this.#data.focusDeckId) {
      if (rows.some((row) => row.kind === "deck" && (row.option.deck.id as string) === this.#data.focusDeckId)) {
        this.#revealDeckId = this.#data.focusDeckId;
        this.#focusedOnce = true;
      }
    }
    // A deck just imported is selected (`#applyImport`) and scrolled to once: it lands below every precon.
    if (this.#scrollToDeckId) {
      if (deckRowIndexOf(rows, this.#scrollToDeckId) >= 0) this.#revealDeckId = this.#scrollToDeckId;
      this.#scrollToDeckId = null;
    }
    y = listRect.y + listRect.height + 12;

    this.#drawImportExportBox(b, { x: left, y, width: column, height: boxHeight }, selected);

    return deckIds;
  }

  /** One deck row as the panel draws it, and its picture's place in the list's content space for the hover popover. */
  #deckRowModel(
    row: Extract<DeckRow, { kind: "deck" }>,
    rect: Rect,
    hover: { cardId: string; slot: string; rect: Rect }[],
  ): McMediaRowModel {
    const option = row.option;
    const deckId = option.deck.id as string;
    const selected = deckId === this.#selectedDeckId;
    const illegal = deckStatusOf(option).tone === "illegal";
    // A community deck whose hero or cards the player hasn't opened yet: shown, dimmed, with what opens it.
    const locked = row.offer !== undefined && row.offer.lock !== null;
    const cardTop = row.groupLabel ? GROUP_LABEL_HEIGHT : 2;
    const cardHeight = rect.height - 4 - cardTop;
    const thumbHeight = cardHeight - 12;
    // Capped in a narrow column (desktop's left pane) so the title and meta line keep most of the row.
    const thumbWidth = Math.round(Math.min(thumbHeight * DECK_THUMB_ASPECT, (rect.width - 8) * 0.26));
    const picture = this.#deckPicture(option.deck.identityCardId as string);
    const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;
    const textWidth = rect.width - 8 - 6 - thumbWidth - 10 - 10;
    const metaOptions = row.offer ? communityMetaCandidates(row.offer) : deckMetaCandidates(option, currentPool());
    // A deck from an installed custom pack says so first, so a long line giving up its tail never loses it.
    const customBadge = row.offer ? null : customBadgeOf(option.deck);
    const candidates = customBadge ? metaOptions.map((line) => `${customBadge} · ${line}`) : metaOptions;
    // The fullest line that fits two lines of this width, by a letters-per-line estimate; a long one gives up its tail.
    const perLine = Math.max(10, Math.floor(textWidth / (readingSize(typeRole.emphasis.size) * 0.55)));
    const meta = candidates.find((candidate) => candidate.length <= perLine * 2) ?? candidates.at(-1)!;
    const record =
      this.#history?.decks.find((r) => deckKeyToString(r.key) === deckKeyToString(keyOf(option.deck))) ?? null;
    const played = record && record.wins + record.losses > 0 ? record : null;
    const showRecord = selected && !row.offer;
    hover.push({
      cardId: option.deck.identityCardId as string,
      slot: hoverSlotOf(option.deck.identityCardId as string, `row${deckId}`),
      rect: { x: rect.x + 10, y: rect.y + cardTop + 6, width: thumbWidth, height: thumbHeight },
    });
    return {
      ...(row.groupLabel ? { group: row.groupLabel } : {}),
      look: "deck",
      heading: cardTitleOf(option),
      meta,
      // The roster-size copy where the picture has one (a hero's tile), else the picture itself; a pack's is leased.
      src: picture.src,
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
      focusX: picture.cover.x,
      focusY: picture.cover.y,
      ...(picture.cover.centered ? { focusCentered: true } : {}),
      fit: "cover",
      artWidth: thumbWidth,
      stamps: aspectStampsOf(option.deck.aspects, artLanguageNow()).map((stamp) => ({
        label: stamp.label,
        fill: css(stamp.fill),
        ink: css(stamp.ink),
      })),
      ...(!selected && !row.offer && played ? { badge: `${played.wins}–${played.losses}` } : {}),
      ...(showRecord
        ? {
            foot:
              record && record.gamesPlayed > 0
                ? t("decks.record", {
                    date: record.lastPlayedAt ? new Date(record.lastPlayedAt).toLocaleDateString() : "—",
                    wins: record.wins,
                    losses: record.losses,
                  })
                : t("decks.neverPlayed"),
          }
        : {}),
      selected,
      alert: illegal,
      dim: locked && !selected,
    };
  }

  /**
   * "YOUR DECKS" with "+ New deck" right-aligned on the same line, the rule running between them — the card pool
   * header's own shape. The button never scrolls with the list (user report, 2026-10-12).
   */
  #drawListHeader(b: SheetBuilder, left: number, y: number, column: number): number {
    const heading = b.text(left, y, t("decks.yourDecks"), typeRole.barTitle, { size: 19, color: surface.ink.hex });
    const label = t("decks.newDeck");
    const natural =
      Math.ceil(b.measure(caseOf(STAMP_CHIP_TYPE, label), STAMP_CHIP_TYPE, { letterSpacing: 1.1 }).width) + 28;
    const buttonWidth = Math.min(natural, Math.max(0, column - heading.width - 20));
    const buttonHeight = this.#row;
    const buttonRect: Rect = {
      x: left + column - buttonWidth,
      y: y + (heading.height - buttonHeight) / 2,
      width: buttonWidth,
      height: buttonHeight,
    };
    b.button({ key: "new-deck", rect: buttonRect, label, look: "secondary", type: STAMP_CHIP_TYPE });
    this.#actions.set("new-deck", () => this.#openBuilder());
    this.#stops.set("new-deck", { rect: buttonRect, activate: () => this.#openBuilder() });
    const ruleStart = left + heading.width + 10;
    const ruleEnd = buttonRect.x - 10;
    if (ruleEnd > ruleStart) {
      b.box(
        { x: ruleStart, y: y + heading.height / 2 - 1.5, width: ruleEnd - ruleStart, height: 3 },
        { fill: surface.ink.hex },
      );
    }
    return Math.max(y + heading.height, buttonRect.y + buttonHeight) + 12;
  }

  #openBuilder(): void {
    goToScreen(this, SCENES.deckBuilder, {} satisfies DeckBuilderSceneData);
  }

  /** S8's quick-filter chips for this list: aspect, source, and "Legal only" (this screen's own version of "playable now" — a deck's own legality, not a seating question). Only asked for while the "Filters" toggle is expanded. */
  #chipDefs(allOptions: readonly DeckOption[]): readonly ChipDef[] {
    const decks = allOptions.map((o) => o.deck);
    const defs: ChipDef[] = [];
    for (const aspect of heroAspectsOf(decks)) {
      const stamp = aspectStampOf(aspect);
      defs.push({
        id: `aspect:${aspect}`,
        text: stamp.label,
        tint: { fill: stamp.fill, ink: stamp.ink },
        selected: this.#filter.aspect === aspect,
        onClick: () => {
          this.#filter = { ...this.#filter, aspect: this.#filter.aspect === aspect ? null : aspect };
          this.#rebuild();
        },
      });
    }
    for (const source of deckSourcesOf(decks)) {
      // The Preconstructed list chip below is the same narrowing.
      if (source === "precon") continue;
      defs.push({
        id: `source:${source}`,
        text: t(`decks.source.${source}`),
        selected: this.#filter.source === source,
        onClick: () => {
          this.#filter = { ...this.#filter, source: this.#filter.source === source ? null : source };
          this.#rebuild();
        },
      });
    }
    for (const chip of deckListChips(appSession().settings.showPreconDecks)) {
      defs.push({
        id: chip.id === "community" ? "community" : `list:${chip.id}`,
        text: t(`decks.list.${chip.id}`),
        selected: this.#deckList === chip.id,
        onClick: () => {
          this.#setList(nextDeckList(this.#deckList, chip.id));
          this.#listFromTop = true;
          this.#rebuild();
        },
      });
    }
    defs.push({
      id: "legal-only",
      text: t("decks.legalOnly"),
      selected: this.#filter.playableOnly === true,
      onClick: () => {
        this.#filter = { ...this.#filter, playableOnly: !this.#filter.playableOnly };
        this.#rebuild();
      },
    });
    return defs;
  }

  /** What the deck search looks in for each deck (view/deck-search.ts): names first, then aspects, source, pack, author and tags, and a community deck's write-up last. */
  #deckDocumentOf(option: DeckOption, heroPack: string | undefined): SearchDocument {
    const deck = option.deck;
    const identity = currentCardsById().get(deck.identityCardId as string);
    const hero = identity?.type === "hero_identity" ? identity : undefined;
    const entry = testedEntryOf(deck, testedCatalog());
    const sourceWords =
      deck.source.kind === "precon"
        ? ["precon", "preconstructed"]
        : deck.source.kind === "imported"
          ? ["imported"]
          : ["built", "mine"];
    const packs = heroPack
      ? [packNameOf(heroPack), currentHeroShelfPacks().find((p) => p.code === heroPack)?.cycleName]
      : [];
    return {
      id: deck.id as string,
      primary: [deck.name, option.identityName, hero?.hero.faceName, hero?.alterEgo.faceName, entry?.heroName].filter(
        (t): t is string => typeof t === "string",
      ),
      secondary: [
        ...deck.aspects.map((a) => aspectLabelOf([a])),
        ...sourceWords,
        ...packs.filter((t): t is string => typeof t === "string"),
        ...testedSearchFieldsOf(deck, testedCatalog()),
        ...(entry?.tags ?? []),
      ],
      notes: entry ? [entry.description] : [],
    };
  }

  /** Hands the worker the deck list when it has changed (by id, name and aspects), and re-asks the open query. */
  #syncDeckDocuments(allOptions: readonly DeckOption[]): void {
    const version =
      POOL_VERSION +
      ":" +
      allOptions.map((o) => `${o.deck.id as string}~${o.deck.name}~${o.deck.aspects.join(",")}`).join("|");
    if (version === this.#deckDocsVersion) return;
    this.#deckDocsVersion = version;
    const heroPacks = heroPacksOf(
      allOptions,
      (option) => option.deck.identityCardId as string,
      (option) => (option.deck.source.kind === "precon" ? (option.deck.source.packCode as string) : null),
    );
    this.#deckSearch.setDocuments(
      allOptions.map((option) => this.#deckDocumentOf(option, heroPacks.get(option.deck.identityCardId as string))),
      version,
    );
    const text = this.#filter.text;
    // After this redraw, not inside it: the answer redraws again.
    if (text.trim() !== "") queueMicrotask(() => this.sys.isActive() && this.#requestDeckSearch(text));
  }

  /** Asks the worker to rank the decks; the screen redraws when the newest answer arrives. An empty text clears the search at once. */
  #requestDeckSearch(text: string): void {
    if (text.trim() === "") {
      this.#deckSearch.cancel();
      this.#deckRanking = null;
      this.#rebuild();
      return;
    }
    this.#deckSearch.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#deckRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#rebuild();
    });
  }

  /**
   * `allOptions` grouped into Preconstructed / Your decks (recently changed first), filtered by search + chips,
   * with the selected deck pinned into view even if the filter would otherwise hide it. A group's label rides on its own first card (`groupLabel`) rather
   * than a separate full-height row — see the module doc comment for why.
   */
  #buildRows(allOptions: readonly DeckOption[], offers: readonly CommunityOffer[]): readonly DeckRow[] {
    const identityOf = (option: DeckOption): AnyCard | undefined =>
      currentCardsById().get(option.deck.identityCardId as string);
    // The text part of the search is the worker's ranking; the chips stay here.
    const chips: RosterFilter = { ...this.#filter, text: "" };
    const ranking = this.#deckRanking;
    const ranked = (option: DeckOption): boolean => ranking === null || ranking.has(option.deck.id as string);
    const scoreOf = (option: DeckOption): number => ranking?.get(option.deck.id as string) ?? 0;
    const byScore = <T>(items: readonly T[], optionOf: (item: T) => DeckOption): readonly T[] =>
      ranking === null ? items : [...items].sort((a, b) => scoreOf(optionOf(b)) - scoreOf(optionOf(a)));
    const matches = (option: DeckOption): boolean =>
      ranked(option) &&
      heroRosterMatches(option.deck, identityOf(option), chips, option.checking ? "checking" : option.blockedReason);
    const isSelected = (option: DeckOption): boolean => (option.deck.id as string) === this.#selectedDeckId;

    // A list chip narrows to that list; a source chip (Imported, Built) narrows to the player's own list, so the
    // community group steps aside. Hidden precons stay out (#755) except the one selected, which is never filtered away.
    const showPrecon = appSession().settings.showPreconDecks;
    const preconKind = (o: DeckOption): boolean => o.deck.source.kind === "precon";
    const precons = allOptions.filter(
      (o) => preconKind(o) && (deckListShows("precon", this.#deckList, showPrecon) || (!showPrecon && isSelected(o))),
    );
    const saved = deckListShows("build", this.#deckList, showPrecon)
      ? allOptions.filter((o) => deckListGroupOf(preconKind(o), isCommunityDeckId(o.deck.id as string)) === "build")
      : [];
    const community = byScore(
      withSelectionPinned(
        this.#filter.source || !deckListShows("community", this.#deckList, showPrecon) ? [] : offers,
        (offer) =>
          ranked(offer.option) &&
          communityOfferMatches(offer, {
            text: "",
            aspect: this.#filter.aspect ?? null,
            availableOnly: this.#filter.playableOnly === true,
          }),
        (offer) => isSelected(offer.option),
      ),
      (offer) => offer.option,
    );
    const filteredPrecons = byScore(withSelectionPinned(precons, matches, isSelected), (o) => o);
    const filteredSaved = byScore(withSelectionPinned(saved, matches, isSelected), (o) => o);

    const rows: DeckRow[] = [];
    filteredPrecons.forEach((option, index) =>
      rows.push({ kind: "deck", option, ...(index === 0 ? { groupLabel: t("decks.group.precon") } : {}) }),
    );
    filteredSaved.forEach((option, index) =>
      rows.push({
        kind: "deck",
        option,
        ...(index === 0 ? { groupLabel: t("decks.group.build") } : {}),
      }),
    );
    community.forEach((offer, index) =>
      rows.push({
        kind: "deck",
        option: offer.option,
        offer,
        ...(index === 0 ? { groupLabel: communityGroupLabel() } : {}),
      }),
    );
    if (rows.length === 0) rows.push({ kind: "message", text: t("decks.noMatch") });
    return rows;
  }

  /** Shows one list alone (or all three) and remembers it for "Last used" (#755). */
  #setList(list: DeckListId | null): void {
    this.#deckList = list;
    this.#focusPinned = false;
    writeLastDeckList(list);
  }

  /** A deck row's hero picture: the bundled one chosen this visit, else a pack's or the identity scan, leased by its key. */
  #deckPicture(identityId: string): HeroPicture {
    let chosen: Picture | null | undefined;
    if (!isCustomCard(identityId)) {
      chosen = this.#deckPictures.get(identityId);
      if (chosen === undefined) {
        chosen = heroArtForIdentity(HERO_ART, identityId, currentPool());
        this.#deckPictures.set(identityId, chosen);
      }
    }
    return heroPictureOf(currentCardsById().get(identityId), this.#pictures, "tile", chosen);
  }

  /** A deck row's picture, per visit, so a redraw never reshuffles a hero with several pictures. */
  #deckArtOf(identityId: string): { url: string | null; tileUrl?: string; focus?: PictureFocus } {
    // An installed pack hero's picture arrives after the first draw, so it is not remembered here.
    if (isCustomCard(identityId)) {
      const identity = currentCardsById().get(identityId);
      return {
        url:
          packPictureFor("hero", identityId)?.url ??
          (identity ? artFor(identity, { kind: "hero" })?.url : null) ??
          null,
      };
    }
    let art = this.#deckArt.get(identityId);
    if (!art) {
      const picture = heroArtForIdentity(HERO_ART, identityId, currentPool());
      const identity = currentCardsById().get(identityId);
      art = picture
        ? {
            url: picture.url,
            ...(picture.tileUrl ? { tileUrl: picture.tileUrl } : {}),
            ...(picture.focus ? { focus: picture.focus } : {}),
          }
        : { url: (identity ? artFor(identity, { kind: "hero" })?.url : null) ?? null };
      this.#deckArt.set(identityId, art);
    }
    return art;
  }

  /**
   * The Import/Export box: a compact parchment box pinned to the column's bottom, a heading, two lines of description and
   * one row of small "Paste" / "CDB link" / "Export" buttons. Paste and CDB link are an accordion: pressing one opens its
   * own field (and closes the other); Export always acts immediately on the selected deck. The fields are real
   * `<textarea>` / `<input>` elements in the panel (`mc-text-field`), their text kept in `#pasteText` / `#marvelcdbText`.
   */
  #drawImportExportBox(b: SheetBuilder, rect: Rect, selected: DeckOption | null): void {
    b.box(rect, { fill: surface.parchment.hex, stroke: surface.ink.hex, strokeWidth: border.object });

    const left = rect.x + 12;
    const column = rect.width - 24;
    let y = rect.y + 12;

    b.text(left, y, t("decks.io.heading").toUpperCase(), typeRole.label, {
      size: readingSize(typeRole.label.size),
      color: surface.ink.hex,
      alpha: ink.label,
    });
    y += 16;
    const desc = b.text(left, y, t("decks.io.description"), typeRole.body, {
      size: isDesktopType() ? 13 : 10,
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: column,
    });
    y += desc.height + 8;

    const toggle = (which: "paste" | "marvelcdb"): void => {
      this.#importExportOpen = this.#importExportOpen === which ? null : which;
      this.#rebuild();
    };
    const buttonGap = 6;
    const buttonWidth = (column - buttonGap * 2) / 3;
    const pasteToggleRect: Rect = { x: left, y, width: buttonWidth, height: this.#row };
    const mcdbToggleRect: Rect = { x: left + buttonWidth + buttonGap, y, width: buttonWidth, height: this.#row };
    const exportRect: Rect = { x: left + (buttonWidth + buttonGap) * 2, y, width: buttonWidth, height: this.#row };
    b.button({
      key: "ie-paste-toggle",
      rect: pasteToggleRect,
      label: t("decks.io.paste"),
      look: "secondary",
      type: typeRole.label,
      selected: this.#importExportOpen === "paste",
    });
    this.#actions.set("ie-paste-toggle", () => toggle("paste"));
    this.#stops.set("ie-paste-toggle", { rect: pasteToggleRect, activate: () => toggle("paste") });
    b.button({
      key: "ie-marvelcdb-toggle",
      rect: mcdbToggleRect,
      label: t("decks.io.cdbLink"),
      look: "secondary",
      type: typeRole.label,
      selected: this.#importExportOpen === "marvelcdb",
    });
    this.#actions.set("ie-marvelcdb-toggle", () => toggle("marvelcdb"));
    this.#stops.set("ie-marvelcdb-toggle", { rect: mcdbToggleRect, activate: () => toggle("marvelcdb") });
    const canExport = selected !== null && canExportToMarvelCdb(selected.deck);
    const doExport = (): void => {
      if (selected && canExport) this.#exportToClipboard(selected.deck);
    };
    b.button({
      key: "ie-export",
      rect: exportRect,
      label: t("decks.io.export"),
      look: "secondary",
      type: typeRole.label,
      ...(canExport ? {} : { disabled: !selected ? t("decks.io.selectFirst") : CUSTOM_EXPORT_REASON }),
    });
    this.#actions.set("ie-export", doExport);
    this.#stops.set("ie-export", { rect: exportRect, activate: doExport });
    y += this.#row + 8;

    if (this.#importExportOpen === "paste") {
      const pasteRect: Rect = { x: left, y, width: column, height: 64 };
      b.textField(pasteRect, {
        key: "paste-field",
        value: this.#pasteText,
        placeholder: t("decks.io.pastePlaceholder"),
        multiline: true,
      });
      this.#stops.set("paste-field", {
        rect: pasteRect,
        activate: () => this.#importField("paste-field")?.focusInput(),
      });
      y += 64 + 8;
      const pasteImportRect: Rect = { x: left, y, width: column, height: this.#row };
      const doPasteImport = (): void => void this.#importPaste();
      b.button({
        key: "paste-import",
        rect: pasteImportRect,
        label: this.#busy ? t("decks.io.importing") : t("decks.io.importList"),
        look: "secondary",
        type: typeRole.label,
        ...(this.#busy ? { disabled: true as const } : {}),
      });
      this.#actions.set("paste-import", doPasteImport);
      this.#stops.set("paste-import", { rect: pasteImportRect, activate: doPasteImport });
    }

    if (this.#importExportOpen === "marvelcdb") {
      // Always offered, not gated on `import.meta.env.DEV`: `vite preview` serves the same production bundle a real deploy
      // would (a genuine production deploy 404s instead, see `vite-marvelcdb-import.ts`).
      const mcdbFieldRect: Rect = { x: left, y, width: column, height: this.#row };
      b.textField(mcdbFieldRect, {
        key: "marvelcdb-field",
        value: this.#marvelcdbText,
        placeholder: t("decks.io.linkPlaceholder"),
      });
      this.#stops.set("marvelcdb-field", {
        rect: mcdbFieldRect,
        activate: () => this.#importField("marvelcdb-field")?.focusInput(),
      });
      y += this.#row + 8;
      const mcdbImportRect: Rect = { x: left, y, width: column, height: this.#row };
      const doMcdbImport = (): void => void this.#importMarvelCdb();
      b.button({
        key: "marvelcdb-import",
        rect: mcdbImportRect,
        label: this.#busy ? t("decks.io.importing") : t("decks.io.importCdb"),
        look: "secondary",
        type: typeRole.label,
        ...(this.#busy ? { disabled: true as const } : {}),
      });
      this.#actions.set("marvelcdb-import", doMcdbImport);
      this.#stops.set("marvelcdb-import", { rect: mcdbImportRect, activate: doMcdbImport });
    }
  }

  #importField(key: "paste-field" | "marvelcdb-field"): McTextField | null {
    return (this.#region?.element.elementOf(key) as McTextField | null) ?? null;
  }

  // ------------------------------------------------------------------------------------------------------------
  // The card pool pane (D14): the *selected* deck's own browsable legal pool — its aspect(s), Basic and Hero
  // cards — filtered by one of those (radio-style; "all" clears it) and sortable by cost. Read-only browsing:
  // editing a deck's contents is `scenes/deck-builder.ts`'s job, reached from "Edit" in the stats pane.
  // ------------------------------------------------------------------------------------------------------------
  #drawPoolPane(b: SheetBuilder, rect: Rect, selected: DeckOption | null, deckListOnly = false): readonly string[] {
    const left = rect.x;
    const column = rect.width;
    this.#poolContext = null;
    this.#poolMetrics = { rowHeight: 0, rowCount: 0, viewHeight: 0, window: "" };
    const say = (text: string): readonly string[] => {
      b.sectionHeader({ x: left, y: rect.y, width: column, height: 24 }, t("decks.cardPool"), { size: 19 });
      b.emptyState({ x: left, y: rect.y + 32, width: column }, text);
      return [];
    };
    if (!selected) return say(t("decks.poolSelectDeck"));
    const identity = this.#identityOf(selected.deck);
    if (!identity) return say(t("decks.poolNoIdentity"));
    this.#poolContext = { deck: selected.deck, identity };
    // The worker ranks the cards this deck can browse: they change with its hero and aspects.
    const version = `${currentPoolKey()}:${identity.id as string}:${selected.deck.aspects.join(",")}:${artLanguageNow()}`;
    if (version !== this.#poolDocsVersion) {
      this.#poolDocsVersion = version;
      this.#poolSearch.refresh();
    }

    // D14's own header shape (point 3 of the 2026-09-18 fidelity pass): small filter chips right-aligned on the
    // *same* line as "CARD POOL", the rule running only between the label and the first chip — not a full-width
    // rule followed by a separate row of full-height buttons.
    // A community deck previews its own list (it can't be edited here, so the rest of the pool is beside the point).
    let y = this.#drawPoolHeader(
      b,
      left,
      rect.y,
      column,
      this.#poolChipDefs(selected.deck),
      deckListOnly ? t("decks.deckList") : t("decks.cardPool"),
    );

    // The text search (a real input in the panel), one compact row under the header and the chips: free words are
    // ranked by the fuzzy worker, and the smart filter's `field:value` terms (`o:2 a:justice t:event`) narrow the pool.
    const poolSearchRect: Rect = { x: left, y, width: column, height: this.#row };
    const steam = inputDevice().mode === "pad" && inputDevice().pad?.steam === true;
    b.search(poolSearchRect, {
      key: "pool-search",
      // The text the pool has taken, never the field's live draft: the field keeps its own pending draft across a redraw
      // while this stays the same, and a covered panel puts the field back to what the pool accepted (`guardRegion`).
      value: this.#poolSearchText,
      placeholder: t("decks.poolSearch"),
      clearLabel: t("decks.clearSearch"),
      escapeClears: true,
      ...(steam ? { focusPlaceholder: t("reader.steamKeyboard") } : {}),
    });
    this.#stops.set("pool-search", { rect: poolSearchRect, activate: () => this.#poolSearchField()?.focusInput() });
    y += this.#row + 10;

    const cards = this.#poolCards(selected.deck, identity, deckListOnly);
    if (cards.length === 0) {
      const searched = this.#poolSearchText.trim();
      b.emptyState(
        { x: left, y, width: column },
        this.#poolSearch.pending
          ? t("pause.searching")
          : searched
            ? t("decks.poolNoMatchSearch", { text: searched })
            : t("decks.poolNoMatch"),
      );
      return [];
    }

    const geometry = poolGridGeometry(column, cards.length, false, cardSizeFactor(appSession().settings.cardSize));
    const listRect: Rect = {
      x: left,
      y,
      width: column,
      height: Math.max(geometry.cellHeight, rect.y + rect.height - y),
    };
    const layout = drawCardPool(b, {
      key: POOL_LIST,
      rect: listRect,
      view: "grid",
      controls: false,
      count: cards.length,
      geometry,
      listRow: { height: 0, thumbWidth: 0 },
      scrollTop: this.#poolScrollTop(),
      cardAt: (index) => this.#poolCardView(cards[index]!, selected.deck),
    });
    this.#poolMetrics = {
      rowHeight: layout.rowHeight,
      rowCount: layout.rowCount,
      viewHeight: listRect.height,
      window: layout.window,
    };
    // The pool grid's cards, from the list's scroll on each pointer move; a card is hovered over its picture and caption.
    this.#hoverLists.push(() => this.#poolHovers(cards.length, layout, geometry.columns, (i) => cards[i]!));
    const view = (): Rect => {
      const scroller = this.#poolScroller();
      return scroller && this.#region ? this.#region.rectOf(scroller) : listRect;
    };
    cards.forEach((card, index) => {
      const row = Math.floor(index / geometry.columns);
      this.#stops.set(`pool-card:${card.id as string}`, {
        // Clipped to the list, so the ring on a card scrolled half out of view never draws over the search or chips.
        rect: () => {
          const at = view();
          const cell = layout.cellRect(index);
          const top = this.#poolScroller()?.scrollTop ?? 0;
          return clipToView({ x: cell.x, y: at.y + cell.y - top, width: cell.width, height: cell.height }, at);
        },
        view,
        activate: () => this.#showPaneCard(card, true),
        inspect: () => this.#inspectCard(card),
        ensureVisible: () => this.#poolScrollIntoView(row, layout.rowHeight),
      });
    });
    return cards.map((card) => card.id as string);
  }

  /** The pool list's scroller, while it is drawn. */
  #poolScroller(): HTMLElement | null {
    return this.#region?.element.elementOf(POOL_LIST) ?? null;
  }

  /** The pool search field (`mc-search-field`), while it is drawn. */
  #poolSearchField(): McSearchField | null {
    return (this.#region?.element.elementOf("pool-search") as McSearchField | null) ?? null;
  }

  /** The list the pad's paging and right stick scroll: the pool on the Cards tab (and the wide layout's pool), else the deck list. */
  #pageScroller(): HTMLElement | null {
    return this.#activeTab === "cards" ? this.#poolScroller() : this.#listScroller();
  }

  /** Where the pool list is scrolled to now (0 after a new search, filter or deck). */
  #poolScrollTop(): number {
    return this.#poolFromTop ? 0 : (this.#poolScroller()?.scrollTop ?? 0);
  }

  /** A pad focus brings a card's row into view. */
  #poolScrollIntoView(row: number, rowHeight: number): void {
    const scroller = this.#poolScroller();
    if (!scroller) return;
    const top = row * rowHeight;
    const bottom = top + rowHeight;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
  }

  /** The pool list scrolled: the rows near the new offset are built when the window moves. */
  #onPoolScroll(top: number): void {
    const { rowHeight, rowCount, viewHeight, window } = this.#poolMetrics;
    if (poolWindowKey(rowHeight, rowCount, viewHeight, top) !== window) this.#rebuild();
  }

  /** The pool cards on screen with their place (the list scroll applied), for the hover popover. */
  #poolHovers(
    count: number,
    layout: CardPoolLayout,
    columns: number,
    cardAt: (index: number) => AnyCard,
  ): readonly (readonly [string, HoverCardIdRect])[] {
    const scroller = this.#poolScroller();
    if (!scroller || !this.#region) return [];
    const view = this.#region.rectOf(scroller);
    const top = scroller.scrollTop;
    const found: (readonly [string, HoverCardIdRect])[] = [];
    const first = Math.max(0, Math.floor(top / layout.rowHeight));
    const last = Math.min(layout.rowCount, Math.ceil((top + view.height) / layout.rowHeight));
    for (let row = first; row < last; row++) {
      const inRow = Math.min(columns, count - row * columns);
      for (let col = 0; col < inRow; col++) {
        const index = row * columns + col;
        const face = layout.faceRect(index);
        const rect = clipHoverRect(
          { x: face.x, y: view.y + face.y - top, width: face.width, height: face.height },
          view,
        );
        const cardId = cardAt(index).id as string;
        if (rect) found.push([hoverSlotOf(cardId, `cell${row}.${col}`), { ...rect, cardId, through: true }]);
      }
    }
    return found;
  }

  /** A pool card as the shared pool draws it: its scan, name, type and how many the deck holds of its limit. */
  #poolCardView(card: AnyCard, deck: Deck): CardPoolCard {
    const cardId = card.id as string;
    const limit = ("deckLimit" in card ? (card as unknown as { deckLimit: number }).deckLimit : null) ?? null;
    const have = deck.cards.find((c) => (c.cardId as string) === cardId)?.quantity ?? 0;
    const lang = artLanguageNow();
    const title = localizedLabelOf(card, lang);
    const typeLabel = `${subtitleCutFrom(card, title) ? `${subtitleCutFrom(card, title)} · ` : ""}${typeWordOf(card.type, lang)}`;
    this.#actions.set(`open:${cardId}`, () => this.#showPaneCard(card));
    this.#inspects.set(`open:${cardId}`, () => this.#inspectCard(card));
    return {
      cardId,
      image: this.#pictures.image(artFor(card, { kind: "front" })),
      missing: t("deckCheck.noScan"),
      title,
      cost:
        "cost" in card && typeof (card as unknown as { cost: unknown }).cost === "number"
          ? (card as unknown as { cost: number }).cost
          : null,
      caption: limit !== null ? `${typeLabel} · ${t("decks.poolInDeck", { have, limit })}` : typeLabel,
      captionStrong: false,
      typeLine: "",
      note: null,
      rules: "",
      quantity: have,
      shown: this.#paneCard !== null && (this.#paneCard.id as string) === cardId,
    };
  }

  /** The documents the search worker ranks: every card the selected deck can browse. */
  #poolDocuments(): { readonly docs: readonly SearchDocument[]; readonly version: string } {
    const context = this.#poolContext;
    if (!context) return { docs: [], version: "" };
    const lang = artLanguageNow();
    const { deck, identity } = context;
    return {
      docs: poolSearchDocuments(
        browsablePool(currentPool(), identity, deck.aspects, {}),
        lang,
        (code) => packNameOf(code),
        this.#poolDocs,
      ),
      version: `${currentPoolKey()}:${identity.id as string}:${deck.aspects.join(",")}:${lang}`,
    };
  }

  /**
   * "CARD POOL ─────" with its filter chips right-aligned on the same line (D14's own `#s14` markup: the rule is
   * a `<span style="flex:1">` sitting *between* the label and the chips, not a separate full-width rule with its
   * own row of chips below). Returns the next free `y`.
   */
  #drawPoolHeader(
    b: SheetBuilder,
    left: number,
    y: number,
    column: number,
    chipDefs: readonly ChipDef[],
    title: string,
  ): number {
    const headingSize = b.measure(title, typeRole.barTitle, { size: 19 });
    const chipHeight = this.#row;
    // Sized to the stamp label as drawn, never under the per-character estimate, and with room for the chosen tick.
    const widthOf = (chip: ChipDef): number =>
      Math.max(
        minChipCellWidth(chip.text),
        Math.ceil(b.measure(caseOf(STAMP_CHIP_TYPE, chip.text), STAMP_CHIP_TYPE, { letterSpacing: 1.1 }).width) + 44,
      );
    const beside = chipsFitBesideHeading(column, headingSize.width, chipDefs.map(widthOf));
    // On a phone the chips would be drawn over the heading ("CARD POOL" clipped to "CA" behind the first chip), so
    // they fold behind a Filters button beside it, and open onto their own row(s) under it, left-aligned.
    const toggleWidth = 124;
    // The heading and the chips share one line as tall as the taller of them, each centred on it: chips taller than
    // the heading must not start above the line (they were cut off under the header bar).
    const lineHeight = Math.max(headingSize.height, chipHeight);
    const headingY = y + (lineHeight - headingSize.height) / 2;
    b.text(left, headingY, title, typeRole.barTitle, { size: 19, color: surface.ink.hex });
    if (!beside) {
      const active = (this.#poolAspectFilter ? 1 : 0) + (this.#poolSortByCost ? 1 : 0);
      const rect: Rect = { x: left + column - toggleWidth, y, width: toggleWidth, height: chipHeight };
      const toggle = (): void => {
        this.#poolFiltersOpen = !this.#poolFiltersOpen;
        this.#rebuild();
      };
      b.button({
        key: "pool-chip:filters",
        rect,
        label: `${t("decks.filters")} ${this.#poolFiltersOpen ? "▴" : "▾"}${active > 0 ? ` · ${active}` : ""}`,
        look: "secondary",
        type: typeRole.label,
        selected: active > 0,
      });
      this.#actions.set("pool-chip:filters", toggle);
      this.#stops.set("pool-chip:filters", { rect, activate: toggle });
    }
    const chipY = beside ? y + (lineHeight - chipHeight) / 2 : y + chipHeight + 8;
    const shownChips = beside || this.#poolFiltersOpen ? chipDefs : [];
    const packed = packChipsNatural(shownChips, left, chipY, column, chipHeight, beside ? "right" : "left", widthOf);
    for (const { chip, rect: cell } of packed.placed) {
      const key = `pool-chip:${chip.id}`;
      if (chip.tint)
        drawTintButton(b, key, cell, chip.text, chip.tint, { selected: chip.selected, type: STAMP_CHIP_TYPE });
      else
        b.button({
          key,
          rect: cell,
          label: chip.text,
          look: "secondary",
          type: STAMP_CHIP_TYPE,
          selected: chip.selected,
        });
      this.#actions.set(key, chip.onClick);
      this.#stops.set(key, { rect: cell, activate: chip.onClick });
    }
    const chipsLeftEdge =
      beside && packed.placed.length > 0 ? Math.min(...packed.placed.map((p) => p.rect.x)) : left + column;
    const ruleStart = left + headingSize.width + 10;
    const ruleEnd = (beside ? chipsLeftEdge : left + column - toggleWidth) - 10;
    if (ruleEnd > ruleStart) {
      b.box(
        { x: ruleStart, y: headingY + headingSize.height / 2 - 1.5, width: ruleEnd - ruleStart, height: 3 },
        { fill: surface.ink.hex },
      );
    }
    if (!beside) return (shownChips.length > 0 ? packed.bottom : y + chipHeight) + 12;
    return Math.max(y + lineHeight, packed.bottom) + 12;
  }

  /** D14's own pool filter chips: the deck's own chosen aspect(s), Basic, Hero — one active at a time, click again to clear back to "everything" — then a Cost sort toggle. Deviation from the mock's own static screenshot, noted in this scene's header comment: D14 draws its "Aggression" chip pre-filled while the grid still shows Basic/Hero cards too, which reads as a static label rather than a working filter; here every chip (aspect included) is a real, symmetric toggle. */
  #poolChipDefs(deck: Deck): readonly ChipDef[] {
    const defs: ChipDef[] = [];
    const toggleAspect = (value: CoreAspect | "basic" | "identity"): void => {
      this.#poolAspectFilter = this.#poolAspectFilter === value ? null : value;
      this.#poolFromTop = true;
      this.#rebuild();
    };
    // Each chip wears its aspect's stamp, the colors the deck rows and the deck builder use; Hero, which has no
    // printed frame color of its own, is an ink stamp so it never reads as one of the aspects.
    const tintOf = (aspect: CoreAspect): { fill: number; ink: number } => {
      const stamp = aspectStampOf(aspect);
      return { fill: stamp.fill, ink: stamp.ink };
    };
    for (const aspect of deck.aspects) {
      defs.push({
        id: `aspect:${aspect}`,
        text: aspectStampOf(aspect).label,
        selected: this.#poolAspectFilter === aspect,
        onClick: () => toggleAspect(aspect),
        tint: tintOf(aspect),
      });
    }
    defs.push({
      id: "basic",
      text: aspectStampOf("basic").label,
      selected: this.#poolAspectFilter === "basic",
      onClick: () => toggleAspect("basic"),
      tint: tintOf("basic"),
    });
    defs.push({
      id: "hero",
      text: t("decks.poolHero"),
      selected: this.#poolAspectFilter === "identity",
      onClick: () => toggleAspect("identity"),
      tint: { fill: surface.ink.hex, ink: surface.paper.hex },
    });
    defs.push({
      id: "cost",
      text: t("decks.poolCost"),
      selected: this.#poolSortByCost,
      onClick: () => {
        this.#poolSortByCost = !this.#poolSortByCost;
        this.#poolFromTop = true;
        this.#rebuild();
      },
    });
    return defs;
  }

  #poolCards(deck: Deck, identity: HeroIdentityCard, deckListOnly = false): readonly AnyCard[] {
    // The text's words are still being ranked: nothing is listed, never the previous text's matches.
    if (this.#poolSearch.pending) return [];
    const filter: PoolFilter = this.#poolAspectFilter ? { aspect: this.#poolAspectFilter } : {};
    const browsable = browsablePool(currentPool(), identity, deck.aspects, this.#poolSearch.filterFor(filter));
    const inDeck = new Set(deck.cards.map((entry) => entry.cardId as string));
    const inScope = deckListOnly ? browsable.filter((card) => inDeck.has(card.id as string)) : browsable;
    const ranking = this.#poolSearch.ranking;
    const found = ranking ? inScope.filter((card) => ranking.has(card.id as string)) : inScope;
    const pool = ranking
      ? [...found].sort((a, b) => (ranking.get(b.id as string) ?? 0) - (ranking.get(a.id as string) ?? 0))
      : found;
    if (!this.#poolSortByCost) return pool;
    const costOf = (card: AnyCard): number =>
      "cost" in card ? (card as unknown as { cost: number }).cost : Number.POSITIVE_INFINITY;
    return [...pool].sort((a, b) => costOf(a) - costOf(b) || a.name.localeCompare(b.name));
  }

  /**
   * Puts `card` in the stats pane (the narrow layout's Stats tab). From a pad or the keyboard (`byFocus`) the focus goes
   * to its way back; a tap moves no focus, so no ring shows on a touch screen.
   */
  #showPaneCard(card: AnyCard, byFocus = false): void {
    this.#paneCard = card;
    this.#paneCardDeckId = this.#selectedDeckId;
    const tab = this.#activeTab;
    if (this.#tabsShown && this.#activeTab !== "stats") this.#activeTab = "stats";
    this.#rebuild();
    // A community deck's pane has no card view: the card opens in Inspect, as it did before.
    if (!this.#stops.has("card-back")) {
      this.#paneCard = null;
      this.#activeTab = tab;
      this.#rebuild();
      this.#inspectCard(card);
      return;
    }
    if (byFocus) this.#route?.focusKey("card-back");
  }

  #closePaneCard(byFocus = false): void {
    const card = this.#paneCard;
    this.#paneCard = null;
    // On the narrow layout the card came from the Cards tab: back there, on it.
    if (this.#tabsShown) this.#activeTab = "cards";
    this.#rebuild();
    if (card && byFocus) this.#route?.focusKey(`pool-card:${card.id as string}`);
  }

  /** The stats pane's card view: the card, what your games say about it, the decks that hold it, and Inspect. */
  #drawPaneCard(
    b: SheetBuilder,
    rect: Rect,
    left: number,
    column: number,
    top: number,
    card: AnyCard,
    deck: Deck,
  ): void {
    let y = top;
    const backRect: Rect = { x: left, y, width: column, height: this.#row };
    const back = (byFocus = false): void => this.#closePaneCard(byFocus);
    this.#glyphs.button(b, {
      key: "card-back",
      rect: backRect,
      label: t("decks.card.back"),
      look: "onInk",
      type: typeRole.label,
      ids: ["cancel"],
      ground: "ink",
    });
    this.#actions.set("card-back", () => back());
    this.#stops.set("card-back", {
      rect: backRect,
      activate: () => back(true),
      inspect: () => this.#inspectCard(card),
    });
    y += this.#row + 12;
    const footerTop = rect.y + rect.height - hit.primary - 16 - 13 - 12;
    const inspectRect: Rect = { x: left, y: footerTop - this.#row, width: column, height: this.#row };
    // The picture on the left, the facts beside it.
    const pic: Rect = {
      x: left,
      y,
      width: Math.min(130, column * 0.42),
      height: Math.min(130, column * 0.42) * (88 / 63),
    };
    const held = this.#pictures.image(artFor(card, { kind: "front" }));
    b.image(pic, {
      src: held.src,
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
      fill: surface.parchment.hex,
      missing: t("rules.noScan"),
      color: surface.ink.hex,
      key: "card-pic",
    });
    this.#paneThumbs.push({ cardId: card.id as string, slot: hoverSlotOf(card.id as string, "paneCard"), rect: pic });
    const textX = pic.x + pic.width + 10;
    const textWidth = left + column - textX;
    const name = b.text(textX, y, card.name, typeRole.barTitle, {
      size: 20,
      color: surface.paper.hex,
      wrapWidth: textWidth,
      maxLines: 2,
    });
    b.text(textX, y + name.height + 4, card.type.replace(/_/g, " ").toUpperCase(), typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
      fitWidth: textWidth,
    });
    const factY = y + name.height + 24;
    const heroId = deck.identityCardId as string;
    const hero = this.#insights ? cardPlayOf(this.#insights, card.id as string, heroId, POOL_STATS_NAMES) : null;
    const all = this.#insights ? cardPlayOf(this.#insights, card.id as string, null, POOL_STATS_NAMES) : null;
    y = Math.max(pic.y + pic.height, factY) + 12;
    const block = (title: string, lines: readonly { label: string; value: string }[] | null, empty: string): void => {
      if (y + 20 > inspectRect.y - 8) return;
      b.text(left, y, title.toUpperCase(), typeRole.label, { color: signal.caution.hex });
      y += 18;
      if (!lines) {
        const none = b.text(left, y, empty, typeRole.body, {
          size: 12,
          color: surface.paper.hex,
          alpha: ink.secondary,
          wrapWidth: column,
        });
        y += none.height + 10;
        return;
      }
      for (const line of lines) {
        if (y + 16 > inspectRect.y - 8) return;
        const l = b.text(left, y, line.label, typeRole.body, { size: 12, color: surface.paper.hex, alpha: ink.body });
        b.text(left + column, y, line.value, typeRole.rowTitle, {
          size: 12,
          color: surface.paper.hex,
          origin: [1, 0],
          fitWidth: Math.max(20, column - l.width - 10),
        });
        y += 18;
      }
      y += 8;
    };
    if (!this.#insights) block(t("decks.card.yourPlay"), null, t("decks.games.reading"));
    else {
      const heroName = (currentCardsById().get(heroId)?.name ?? heroId).replace(/ \(.*\)$/, "");
      block(t("decks.card.withHero", { hero: heroName }), hero, t("decks.card.notWithHero", { hero: heroName }));
      block(t("decks.card.everyHero"), all, t("decks.card.notYet"));
    }
    // Your decks that hold it.
    const holding = this.#deckOptions()
      .filter((option) => option.deck.cards.some((line) => line.cardId === card.id))
      .map((option) => option.deck.name);
    if (holding.length > 0 && y + 36 < inspectRect.y - 8) {
      b.text(left, y, t("decks.card.inDecks").toUpperCase(), typeRole.label, { color: signal.caution.hex });
      y += 18;
      const room = inspectRect.y - 8 - y;
      b.scroll("card-holding", { x: left, y, width: column, height: Math.max(0, room) }, 4 * 18 + 18, (inner) => {
        inner.text(
          left,
          0,
          holding.slice(0, 4).join("\n") +
            (holding.length > 4 ? `\n${t("decks.card.more", { count: holding.length - 4 })}` : ""),
          typeRole.body,
          { size: 12, color: surface.paper.hex, alpha: ink.body, wrapWidth: column },
        );
      });
    }
    const inspect = (): void => this.#inspectCard(card);
    this.#glyphs.button(b, {
      key: "card-inspect",
      rect: inspectRect,
      label: t("decks.card.inspect"),
      look: "onInk",
      type: typeRole.label,
      ids: ["inspect"],
      ground: "ink",
    });
    this.#actions.set("card-inspect", inspect);
    this.#stops.set("card-inspect", { rect: inspectRect, activate: inspect, inspect });
  }

  #inspectCard(card: AnyCard): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: card.id, face: { kind: "front" } } });
  }

  // ------------------------------------------------------------------------------------------------------------
  // The stats pane (2026-09-18 fidelity pass, point 5): a big Bangers deck title, one meta line (card count,
  // legality and source — dropping the separate "PRECON · <hero>" line the title's own short form now makes
  // redundant), a paper rule, red-highlighted curve bars, label-over-number composition tiles, Check/Edit/Delete
  // as a row of small buttons, "Recently changed", then the footer D14 itself draws: DUPLICATE beside the single
  // red "PLAY THIS DECK ▸".
  // ------------------------------------------------------------------------------------------------------------
  #drawStatsPane(b: SheetBuilder, rect: Rect, option: DeckOption | null): void {
    // The ink panel is drawn in the canvas too: the games and card views below are still Phaser, seen through a hole.
    const bg = this.add.graphics();
    paintPanel(bg, rect, "onInk", "rest");
    b.box(rect, { fill: surface.ink.hex });

    const left = rect.x + 16;
    const column = rect.width - 32;
    let y = rect.y + 16;

    if (!option) {
      b.text(left, y, t("decks.stats.select"), typeRole.body, {
        color: surface.paper.hex,
        alpha: ink.body,
        wrapWidth: column,
      });
      return;
    }

    const deck = option.deck;
    const stats = deckStatsOf(deck, currentPool());
    const status = deckStatusOf(option);

    // A very long deck name keeps to three lines, cut with an ellipsis only at the extreme.
    const name = b.text(left, y, cardTitleOf(option).toUpperCase(), typeRole.barTitle, {
      size: 26,
      color: surface.paper.hex,
      wrapWidth: column,
      maxLines: 3,
    });
    y += name.height + 6;
    // Wraps inside the pane: an imported deck's line ("... · LEGAL · IMPORTED") is wider than one row.
    const metaText = `${deck.source.kind === "precon" ? "" : deckAspectsText(deck)}${deckCountText(stats).toUpperCase()} · ${t("decks.stats.min", { min: DECK_MIN_CARDS }).toUpperCase()} · ${status.text.toUpperCase()} · ${t(`decks.source.${deck.source.kind}`).toUpperCase()}`;
    const meta = b.text(left, y, metaText, typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
      wrapWidth: column,
    });
    y += Math.max(20, meta.height + 4);
    // A copy of a community deck keeps its author's credit.
    const basedOn = communityEntryOf(deck, communityDecks());
    if (basedOn) {
      const credit = b.text(left, y, t("decks.stats.community", { credit: communityCredit(basedOn) }), typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.label,
        wrapWidth: column,
      });
      y += credit.height + 6;
    }
    b.box({ x: left, y, width: column, height: 3 }, { fill: surface.paper.hex });
    y += 12;

    // Footer, pinned to the bottom of the pane regardless of how much the body above used.
    this.#drawStatsFooter(b, rect, left, column, option);

    if (this.#paneCard && this.#paneCardDeckId !== (deck.id as string)) this.#paneCard = null;
    if (this.#paneCard) {
      // The card view is Phaser still: its body shows through a hole above the footer.
      this.#drawPaneCard(b, rect, left, column, y, this.#paneCard, deck);
      return;
    }

    // This deck / From your games (#529): LT / RT, with the trigger that reaches the other tab on it.
    const tabWidth = (column - CHIP_GAP) / 2;
    for (const [index, tab] of (["deck", "games"] as const).entries()) {
      const tabRect: Rect = { x: left + index * (tabWidth + CHIP_GAP), y, width: tabWidth, height: this.#row };
      const selected = this.#paneTab === tab;
      const choose = (): void => this.#setPaneTab(tab);
      const spec = {
        key: `pane:${tab}`,
        rect: tabRect,
        label: tab === "deck" ? t("decks.stats.thisDeck") : t("decks.stats.fromGames"),
        look: selected ? ("primary" as const) : ("onInk" as const),
        type: typeRole.label,
      };
      if (selected) b.button(spec);
      else {
        const trigger = tab === "deck" ? "lt" : "rt";
        this.#glyphs.button(b, {
          ...spec,
          ids: [],
          ground: "ink",
          specs: (set, snapshot) => {
            if (set !== "pad") return null;
            const glyph = layerTriggerGlyph(trigger, snapshot.state, snapshot.settings);
            return glyph ? [glyph] : null;
          },
        });
      }
      this.#actions.set(`pane:${tab}`, choose);
      this.#stops.set(`pane:${tab}`, { rect: tabRect, activate: choose });
    }
    y += this.#row + 14;

    if (this.#paneTab === "games") {
      this.#drawPaneGames(b, left, y, column, rect.y + rect.height - hit.primary - 16 - 13 - 12, deck);
      return;
    }

    const small = (text: string, at: number): void => {
      b.text(left, at, text, typeRole.label, { color: surface.paper.hex, alpha: ink.label });
    };
    const avgText =
      stats.averageCost === null ? "" : ` · ${t("decks.stats.avg", { avg: oneDecimal(stats.averageCost) })}`;
    small(`${t("decks.stats.curve")}${avgText}`.toUpperCase(), y);
    y += 16;
    // A short screen (a phone's Stats tab) cannot fit all of it above the pinned footer: the chart gives up height
    // first, then the tiles get shorter, and "Recently changed" (the least needed) is left out last.
    const tileCount = compositionTilesOf(stats, artLanguageNow()).length;
    const tileRows = Math.ceil(tileCount / 3);
    const footerTop = rect.y + rect.height - hit.primary - 16 - 13 - 8;
    const belowChart = (tileHeight: number): number =>
      16 + (tileRows === 0 ? 0 : tileRows * (tileHeight + 7) - 7) + 12 + this.#row + 14;
    const recentlyHeight = 16 + 22;
    const roomFor = (tileHeight: number): number => footerTop - y - belowChart(tileHeight) - 16;
    let tileHeight = 46;
    let showRecently = roomFor(tileHeight) - recentlyHeight >= 40;
    let chartHeight = Math.min(84, Math.max(40, roomFor(tileHeight) - (showRecently ? recentlyHeight : 0)));
    if (roomFor(tileHeight) < 40) {
      tileHeight = 40;
      showRecently = false;
      chartHeight = Math.min(84, Math.max(32, roomFor(tileHeight)));
    }
    this.#drawStatCurveBars(b, left, y, column, chartHeight, costCurveBars(stats));
    y += chartHeight + 16;

    small(t("decks.stats.composition").toUpperCase(), y);
    y += 16;
    y = this.#drawStatTiles(b, left, y, column, compositionTilesOf(stats, artLanguageNow()), tileHeight) + 12;

    // Check/Edit/Delete: real, needed actions D14 itself doesn't draw: a row of small buttons, so the footer below still
    // ends in exactly Duplicate + the red Play button.
    const editable = deck.source.kind !== "precon";
    // A pending Delete confirmation belongs to the deck it was pressed on; selecting another drops it.
    if (this.#deleteArmedId !== null && this.#deleteArmedId !== (deck.id as string)) this.#deleteArmedId = null;
    const armed = this.#deleteArmedId === (deck.id as string);
    const confirmDelete = (): void => {
      if (this.#deleteArmedId === (deck.id as string)) {
        this.#deleteArmedId = null;
        void this.#delete(deck.id);
        return;
      }
      this.#deleteArmedId = deck.id as string;
      this.#status = { text: t("decks.stats.confirmMessage", { name: deck.name }), tone: "error" };
      this.#rebuild();
    };
    const actionDefs: readonly { readonly id: string; readonly text: string; readonly onClick: () => void }[] = [
      { id: "check", text: t("decks.stats.check"), onClick: () => this.#openDeckCheck(deck) },
      {
        id: "edit",
        text: editable ? t("decks.stats.edit") : t("decks.stats.editCopy"),
        onClick: () => goToScreen(this, SCENES.deckBuilder, { deck } satisfies DeckBuilderSceneData),
      },
      ...(editable
        ? [
            {
              id: "delete",
              text: armed ? t("decks.stats.confirmDelete") : t("decks.stats.delete"),
              onClick: confirmDelete,
            },
          ]
        : []),
    ];
    const actionWidth = (column - CHIP_GAP * (actionDefs.length - 1)) / actionDefs.length;
    actionDefs.forEach((action, index) => {
      const cell: Rect = { x: left + index * (actionWidth + CHIP_GAP), y, width: actionWidth, height: this.#row };
      b.button({ key: `stats-${action.id}`, rect: cell, label: action.text, look: "quiet", type: typeRole.label });
      this.#actions.set(`stats-${action.id}`, action.onClick);
      this.#stops.set(`stats-${action.id}`, { rect: cell, activate: action.onClick });
    });
    y += this.#row + 14;

    // "Recently changed" (W9/S1): the minimal honest version, one timestamp and no revision history.
    if (!showRecently) return;
    small(t("decks.stats.recently").toUpperCase(), y);
    y += 16;
    if (deck.updatedAt) {
      b.box({ x: left, y, width: 3, height: 15 }, { fill: surface.paper.hex });
      b.text(
        left + 9,
        y,
        t("decks.stats.lastChanged", { date: new Date(deck.updatedAt).toLocaleDateString() }),
        typeRole.body,
        { color: surface.paper.hex, alpha: ink.secondary },
      );
    } else {
      b.text(left, y, t("decks.stats.noHistory").toUpperCase(), typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.meta,
        wrapWidth: column,
      });
    }
  }

  /** The pane's footer, on either tab: Duplicate beside the single red Play. Returns the footer rule's y (the body ends above it). */
  #drawStatsFooter(b: SheetBuilder, rect: Rect, left: number, column: number, option: DeckOption): number {
    const deck = option.deck;
    const footerHeight = hit.primary;
    const footerY = rect.y + rect.height - footerHeight - 16;
    b.box({ x: left, y: footerY - 13, width: column, height: 3 }, { fill: surface.paper.hex });

    const duplicateWidth = column * 0.38;
    const duplicateRect: Rect = { x: left, y: footerY, width: duplicateWidth, height: footerHeight };
    const doDuplicate = (): void => this.#duplicate(deck);
    b.button({
      key: "stats-duplicate",
      rect: duplicateRect,
      label: t("decks.stats.duplicate"),
      look: "onInk",
      type: typeRole.backLabel,
    });
    this.#actions.set("stats-duplicate", doDuplicate);
    this.#stops.set("stats-duplicate", { rect: duplicateRect, activate: doDuplicate });

    const playRect: Rect = {
      x: left + duplicateWidth + CHIP_GAP,
      y: footerY,
      width: column - duplicateWidth - CHIP_GAP,
      height: footerHeight,
    };
    const canPlay = option.seatable;
    b.button({
      key: "stats-play",
      rect: playRect,
      label: t("decks.stats.play"),
      look: "primary",
      type: typeRole.barTitle,
      ...(canPlay
        ? {}
        : {
            disabled: option.checking
              ? t("room.picker.checking")
              : (deckReasonText(option.blockedReason) ?? t("decks.stats.notLegal")),
          }),
    });
    this.#actions.set("stats-play", () => {
      if (canPlay) this.#playDeck(deck);
    });
    this.#stops.set("stats-play", { rect: playRect, activate: () => this.#playDeck(deck) });
    return footerY - 13;
  }

  // ------------------------------------------------------------------------------------------------------------
  // A community deck's detail rail, in the stats pane's place: whose deck it is and where it comes from (it is a
  // MarvelCDB author's deck, not an official precon), that this game tested it, when it was published and its version,
  // the author's own notes (how they play it), the MarvelCDB link, and one action: add an editable copy.
  // ------------------------------------------------------------------------------------------------------------
  #drawCommunityPane(b: SheetBuilder, rect: Rect, offer: CommunityOffer, wide: boolean): void {
    // The ink panel is drawn in the canvas too (under the panel), so the pane never shows the paper through a seam.
    const bg = this.add.graphics();
    paintPanel(bg, rect, "onInk", "rest");
    b.box(rect, { fill: surface.ink.hex });

    const { entry, option } = offer;
    const left = rect.x + 16;
    const column = rect.width - 32;
    let y = rect.y + 16;

    const small = (text: string, at: number, alpha: number = ink.label): void => {
      b.text(left, at, text.toUpperCase(), typeRole.label, { color: surface.paper.hex, alpha, fitWidth: column - 72 });
    };
    small(t("decks.community.from"), y);
    y += 18;
    // A very long name keeps to three lines, cut only at the extreme.
    const name = b.text(left, y, entry.name.toUpperCase(), typeRole.barTitle, {
      size: 24,
      color: surface.paper.hex,
      wrapWidth: column,
      maxLines: 3,
    });
    y += name.height + 4;
    const credit = b.text(left, y, communityCredit(entry), typeRole.rowTitle, {
      color: surface.paper.hex,
      wrapWidth: column,
    });
    y += credit.height + 8;

    // Aspect stamps, then what this game can say about the deck: Tested, or what keeps it from being offered.
    const stats = deckStatsOf(option.deck, currentPool());
    const statusText = communityStatusText(offer);
    const chips: { readonly text: string; readonly fill: number; readonly ink: number }[] = [
      ...entry.aspects.map((aspect) => {
        const stamp = aspectStampOf(aspect, artLanguageNow());
        return { text: stamp.label, fill: stamp.fill, ink: stamp.ink };
      }),
      offer.lock || !option.legal
        ? { text: statusText, fill: accent.heroRed.hex, ink: surface.paper.hex }
        : { text: `✓ ${statusText}`, fill: surface.paper.hex, ink: surface.ink.hex },
    ];
    let chipX = left;
    const chipHeight = 22;
    for (const chip of chips) {
      const chipWidth = Math.ceil(b.measure(caseOf(STAMP_CHIP_TYPE, chip.text), STAMP_CHIP_TYPE).width) + 16;
      if (chipX > left && chipX + chipWidth > left + column) {
        chipX = left;
        y += chipHeight + 6;
      }
      b.box(
        { x: chipX, y, width: chipWidth, height: chipHeight },
        {
          fill: chip.fill,
          stroke: surface.paper.hex,
          strokeWidth: border.control,
        },
      );
      b.text(chipX + chipWidth / 2, y + chipHeight / 2, chip.text, STAMP_CHIP_TYPE, {
        color: chip.ink,
        origin: [0.5, 0.5],
      });
      chipX += chipWidth + 6;
    }
    y += chipHeight + 10;

    const published = communityPublishedText(entry);
    const meta = b.text(
      left,
      y,
      [
        option.identityName ?? entry.heroName,
        deckCountText(stats),
        ...(published ? [published] : []),
        t("decks.community.notOfficial"),
      ]
        .join(" · ")
        .toUpperCase(),
      typeRole.label,
      { color: surface.paper.hex, alpha: ink.label, wrapWidth: column },
    );
    y += meta.height + 8;

    if (offer.lock || !option.legal) {
      const why = b.text(
        left,
        y,
        offer.lock ?? (option.checking ? t("room.picker.checking") : deckReasonText(option.blockedReason)) ?? "",
        typeRole.body,
        { color: accent.heroRed.hex, wrapWidth: column },
      );
      y += why.height + 8;
    }
    b.box({ x: left, y, width: column, height: 3 }, { fill: surface.paper.hex });
    y += 14;

    // Bottom-up: the footer (Check + Add), then the link row above it; the notes take whatever is left between.
    const footerHeight = hit.primary;
    const footerY = rect.y + rect.height - footerHeight - 16;
    b.box({ x: left, y: footerY - 13, width: column, height: 3 }, { fill: surface.paper.hex });

    const deck = option.deck;
    const checkWidth = column * 0.3;
    const checkRect: Rect = { x: left, y: footerY, width: checkWidth, height: footerHeight };
    const doCheck = (): void => this.#openDeckCheck(deck);
    b.button({
      key: "stats-check",
      rect: checkRect,
      label: t("decks.stats.check"),
      look: "onInk",
      type: typeRole.label,
    });
    this.#actions.set("stats-check", doCheck);
    this.#stops.set("stats-check", { rect: checkRect, activate: doCheck });

    const addRect: Rect = {
      x: left + checkWidth + CHIP_GAP,
      y: footerY,
      width: column - checkWidth - CHIP_GAP,
      height: footerHeight,
    };
    const canAdd = offer.lock === null && option.legal;
    const doAdd = (): void => {
      if (canAdd) this.#addCommunityDeck(offer);
    };
    b.button({
      key: "stats-add",
      rect: addRect,
      label: offer.added ? t("decks.community.addAnother") : t("decks.community.add"),
      look: "primary",
      type: typeRole.barTitle,
      ...(canAdd
        ? {}
        : {
            disabled:
              offer.lock ??
              (option.checking ? t("room.picker.checking") : deckReasonText(option.blockedReason)) ??
              t("decks.stats.notLegal"),
          }),
    });
    this.#actions.set("stats-add", doAdd);
    this.#stops.set("stats-add", { rect: addRect, activate: doAdd });

    // The MarvelCDB link, as text and as buttons: Copy link puts it on the clipboard, the other opens it outside the game.
    const linkDefs: { readonly id: string; readonly text: string; readonly onClick: () => void }[] = [
      ...(wide ? [] : [{ id: "preview", text: t("decks.community.preview"), onClick: () => this.#setTab("cards") }]),
      { id: "copy-link", text: t("decks.community.copyLink"), onClick: () => this.#copyLink(offer) },
      { id: "open-link", text: "MarvelCDB ↗", onClick: () => openExternal(entry.url) },
    ];
    const linkRowY = footerY - 13 - 12 - this.#row;
    const linkWidth = (column - CHIP_GAP * (linkDefs.length - 1)) / linkDefs.length;
    linkDefs.forEach((def, index) => {
      const cell: Rect = { x: left + index * (linkWidth + CHIP_GAP), y: linkRowY, width: linkWidth, height: this.#row };
      b.button({ key: `stats-${def.id}`, rect: cell, label: def.text, look: "quiet", type: typeRole.label });
      this.#actions.set(`stats-${def.id}`, def.onClick);
      this.#stops.set(`stats-${def.id}`, { rect: cell, activate: def.onClick });
    });
    b.text(left, linkRowY - 22, entry.url.replace(/^https:\/\//, ""), typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.secondary,
      fitWidth: column,
    });

    // The author's own write-up: how they play the deck. A long one scrolls natively.
    const notesHeadingY = y;
    const notesY = y + 18;
    const notesHeight = Math.max(0, linkRowY - 22 - 10 - notesY);
    const paragraphs = communityNotesOf(entry.description);
    const notes = paragraphs.join("\n\n");
    const noteStyle = { color: surface.paper.hex, alpha: ink.secondary, wrapWidth: column - 8 } as const;
    const total =
      paragraphs.length === 0 ? 0 : Math.ceil(b.measure(notes, typeRole.body, { wrapWidth: column - 8 }).height) + 4;
    const scrolls = paragraphs.length > 0 && notesHeight >= NOTES_LINE_HEIGHT * 2 && total > notesHeight;
    // A write-up longer than its pane scrolls; the cue sits at the heading's right edge so nothing reads as cut, and the
    // heading gives it room by shrinking, never by being cut ("HOW IT P…").
    const cue = t("decks.community.scroll").toUpperCase();
    const cueWidth = scrolls ? b.measure(cue, typeRole.label).width + 10 : 0;
    b.text(left, notesHeadingY, t("decks.community.notesHeading").toUpperCase(), typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
      fitWidth: column - cueWidth,
    });
    y = notesY;
    if (paragraphs.length === 0) {
      b.text(left, y, t("decks.community.noNotes"), typeRole.body, {
        color: surface.paper.hex,
        alpha: ink.meta,
        wrapWidth: column,
      });
      return;
    }
    if (notesHeight < NOTES_LINE_HEIGHT * 2) return;
    if (scrolls) {
      b.text(left + column, notesHeadingY, cue, typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.body,
        origin: [1, 0],
      });
    }
    b.scroll("community-notes", { x: left, y, width: column, height: notesHeight }, total, (inner) => {
      inner.text(left, 0, notes, typeRole.body, noteStyle);
    });
  }

  /** Adds the player's own editable copy of a community deck and selects it. */
  #addCommunityDeck(offer: CommunityOffer): void {
    if (this.#busy) return;
    this.#busy = true;
    void (async () => {
      const copy = addCommunityDeck(offer.entry, {
        poolVersion: POOL_VERSION,
        now: () => new Date().toISOString(),
        newId: () => crypto.randomUUID(),
        existingNames: this.#savedDecks.map((deck) => deck.name),
      });
      await deckStorage().put(copy);
      this.#savedDecks = await deckStorage().list();
      this.#selectedDeckId = copy.id as string;
      this.#scrollToDeckId = copy.id as string;
      this.#setList(null);
      this.#status = {
        text: t("decks.community.added", { name: copy.name, credit: communityCredit(offer.entry) }),
        tone: "success",
      };
      this.#busy = false;
      this.#rebuild();
    })();
  }

  #copyLink(offer: CommunityOffer): void {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    const done = (text: string, tone: "success" | "error"): void => {
      this.#status = { text, tone };
      this.#rebuild();
    };
    if (!clipboard?.writeText) {
      done(t("decks.community.noClipboard", { url: offer.entry.url }), "error");
      return;
    }
    clipboard.writeText(offer.entry.url).then(
      () => done(t("decks.community.copied", { name: offer.entry.name }), "success"),
      () => done(t("decks.community.copyFailed", { url: offer.entry.url }), "error"),
    );
  }

  /**
   * The resource curve, D14's own way (point 5): every bar is paper-colored except the deck's most-common
   * printed costs, which are Hero Red — `#s14`'s own chart colors costs 1 and 2 red where they're the two tallest
   * bars, everything else cream. Ties are included (every bar at either of the top two *count* values is
   * highlighted, not just the single tallest), and a bar with no cards at that cost is never highlighted even if
   * zero happens to be tied for a "top" value in an otherwise-empty curve.
   */
  #drawStatCurveBars(
    b: SheetBuilder,
    left: number,
    y: number,
    column: number,
    chartHeight: number,
    bars: readonly CostCurveBar[],
  ): void {
    const gap = 6;
    const barWidth = (column - gap * (bars.length - 1)) / bars.length;
    const maxCount = Math.max(1, ...bars.map((bar) => bar.count));
    const topCounts = new Set(
      [...new Set(bars.map((bar) => bar.count))]
        .filter((count) => count > 0)
        .sort((a, b) => b - a)
        .slice(0, 2),
    );
    bars.forEach((bar, index) => {
      const barHeight = Math.max(2, Math.round((bar.count / maxCount) * (chartHeight - 18)));
      const x = left + index * (barWidth + gap);
      const highlighted = topCounts.has(bar.count);
      b.box(
        { x, y: y + (chartHeight - 18 - barHeight), width: barWidth, height: barHeight },
        { fill: highlighted ? accent.heroRed.hex : surface.paperOnInk.hex },
      );
      b.text(x + barWidth / 2, y + chartHeight - 10, bar.label, typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.label,
        origin: [0.5, 0],
      });
    });
  }

  /** Composition tiles D14's own way: a small uppercase label over a Bangers number, three per row. Returns the next free `y`. */
  #drawStatTiles(
    b: SheetBuilder,
    left: number,
    y: number,
    column: number,
    tiles: readonly CompositionTile[],
    cellHeight = 46,
  ): number {
    const perRow = 3;
    const gap = 7;
    const cellWidth = (column - (perRow - 1) * gap) / perRow;
    tiles.forEach((tile, index) => {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const tileX = left + col * (cellWidth + gap);
      const tileY = y + row * (cellHeight + gap);
      b.box(
        { x: tileX, y: tileY, width: cellWidth, height: cellHeight },
        { stroke: surface.paper.hex, strokeWidth: border.control },
      );
      b.text(tileX + 8, tileY + 7, tile.label, typeRole.label, { color: surface.paper.hex, alpha: ink.label });
      b.text(tileX + 8, tileY + 18, String(tile.count), typeRole.barTitle, { size: 20, color: surface.paper.hex });
    });
    const rows = Math.ceil(tiles.length / perRow);
    return rows === 0 ? y : y + rows * (cellHeight + gap) - gap;
  }

  /** "Play this deck ▸" (W9): hands the deck to the existing setup flow with it preselected for seat 1 (`view/setup-draft.ts`'s `withSeatOne`, applied inside `TitleScene#create` — see `scenes/title.ts`'s `TitleSceneData`). */
  #playDeck(deck: Deck): void {
    goToScreen(this, SCENES.title, {
      initialSeatDeckId: deck.id as string,
      initialSeatDeck: deck,
    } satisfies TitleSceneData);
  }

  /**
   * A deck's options sheet (#958), for the layouts that show one pane at a time: the stats rail's and community rail's
   * own actions, plus the two panes the tab strip hides. Each press runs the code those rails' buttons run.
   */
  #openDeckActions(deckId: string): void {
    if (this.scene.isActive(SCENES.deckActions)) return;
    // Read after the select's rebuild, which checked this deck at once: the row's own option may still be "Checking…".
    const now = this.#deckActionsFor(deckId);
    if (!now) return;
    const { option } = now;
    const deck = option.deck;
    const art = this.#deckArtOf(deck.identityCardId as string);
    const onAction = (id: DeckActionId): void => {
      if (!this.sys.isActive()) return;
      switch (id) {
        case "play": {
          const latest = this.#deckActionsFor(deckId)?.option;
          if (latest?.seatable) this.#playDeck(latest.deck);
          return;
        }
        case "add": {
          const latest = this.#deckActionsFor(deckId)?.offer;
          if (latest && latest.lock === null && latest.option.legal) this.#addCommunityDeck(latest);
          return;
        }
        case "edit":
          return goToScreen(this, SCENES.deckBuilder, { deck } satisfies DeckBuilderSceneData);
        case "cards":
          return this.#setTab("cards");
        case "stats":
          return this.#setTab("stats");
        case "check":
          return this.#openDeckCheck(deck);
        case "duplicate":
          return this.#duplicate(deck);
        case "delete":
          void this.#delete(deck.id);
          return;
      }
    };
    this.scene.launch(SCENES.deckActions, {
      from: this.scene.key,
      identityCardId: deck.identityCardId as string,
      artUrl: art.url,
      ...(art.focus ? { artFocus: art.focus } : {}),
      // Read on every draw of the sheet: a status the worker sends, or an unlock, while it is up shows at once.
      current: () => {
        const latest = this.#deckActionsFor(deckId);
        if (!latest) return null;
        const status = deckStatusOf(latest.option);
        return {
          title: cardTitleOf(latest.option),
          meta:
            (latest.offer
              ? communityMetaCandidates(latest.offer)
              : deckMetaCandidates(latest.option, currentPool())
            )[0] ?? "",
          status: {
            text: latest.offer ? communityStatusText(latest.offer) : status.text,
            problem: latest.offer ? latest.offer.lock !== null || !latest.option.legal : status.tone === "illegal",
          },
          actions: {
            option: latest.option,
            ...(latest.offer ? { community: { lock: latest.offer.lock, added: latest.offer.added } } : {}),
          },
        };
      },
      onAction,
    } satisfies DeckActionsSheetData);
  }

  /** A listed deck's current option (and its community offer, for one), by id; null once it is gone. */
  #deckActionsFor(deckId: string): { readonly option: DeckOption; readonly offer?: CommunityOffer } | null {
    const offer = this.#communityOffers().find((o) => (o.option.deck.id as string) === deckId);
    if (offer) return { option: offer.option, offer };
    const option = this.#deckOptions().find((o) => (o.deck.id as string) === deckId);
    return option ? { option } : null;
  }

  /** Opens Deck check (W1) over this deck, returning here on Back. */
  #openDeckCheck(deck: Deck): void {
    // Back lands on this deck again, selected, wherever it sits in the list.
    const returnTo = { scene: SCENES.decks, data: { focusDeckId: deck.id as string } satisfies DecksSceneData };
    goToScreen(this, SCENES.deckCheck, { deck, returnTo } satisfies DeckCheckSceneData);
  }

  #duplicate(deck: Deck): void {
    if (this.#busy) return;
    this.#busy = true;
    void (async () => {
      const now = new Date().toISOString();
      const copy = duplicateDeck(
        deck,
        crypto.randomUUID(),
        now,
        this.#savedDecks.map((saved) => saved.name),
      );
      await deckStorage().put(copy);
      this.#savedDecks = await deckStorage().list();
      this.#selectedDeckId = copy.id as string;
      // Saved decks list after every precon: bring the copy into view, as an import does, on a list that holds it
      // (Preconstructed alone would hide it).
      this.#scrollToDeckId = copy.id as string;
      this.#setList(null);
      this.#status = { text: `Duplicated as "${copy.name}".`, tone: "success" };
      this.#busy = false;
      this.#rebuild();
    })();
  }

  #exportToClipboard(deck: Deck): void {
    const text = exportDecklistText(deck, currentPool());
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      this.#status = {
        text: "Clipboard access isn't available here — open this deck in the builder to read its cards instead.",
        tone: "error",
      };
      this.#rebuild();
      return;
    }
    clipboard.writeText(text).then(
      () => {
        this.#status = { text: `Copied "${deck.name}"'s decklist to the clipboard.`, tone: "success" };
        this.#rebuild();
      },
      () => {
        this.#status = { text: "Couldn't copy to the clipboard.", tone: "error" };
        this.#rebuild();
      },
    );
  }

  #inspectDeck(option: DeckOption): void {
    const card = currentCardsById().get(option.deck.identityCardId as string);
    const face =
      card?.type === "villain"
        ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const)
        : ({ kind: "hero" } as const);
    const note =
      (option.checking ? t("room.picker.checking") : deckReasonText(option.blockedReason)) ?? option.warning ?? null;
    this.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId, face },
      ...(note ? { note } : {}),
    });
  }

  async #delete(id: DeckId): Promise<void> {
    this.#status = null;
    await deckStorage().remove(id);
    this.#savedDecks = await deckStorage().list();
    this.#rebuild();
  }

  async #importPaste(): Promise<void> {
    await this.#runImport(async () => {
      await this.#applyImport(importFromPasteText(this.#pasteText, this.#importEnv()));
    });
  }

  async #importMarvelCdb(): Promise<void> {
    await this.#runImport(async () => {
      // The same flow the room deck picker uses (`platform/marvelcdb-import.ts`).
      const result = await importMarvelCdbDeck(this.#marvelcdbText, this.#importEnv());
      if (!result.ok) {
        this.#status = { text: result.message, tone: "error" };
        return;
      }
      await this.#applyImport({ ok: true, deck: result.deck, warnings: result.warnings });
    });
  }

  /**
   * One import at a time, busy until the deck is saved and the list reloaded (the rule the room deck picker's
   * `view/import-flight.ts` keeps): a second press or Enter during a slow write is refused, and a failed write shows its error and frees
   * the screen instead of leaving Import stuck on "Importing…".
   */
  async #runImport(job: () => Promise<void>): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    this.#rebuild();
    try {
      await job();
    } catch (cause) {
      this.#status = { text: cause instanceof Error ? cause.message : String(cause), tone: "error" };
    } finally {
      this.#busy = false;
      this.#rebuild();
    }
  }

  #importEnv(): ImportEnv {
    return {
      pool: currentPool(),
      poolVersion: POOL_VERSION,
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
      existingNames: this.#savedDecks.map((deck) => deck.name),
    };
  }

  async #applyImport(outcome: ImportOutcome): Promise<void> {
    if (!outcome.ok) {
      this.#status = { text: outcome.problems.map((problem) => problem.message).join(" "), tone: "error" };
      return;
    }
    await deckStorage().put(outcome.deck);
    this.#pasteText = "";
    this.#marvelcdbText = "";
    // Unreadable pasted lines are skipped but never silently: each is named by line number under the success line.
    this.#status = { text: importedDeckNote(outcome.deck.name, outcome.warnings), tone: "success" };
    this.#savedDecks = await deckStorage().list();
    this.#selectedDeckId = outcome.deck.id as string;
    this.#scrollToDeckId = outcome.deck.id as string;
  }
}

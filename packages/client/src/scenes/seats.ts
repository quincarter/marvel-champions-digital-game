/**
 * Take your seats (docs/phase4-screen-gaps.md §3 W2/W2b, D03/P03/T-P02): four
 * selectable seat cards over an **active-seat model** — clicking a seat makes
 * it active, and the pack-shelf hero roster (S8, the owner's pack-shelves
 * decision, drill-in per the owner's second-pass ask) picks a hero *for the
 * active seat* (`view/setup-draft.ts`'s `setActiveSeat`/`assignToActiveSeat`)
 * — a hero detail panel (obligation, nemesis), a small "Use preconstructed
 * for all seats" on the roster's own header line, "Play N heroes ▸" straight
 * to Table setup, and "Deck check ▸" into W1's Deck check for the *active*
 * seat's own deck (Back returns here, "Start game ▸" continues to Table
 * setup).
 *
 * **The bug this rebuild fixes:** the previous version hardcoded seat 1 both
 * in what the roster clicked into and in what "Deck check ▸" opened. Every
 * seat is now a real, independently selectable and deck-checkable target —
 * including *replacing* an already-seated hero once the table is full, which
 * needed `seatOptions` to be asked "if I removed the active seat, would this
 * be legal?" (`#seatOptionsExcludingActive`) rather than "is this legal to
 * add as a fifth seat?", which always said no once four seats were filled.
 *
 * **The screen is Lit panels over the canvas** (`dom/dom-region.ts`), each its own region, in this order: the fixed parts
 * (an `mc-sheet`: the header bar, the seat cards, the Team-Up bracket, the controls, the search field, the filter chips,
 * the hero detail panel and the footer, `dom/seats-panels.ts`), the hero roster (`mc-shelf-roster`: the shelves of hero
 * tiles, or one pack's full grid), the detail panel's insights block and, only while an aspect tip is open, the tip. The
 * scene keeps what is a decision: the draft, the roster's legality (asked of the engine's seat options, never worked out
 * here), the search worker, the focus route (its ring drawn in the panel layer), the card hover popover and navigation.
 * The tiles show the tile copy of each hero's picture (`dom/hero-picture.ts`), never the full-size one, and load it
 * lazily; the roster scrolls natively and every control in it is a tap, so a swipe's lift presses nothing (issue #227).
 */
import "@mc/ui";
import type {
  FilterChip,
  McSearchField,
  McSheet,
  McShelfRoster,
  ShelfRosterItem,
  ShelfRosterHint,
  ShelfRosterShelf,
} from "@mc/ui";
import { layoutGlyph, measureGlyphText } from "@mc/ui/glyph";
import Phaser from "phaser";
import type { AnyCard, CardId, CoreAspect, Deck } from "@mc/content";
import { artFor, artLanguageNow } from "../art/art-source.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import { PackLeases, packPictureFor, refreshPackArt } from "../art/pack-art.js";
import type { Picture } from "../art/pictures.js";
import type { PromoSet } from "../art/promo-art.js";
import {
  POOL_ENCOUNTER_SETS,
  POOL_VERSION,
  currentCardsById,
  currentDeps,
  currentHeroShelfPacks,
  currentPool,
  currentPoolKey,
  packNameOf,
} from "../content/pool.js";
import { TIP_LINK_KEY, drawAspectTip, tipLayoutOf, tipPlacement, tipWidthFor } from "../dom/aspect-tip-sheet.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { heroTilePictureOf } from "../dom/hero-picture.js";
import { drawDetailPanel, drawPairStrip, drawSeatCard, drawSeatChip, drawSeatSummary } from "../dom/seats-panels.js";
import { SheetBuilder, sheetColor } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { listAnd, t, tPlural } from "../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { inputDevice, padInputTracked } from "../platform/input-device.js";
import { earnedPromoSets, refreshUnlocks, unlocks } from "../progression/progression.js";
import { appSession, deckStorage } from "../session.js";
import { tableRulesOf, type HeroArt } from "../settings.js";
import { dotGrid, font, hit, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { deckDisplayName, identityLabelOf } from "../view/deck-names.js";
import { aspectStampOf, aspectStampsOf, titleWithoutAspects } from "../view/aspect-stamp.js";
import { aspectTipContentOf } from "../view/aspect-tip-model.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { packCompactChipsToRows, type ChipInfoToggle } from "../view/chip-layout.js";
import { sheetThemeFor } from "../ui/campaign-chrome.js";
import { formatCount } from "../view/number-format.js";
import {
  isCommunityDeckId,
  testedDeckLockOf,
  testedEntryOf,
  testedSearchFieldsOf,
  testedSubtitleOf,
} from "../view/community-decks-model.js";
import { customBadge, customBadgeOf, isCustomCard } from "../view/custom-content.js";
import { shortWarningOf, type DeckOption } from "../view/deck-list-model.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { rankShelvesByScore, type SearchDocument } from "../view/deck-search.js";
import { blockedTagOf, reasonLabelOf } from "../view/deck-status.js";
import { filtersLabel } from "../view/filters-layout.js";
import { AreaJump, areaOf, type FocusAreas } from "../view/focus-areas.js";
import { scaledGlyphHeight } from "../view/glyph-placement.js";
import { uiSpecOf } from "../view/glyph-ui-spec.js";
import {
  HERO_ART_KEYS,
  heroArtInForce,
  heroPromoShown,
  heroTilePicture,
  nextHeroArt,
} from "../view/hero-art-choice.js";
import {
  deckCountTagOf,
  groupShelvesByHero,
  heroDeckRowOf,
  heroGroupKeyOf,
  heroPacksOf,
  type HeroDeckGroup,
} from "../view/hero-deck-groups.js";
import {
  heroPassesChips,
  randomHeroCandidatesOf,
  randomHeroDeck,
  searchPending,
  takeableHeroesOf,
  type RandomHeroCandidate,
} from "../view/hero-random.js";
import { layerTriggerGlyph } from "../view/input-glyph-model.js";
import { glyphSetOf } from "../view/input-mode.js";
import type { ShortcutId } from "../view/input-shortcuts.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import {
  applyDeckSwaps,
  conflictNoticeOf,
  nameConflictsOf,
  unresolvedConflicts,
  type NameConflict,
} from "../view/name-conflicts.js";
import { heroAspectsOf, withSelectionPinned, type HeroSourceFilter } from "../view/roster-filter.js";
import {
  azShelvesOf,
  cycleShelvesOf,
  withTestedShelf,
  type Shelf,
  type ShelfCandidate,
} from "../view/roster-shelves.js";
import { seatsFocusOrder } from "../view/screen-focus.js";
import { loadRecommendedCollapsed, recommendedStartsCollapsed, saveRecommendedCollapsed } from "../view/seat-prefs.js";
import { pairCatalogOf, seatInsightsOf, type PairCatalog, type SeatInsights } from "../view/seat-recommendations.js";
import { seatSearchWordsOf } from "../view/seat-search.js";
import {
  activeSeatRosterOf,
  aspectLabelOf,
  heroCandidateDetailOf,
  seatSlotsOf,
  type ActiveSeatRosterEntry,
} from "../view/seat-slots.js";
import { seatToClear, steppedSeatIndex } from "../view/seat-step.js";
import { seatableDeckOptionsOf, testedCatalog } from "../view/seatable-decks.js";
import { seatOptions, type SeatOption } from "../view/seats.js";
import {
  CLEAR_SEAT_WIDTH,
  MAX_SEATS,
  PAIR_ROW_HEIGHT,
  detailPanelWidthFor,
  rosterColumnWidthFor,
  seatsLayout,
  type SeatsLayout,
} from "../view/seats-layout.js";
import { heroCardModelOf, seatFrameOf, seatLabelOf } from "../view/seats-panel-model.js";
import {
  assignToActiveSeat,
  clearHeroFilter,
  clearSeat,
  deckCheckDeckId,
  pruneSeats,
  seatDetailSubject,
  seatIsSelectable,
  setActiveSeat,
  setHeroFilter,
  setHeroSortMode,
  usePreconstructedForAllSeats,
  type HeroSortMode,
  type SetupDraft,
} from "../view/setup-draft.js";
import { ALL_PACKS, drillIntoPack, drillOut, type ShelfDrillState } from "../view/shelf-drill.js";
import {
  foldShelves,
  loadShelfFolds,
  openShelfItems,
  saveShelfFolds,
  shelfFocusKeys,
  toggleShelfFold,
} from "../view/shelf-folds.js";
import type { AspectLessonSceneData } from "./aspect-lesson.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import { bindExtraInput } from "./extra-input.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { HeroDecksSheetData } from "./hero-decks-sheet.js";
import { SCENES } from "./keys.js";
import { openNameConflictSheet } from "./name-conflict.js";
import { PadFilters } from "./pad-filters.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { TableSetupData } from "./table-setup.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { unlockCostOf, unlockOrAsk } from "./unlock-confirm.js";

export interface SeatsData {
  readonly draft: SetupDraft;
  /** Decks to list before `deckStorage().list()` resolves — "Play this deck ▸" (W9) seeds the one it seats. */
  readonly seedDecks?: readonly Deck[];
  /** Open the "Cards that can't be played" sheet on arrival (Deck check's Start game with a clash still open). */
  readonly promptConflicts?: boolean;
  /** Back returns to the Civil War builder (the draft came from it) rather than to Scenario select. */
  readonly backTo?: "civil-war-builder";
}

/** One quick-filter chip: an aspect (tinted with the aspect's own stamp color), a deck source, or "Playable now". */
interface HeroChipDef {
  readonly id: string;
  readonly text: string;
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly tint?: { readonly fill: number; readonly ink: number };
  /** An aspect chip's G10b tip, drawn as the chip's split "i" segment (`view/chip-layout.ts`'s `ChipInfoToggle`). */
  readonly info?: ChipInfoToggle;
}

/** `{ info }` when there is one — spread into a chip def, which may not carry an explicit `info: undefined`. */
function withInfo(info: ChipInfoToggle | undefined): { readonly info?: ChipInfoToggle } {
  return info ? { info } : {};
}

/** The focus key of an aspect chip's "i" (the tip), by aspect. */
const infoStopKey = (aspect: string): string => `hero-chip-info:${aspect}`;
/** The stops that are the filters (search, the chips and their "i"), and the ones that are the list. */
const FILTER_STOP = /^(hero-search-toggle|hero-search|filters-toggle|hero-chip:.*|hero-chip-info:.*)$/;
const LIST_STOP = /^(rec-toggle|drill-back|hero-clear|hero:.*|hero-rec:.*|hero-shelf:.*)$/;
/** The scrollbar's room beside the roster (`SCROLL_GUTTER` in `@mc/ui`). */
const SCROLL_GUTTER = 8;
/** The search field's key in the fixed parts' sheet. */
const SEARCH = "hero-search";
/** The chips' key and the prefix their presses carry. */
const CHIPS = "hero-chips";
const CHIP_PREFIX = "hero-chip:";
/** A chip row's gap, as the Phaser chip strip had it. */
const CHIP_GAP = 6;

/** What shuts a deck to this player: a precon's hero, or a tested community deck's hero or card wave. Null when it may be seated. */
function deckLockOf(deck: Deck): string | null {
  return testedDeckLockOf(deck, testedCatalog(), currentPool(), unlocks()) ?? unlocks().deckLock(deck);
}

/** The pool's Team-Up pairs, derived once: the pool never changes under a running app. */
let pairCatalog: { readonly key: string; readonly catalog: PairCatalog } | null = null;
/** Rebuilt when the loaded packs change, so a pack's team-up cards are known. */
const seatPairCatalog = (): PairCatalog => {
  const key = currentPoolKey();
  if (pairCatalog?.key !== key) pairCatalog = { key, catalog: pairCatalogOf(currentCardsById()) };
  return pairCatalog.catalog;
};

/** "Precon + Tested": the kinds of deck a multi-deck hero tile stands for, each once. */
function sourceWordsOf(options: readonly DeckOption[]): string {
  const word = (option: DeckOption): string =>
    isCommunityDeckId(option.deck.id as string)
      ? t("deckSource.tested")
      : option.deck.source.kind === "precon"
        ? t("deckSource.precon")
        : option.deck.source.kind === "imported"
          ? t("deckSource.imported")
          : t("deckSource.built");
  return [...new Set(options.map(word))].join(", ");
}

/** The Recommended shelf: the first shelf of the roster, at most this many tiles. */
const REC_LIMIT = 6;
/** The Recommended shelf's id among the roster's shelves: always the first, and only while there is someone to recommend. */
const REC_SHELF_ID = "recommended";

/** A blocked reason worded for this screen, or null. */
const reasonOrNull = (reason: string | null): string | null =>
  reason === null ? null : reasonLabelOf(reason, artLanguageNow());

/** "a, b and c". */
const listOf = (words: readonly string[]): string => listAnd(words);

/** The deck id a hero tile's focus stop names (`hero:<id>` or `hero-rec:<id>`), or null for any other stop. */
function deckIdOfStop(key: string): string | null {
  if (key.startsWith("hero-rec:")) return key.slice("hero-rec:".length);
  if (key.startsWith("hero:")) return key.slice("hero:".length);
  return null;
}

/** The detail panel's wrapped-line allowance, as Scenario select's own constants. */
const DETAIL_TEXT_PAD = 24;
/** The hero detail panel's glyph size in the header row and the words after them (px). */
const HINT_HEIGHT = 16;
/** The row-paging trigger glyphs' height (px). */
const PAGE_HINT_HEIGHT = 18;

/** Keys measured in the font `mc-glyph` draws with, to lay a word after a glyph. */
const glyphWidthOf = (node: { readonly specs: Parameters<typeof layoutGlyph>[0]; readonly height: number }): number =>
  layoutGlyph(node.specs, node.height, (label, size) => measureGlyphText(label, size, `"${font.body}", sans-serif`))
    .fullWidth;

/** The seated decks with this game's replacements applied, in seat order (a seat whose deck has gone is skipped). */
function seatedDecksOf(draft: SetupDraft, deckOptions: readonly DeckOption[], swapped: boolean): readonly Deck[] {
  return draft.seats
    .map((deckId) => deckOptions.find((option) => (option.deck.id as string) === deckId)?.deck)
    .filter((deck): deck is Deck => deck !== undefined)
    .map((deck) => (swapped ? applyDeckSwaps(deck, draft.deckSwaps) : deck));
}

/** Every card that cannot be played at this table and has not been answered (replaced or kept as a resource). */
function unresolvedConflictsOf(draft: SetupDraft, deckOptions: readonly DeckOption[]): readonly NameConflict[] {
  const seats = seatedDecksOf(draft, deckOptions, true).map((deck) => ({ deck }));
  return unresolvedConflicts(
    nameConflictsOf(seats, currentCardsById(), tableRulesOf(appSession().settings)),
    draft.keptConflicts,
  );
}

/**
 * "Deck check ▸" opens W1's Deck check over `deckCheckDeckId`'s own pick (docs/phase4-screen-gaps.md §3, second
 * W2b pass item 1 — the owner's bug report that this silently fell through to Table setup whenever the active
 * seat itself was empty, e.g. right after picking for seat 2 auto-advanced to the empty seat 3). It reaches Table
 * setup only when the table genuinely has no seated deck at all, which `pruneSeats`' own fallback never actually
 * allows — kept as a fallback rather than assumed unreachable.
 */
function goToDeckCheckOrTableSetup(scene: Phaser.Scene, draft: SetupDraft, deckOptions: readonly DeckOption[]): void {
  const toTableSetup = (from: Phaser.Scene): void => {
    // A clash still open sends the player back to the seats, where the sheet answers it before the table is dealt.
    if (unresolvedConflictsOf(draft, deckOptions).length > 0) {
      goToScreen(from, SCENES.seats, { draft, promptConflicts: true } satisfies SeatsData);
      return;
    }
    goToScreen(from, SCENES.setup, { draft } satisfies TableSetupData);
  };
  const checkedDeckId = deckCheckDeckId(draft);
  const seated = checkedDeckId ? deckOptions.find((option) => (option.deck.id as string) === checkedDeckId) : undefined;
  if (!seated) {
    toTableSetup(scene);
    return;
  }
  goToScreen(scene, SCENES.deckCheck, {
    deck: seated.deck,
    returnTo: { scene: SCENES.seats, data: { draft } satisfies SeatsData },
    onStartGame: toTableSetup,
  } satisfies DeckCheckSceneData);
}

/** Where the roster was scrolled when the screen was left, so a trip to Deck check and back returns to the same place. */
let rememberedScroll: ReturnType<McShelfRoster["readScroll"]> | null = null;

/** Everything one compose works out, kept so the fixed parts can be drawn again alone (the focus moved, a glyph changed). */
interface Composed {
  readonly width: number;
  readonly height: number;
  readonly layout: SeatsLayout;
  readonly deckOptions: readonly DeckOption[];
  readonly insights: SeatInsights;
  readonly chipDefs: readonly HeroChipDef[];
  readonly folded: boolean;
  readonly padMode: boolean;
  readonly unresolved: readonly NameConflict[];
  readonly tableLock: string | null;
  readonly randomAvailable: boolean;
  readonly detailOption: DeckOption | undefined;
  readonly seating: ReadonlyMap<string, SeatOption>;
  /** The chips' wrapped row count, the one the layout reserved room for. */
  readonly chipRows: number;
  readonly heroArtNow: HeroArt;
  /** The roster's per-deck seating facts and the shelves built from them (a drilled pack's title is read from these). */
  readonly active: ReadonlyMap<string, ActiveSeatRosterEntry>;
  readonly packShelves: readonly Shelf<DeckOption>[];
}

type SeatsRegion<E extends HTMLElement> = DomRegion<E>;

export class SeatsScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #savedDecks: readonly Deck[] = [];
  #stops = new Map<string, FocusStop>();
  /** Narrow only: the active seat's details block is open (`SeatsLayout.detailsToggle`). Shut by default. */
  #detailsOpen = false;
  /** Narrow only: the search field is shown (`SeatsLayout.searchToggle`). Off by default — the roster gets the row. */
  #searchOpen = false;
  #route: FocusRoute | null = null;
  /** The key and pad glyphs of the fixed parts (Back, the header row's LB / RB / X / Y, Filters, Play); drawn only while a keyboard or pad is in use. */
  #glyphs!: SheetGlyphs;
  /** The chips fold away while a controller is in use (`view/pad-filters.ts`). */
  #padFilters!: PadFilters;
  /** Each hero tile's shelf, by focus key, for LT / RT. */
  readonly #shelfOfKey = new Map<string, string>();
  /** Whether the last compose folded the chips, so Y knows whether it opens or folds them. */
  #chipsFolded = false;
  /** The rows the chip bar really wrapped to (the browser lays them out), by screen size: the estimate only starts the layout. */
  readonly #chipRowsSeen = new Map<string, number>();
  /** The filters and the list as two areas of the route, for Y and B (`view/focus-areas.ts`). */
  readonly #areaJump = new AreaJump();
  #areas: FocusAreas = { filters: [], entry: null, list: [] };
  /** The word the last compose put after the Y glyph (Filters, List or Inspect), to know when it changes with focus. */
  #yWordShown = "";
  #drill: ShelfDrillState = ALL_PACKS;
  /** Which aspect chip's inline tip (G10b) is open, if any — a plain field, like every other stateful control here; a compose redraws whichever panel that implies. */
  #aspectTipOpen: CoreAspect | null = null;
  /** A screen change is under way (Back, Play, Deck check): later presses do nothing. */
  #leaving = false;
  #alive = false;
  #insights: SeatInsights | null = null;
  /** `null` until the player chooses; then remembered across visits (`view/seat-prefs.ts`). */
  #recCollapsed: boolean | null = loadRecommendedCollapsed();
  /** The pack shelves folded to their header, remembered across visits (#753). */
  #folded: ReadonlySet<string> = loadShelfFolds("seats");
  /** The deck under the pointer or under keyboard focus, whose reason the detail panel spells out. */
  #hoverDeckId: string | null = null;
  #focusDeckId: string | null = null;
  /** The focus key of the topmost hero tile as of the last compose, where focus starts on arrival. */
  #firstTileKey: string | null = null;
  /** Each hero shown, with the decks that pass the filters (`view/hero-deck-groups.ts`); rebuilt with the shelves. */
  #heroGroups: ReadonlyMap<string, HeroDeckGroup<DeckOption>> = new Map();
  /** The desktop card hover popover over the hero tiles (`ui/card-hover-preview.ts`). */
  #hover: HoverPreview | null = null;
  /** Each deck's hero identity card, for the hover popover's picture. */
  #identityOfDeck = new Map<string, string>();
  /** Text search runs in a worker (view/deck-search-client.ts); #ranking is its last answer, shown until the next one arrives. Null when no search is active. */
  readonly #search = new DeckSearchClient();
  #ranking: ReadonlyMap<string, number> | null = null;
  /** The search text #ranking answers; Random waits while the field holds another (`searchPending`, #916 review). */
  #rankedFor: string | null = null;
  #searchDocsFor: readonly DeckOption[] | null = null;

  /** The fixed parts: one Lit sheet over the canvas, made once a visit. */
  #chromeRegion: SeatsRegion<McSheet> | null = null;
  /** The hero roster (shelves, or one pack's grid), over the fixed parts' ground. */
  #rosterRegion: SeatsRegion<McShelfRoster> | null = null;
  /** The detail panel's lower block: Team-Up pairs in full and why the hero in hover or focus is recommended. */
  #insightRegion: SeatsRegion<McSheet> | null = null;
  /** The aspect tip, above all, made on opening and dropped on closing. */
  #tipRegion: SeatsRegion<McSheet> | null = null;
  /** The pack pictures' blob URLs the panels show, held while their lazy images may still load them. */
  readonly #leases = new PackLeases();
  /** What each key in the panels does when tapped (and held, for a hero tile's Inspect), this compose. */
  #actions = new Map<string, () => void>();
  #inspects = new Map<string, () => void>();
  /** The roster's box on screen, and the insights block's: what a hover rect and a focus ring are clipped to. */
  #rosterView: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #insightArea: Rect | null = null;
  #composed: Composed | null = null;
  /** Where the pointer was pressed, for a tap elsewhere that shuts the open tip (and not a swipe's lift). */
  #pressAt: { readonly x: number; readonly y: number } | null = null;

  constructor() {
    super(SCENES.seats);
  }

  #seedDecks: readonly Deck[] = [];
  readonly #heroArtCache = new Map<string, Picture | null>();
  /** The hero tiles' art choice, read once a compose: every tile asks. */
  #tileArt: { readonly choice: HeroArt; readonly earned: readonly PromoSet[] } = { choice: "game", earned: [] };

  /** Open the conflict sheet once the saved decks have loaded (`SeatsData.promptConflicts`). */
  #promptOnOpen = false;

  #backTo: SeatsData["backTo"] | null = null;

  init(data: SeatsData): void {
    this.#promptOnOpen = data.promptConflicts ?? false;
    this.#draft = data.draft;
    this.#backTo = data.backTo ?? null;
    this.#seedDecks = data.seedDecks ?? [];
    this.#chromeRegion = null;
    this.#rosterRegion = null;
    this.#insightRegion = null;
    this.#tipRegion = null;
    this.#composed = null;
  }

  create(): void {
    // Phaser reuses this scene: nothing from the last visit carries over.
    this.#leaving = false;
    this.#alive = true;
    this.#aspectTipOpen = null;
    this.#hoverDeckId = null;
    this.#focusDeckId = null;
    this.#yWordShown = "";
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    this.scale.on("resize", this.#rebuild, this);
    rebuildOnPackChange(this, () => this.#rebuild());
    // A hero picture or scan that resolves later (a pack's, the scan's) draws in place of the plain ground; a language
    // switch (#390) reads the screen again in the new language.
    const artOff = onArtChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    const languageOff = onLanguageChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      languageOff();
      // Where the roster was scrolled, for the way back from Deck check; the panels go with the scene (`DomRegion`).
      if (this.#rosterRegion) rememberedScroll = this.#rosterRegion.element.readScroll();
      this.#chromeRegion = null;
      this.#rosterRegion = null;
      this.#insightRegion = null;
      this.#tipRegion = null;
      this.#hover?.destroy();
      this.#hover = null;
      this.#search.destroy();
      this.#glyphs.dispose();
      this.#leases.dispose();
      window.removeEventListener("pointerdown", this.#onWindowDown, true);
      window.removeEventListener("pointerup", this.#onWindowUp, true);
      window.removeEventListener("pointermove", this.#onWindowMove, true);
    });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#searchFocused() }),
    });
    this.#glyphs = new SheetGlyphs(this, () => {
      this.#remountChrome();
      this.#updateRosterHint();
    });
    this.#padFilters = new PadFilters(this, () => this.#rebuild());
    this.#padFilters.reset();
    // A tap elsewhere shuts an open aspect tip (it opens only on a press of its own "i"); the mouse leaving the "i" and its
    // tip shuts it too. On release, so a swipe keeps its drag, and not over another "i", whose own tap switches the tip.
    window.addEventListener("pointerdown", this.#onWindowDown, true);
    window.addEventListener("pointerup", this.#onWindowUp, true);
    window.addEventListener("pointermove", this.#onWindowMove, true);
    const covered = (): boolean =>
      this.scene.isActive(SCENES.inspect) ||
      this.scene.isActive(SCENES.unlockConfirm) ||
      this.scene.isActive(SCENES.nameConflict) ||
      this.scene.isActive(SCENES.heroDecks) ||
      this.scene.isActive(SCENES.aspectLesson);
    // A pad that put the caret in the search field can take it out again (B, A or Start), bound before the route.
    bindTextFieldEscape(this, () => this.#field(SEARCH), covered);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onFocusChange: (key) => {
        this.#focusDeckId = key === null ? null : deckIdOfStop(key);
        this.#remountInsights();
        // The word after the Y glyph says what Y does where focus is now.
        if (this.#composed && this.#yWordFor(key) !== this.#yWordShown) this.#remountChrome();
        // The LT / RT glyphs belong to the row focus is in.
        this.#updateRosterHint();
        // Focus moving off the open tip's own "i" shuts it.
        if (this.#aspectTipOpen !== null && key !== infoStopKey(this.#aspectTipOpen)) this.#closeAspectTip();
      },
      blocked: () => covered() || this.#searchFocused(),
      onCancel: () => this.#onCancel(),
      // Y is the filters' fold while a controller is in use (the keyboard's Inspect key is unchanged); View inspects.
      onInspect: (source) => {
        if (source === "key" || !this.#padFilters.padMode) return false;
        this.#toggleFilters();
        return true;
      },
      // LT / RT page the focused row, like its ‹ / › chevrons.
      onTrigger: (trigger) => this.#pageRow(trigger === "lt" ? -1 : 1),
      // Start / Menu (and A with nothing focused) goes on to the table.
      primary: () => (this.#stops.has("play") ? "play" : null),
      // LB / RB: the seat being edited; the hero list then fills that seat.
      onTab: (direction) => this.#stepSeat(direction),
      // X: clears the focused (or active) seat, the same as its ✕.
      onToggle: () => this.#clearSeatByPad(),
      // The right stick, PageUp / PageDown and Home / End scroll the hero list.
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) => {
        const scroller = this.#scroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * 0.85 });
      },
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    bindExtraInput(this, {
      blocked: () => covered() || this.#searchFocused(),
      intents: {
        view: () => {
          const key = this.#route?.focused ?? null;
          if (this.#padFilters.padMode && key !== null && /^hero(-rec)?:/.test(key)) this.#route?.inspectFocused();
        },
      },
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
    });
    this.#savedDecks = this.#seedDecks;
    this.#rebuild();
    // Arriving by pad at blank seats, focus is on the topmost hero rather than Back. A mouse or touch player gets no
    // ring (it would read as a preselection), and a return trip (Deck check, Table setup) keeps its own place.
    if (this.#draft.seats.length === 0 && padInputTracked() && this.#firstTileKey !== null)
      this.#route?.focusKey(this.#firstTileKey);
    fadeScreenIn(this);
    void refreshUnlocks().then((changed) => {
      if (changed && this.sys.isActive()) this.#rebuild();
    });
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#savedDecks = decks;
        this.#rebuild();
        if (this.#promptOnOpen) {
          this.#promptOnOpen = false;
          if (unresolvedConflictsOf(this.#draft, this.#deckOptions()).length > 0) this.#openConflictSheet();
        }
      });
  }

  /** The search field of the fixed parts, for its caret and the text typed in it. */
  #field(key: string): McSearchField | null {
    return (this.#chromeRegion?.element.elementOf(key) as McSearchField | null) ?? null;
  }

  #searchFocused(): boolean {
    return this.#field(SEARCH)?.focused ?? false;
  }

  /** The element that scrolls the hero list. */
  #scroller(): HTMLElement | null {
    return this.#rosterRegion?.element.scroller ?? null;
  }

  /**
   * "Cards that can't be played" (`scenes/name-conflict.ts`): every answer goes straight onto the draft, which applies
   * the replacements to this game's decks only (`corePlayerForSeat`); a saved deck is never changed. Continue then does
   * what Play does.
   */
  #openConflictSheet(): void {
    openNameConflictSheet(this, {
      decks: seatedDecksOf(this.#draft, this.#deckOptions(), false),
      swaps: this.#draft.deckSwaps,
      kept: this.#draft.keptConflicts,
      tableRules: tableRulesOf(appSession().settings),
      continueLabel: t("seats.play"),
      onChange: (deckSwaps, keptConflicts) => {
        this.#draft = { ...this.#draft, deckSwaps, keptConflicts };
        this.#rebuild();
      },
      onContinue: () => this.#goToTableSetup(),
    });
  }

  #goToTableSetup(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.setup, { draft: this.#draft } satisfies TableSetupData);
  }

  #back(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#rebuild, this);
    // The seated saved decks go along, so coming back here keeps them seated before the deck list loads (#958).
    const seated = new Set(this.#draft.seats);
    const seeds = this.#savedDecks.filter((deck) => seated.has(deck.id as string));
    const seedDecks = seeds.length > 0 ? { seedDecks: seeds } : {};
    if (this.#backTo === "civil-war-builder") {
      goToScreen(this, SCENES.civilWarBuilder, {
        draft: this.#draft,
        step: 5,
        ...seedDecks,
      } satisfies CivilWarBuilderData);
      return;
    }
    goToScreen(this, SCENES.scenarioSelect, { draft: this.#draft, ...seedDecks } satisfies ScenarioSelectData);
  }

  #drillOut(): void {
    this.#drill = drillOut();
    this.#rebuild();
  }

  /**
   * Every deck's status, validated against the pool once per saved-deck list rather than once per redraw: it was a
   * third of the time a tap on a hero took, re-running `validateDeck` for every precon and saved deck on each
   * rebuild although neither the decks nor the pool had changed. `#savedDecks` is only ever replaced, never edited.
   */
  #deckOptions(): readonly DeckOption[] {
    // Also per pool: an installed pack that finishes loading changes it (`currentPool()`).
    if (this.#deckOptionsFor?.saved !== this.#savedDecks || this.#deckOptionsFor.pool !== currentPool()) {
      this.#deckOptionsFor = {
        saved: this.#savedDecks,
        pool: currentPool(),
        options: seatableDeckOptionsOf(this.#savedDecks, currentPool(), POOL_VERSION, currentDeps()),
      };
    }
    return this.#deckOptionsFor.options;
  }

  #deckOptionsFor: {
    readonly saved: readonly Deck[];
    readonly pool: readonly AnyCard[];
    readonly options: readonly DeckOption[];
  } | null = null;

  /**
   * Legality *as if the active seat were empty* — the fix for "once four seats are filled, no other hero can ever
   * be picked": `seatOptions`'s own "N seats is the maximum" and unique-identity checks are asked against the
   * table with the active seat's own current occupant removed, since picking a new hero for that seat always
   * *replaces* it rather than adding a fifth seat.
   */
  #seatOptionsExcludingActive(deckOptions: readonly DeckOption[]): readonly SeatOption[] {
    const seatsExcludingActive = this.#draft.seats.filter((_, i) => i !== this.#draft.activeSeatIndex);
    // A hero the player hasn't unlocked is shown, dimmed, with what opens it — never hidden.
    return seatOptions(deckOptions, seatsExcludingActive, currentCardsById(), MAX_SEATS).map((option) => {
      if (option.seated) return option;
      const deck = deckOptions.find((candidate) => (candidate.deck.id as string) === option.deckId);
      const lock = deck ? deckLockOf(deck.deck) : null;
      return lock ? { ...option, blockedBy: lock } : option;
    });
  }

  /** Why the table can't be dealt yet: a seated hero that has since been locked again (Settings ▸ Unlocks). */
  #tableLock(deckOptions: readonly DeckOption[]): string | null {
    for (const deckId of this.#draft.seats) {
      const deck = deckOptions.find((candidate) => (candidate.deck.id as string) === deckId);
      const lock = deck ? deckLockOf(deck.deck) : null;
      if (lock) return `${identityLabelOf(deck!) ?? deckDisplayName(deck!.deck)}: ${lock}`;
    }
    return null;
  }

  /** The tap away from an open tip shuts it: where the press began, to tell a swipe's lift from a tap. */
  readonly #onWindowDown = (event: PointerEvent): void => {
    this.#pressAt = { x: event.clientX, y: event.clientY };
  };

  readonly #onWindowUp = (event: PointerEvent): void => {
    if (this.#aspectTipOpen === null) return;
    const down = this.#pressAt;
    this.#pressAt = null;
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10) return;
    // Not over an "i" (its own tap switches the tip in the same press) nor over the tip itself (its link).
    const tip = this.#tipRegion?.element;
    const over = event
      .composedPath()
      .some(
        (node) =>
          node === tip ||
          (node instanceof HTMLElement && node.dataset.key !== undefined && node.dataset.key.endsWith(":info")),
      );
    if (!over) this.#closeAspectTip();
  };

  /** An open tip shuts when the mouse leaves its "i" and the tip (the gap between them is part of the zone). */
  readonly #onWindowMove = (event: PointerEvent): void => {
    if (this.#aspectTipOpen === null || event.pointerType !== "mouse") return;
    const info = this.#chromeRegion?.element.elementOf(`${CHIP_PREFIX}aspect:${this.#aspectTipOpen}:info`);
    const tip = this.#tipRegion?.element;
    if (!info || !tip) return;
    const a = info.getBoundingClientRect();
    const b = tip.getBoundingClientRect();
    const left = Math.min(a.left, b.left);
    const right = Math.max(a.right, b.right);
    const top = Math.min(a.top, b.top);
    const bottom = Math.max(a.bottom, b.bottom);
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom)
      this.#closeAspectTip();
  };

  /** Re-reads each panel's box for a focus stop: it follows the scroll, and is the fallback while the element is not drawn. */
  #liveRect(region: DomRegion<HTMLElement> | null, key: string): Rect | null {
    const found = (region?.element as unknown as { elementOf(key: string): HTMLElement | null } | undefined)?.elementOf(
      key,
    );
    return found && region ? region.rectOf(found) : null;
  }

  /** Wires a panel's region: presses reach `#actions`, a hold reaches `#inspects`, a stale pack picture asks again, the mouse reaches the hover popover. */
  #wire<E extends HTMLElement>(element: E, rect: Rect): DomRegion<E> {
    element.addEventListener("mc-activate", (event) => {
      // Leaving already: a second tap must not act.
      if (this.#leaving) return;
      this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
    });
    element.addEventListener("mc-inspect", (event) => {
      if (this.#leaving) return;
      this.#inspects.get((event as CustomEvent<{ key: string }>).detail.key)?.();
    });
    element.addEventListener("mc-search", (event) => {
      const { key, value } = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (key === SEARCH) this.#onSearch(value);
    });
    element.addEventListener("mc-info", (event) => {
      if (this.#leaving) return;
      const { id } = (event as CustomEvent<{ id: string }>).detail;
      const info = this.#composed?.chipDefs.find((chip) => chip.id === id)?.info;
      if (info) (info.isOpen ? info.onClose : info.onOpen)();
    });
    // A tile's native button took focus (a screen reader, or a click): the keyboard route follows, so Enter, Space and
    // Inspect act on that tile and no other (the route owns the keys: `bindKeyboard` stops the browser acting on them).
    element.addEventListener("mc-tile-focus", (event) => {
      this.#route?.focusKey((event as CustomEvent<{ key: string }>).detail.key);
    });
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src?: string | null }>).detail;
      if (key !== undefined) refreshPackArt(key, src ?? undefined);
    });
    const region = new DomRegion<E>(this, element, rect);
    // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas; the popover itself is
    // drawn in the canvas, so its box is left out of the panel.
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    return region;
  }

  /** Full redraw: every panel from the current state (a resize, a pick, a filter, a verdict from the search worker). */
  #rebuild(): void {
    if (!this.#alive) return;
    this.#stops = new Map();
    this.#actions = new Map();
    this.#inspects = new Map();
    this.#shelfOfKey.clear();
    this.#leases.begin();
    resetHoverCards(this);

    const { width, height } = this.scale.gameSize;
    const deckOptions = this.#deckOptions();
    this.#draft = pruneSeats(
      this.#draft,
      new Set(deckOptions.map((o) => o.deck.id as string)),
      deckOptions[0]?.deck.id as string,
    );

    this.#identityOfDeck = new Map(deckOptions.map((o) => [o.deck.id as string, o.deck.identityCardId as string]));
    this.#syncSearchDocuments(deckOptions);
    const chipDefs = this.#heroChipDefs(deckOptions);
    // Behind the Filters button while a controller is in use or the game is narrower than the breakpoint (Y or the
    // button brings the chips back).
    const behindButton = this.#padFilters.behindButton(width);
    const folded = this.#padFilters.folded(width);
    const padMode = this.#padFilters.padMode;
    this.#chipsFolded = folded;

    const activeDeckId = this.#draft.seats[this.#draft.activeSeatIndex];
    const detailOption = activeDeckId ? deckOptions.find((o) => (o.deck.id as string) === activeDeckId) : undefined;

    // Wrapped against the roster column's *real* width (not the viewport's): the old estimate against `width`
    // under-counted the rows and drew the extra one straight through the shelves (the owner's 2026-09-19 phone
    // screenshot: "Playable now" half-hidden under the Core Set cards).
    const seating = new Map(this.#seatOptionsExcludingActive(deckOptions).map((o) => [o.deckId, o]));
    const insights = this.#seatInsights(deckOptions, seating);
    this.#insights = insights;
    const recCollapsed = recommendedStartsCollapsed(this.#recCollapsed, formFactorFor(width, height) === "phone");
    const unresolved = unresolvedConflictsOf(this.#draft, deckOptions);
    const chipRowsKey = `${width}x${height}:${chipDefs.length}`;
    const chipRows = folded
      ? 0
      : (this.#chipRowsSeen.get(chipRowsKey) ??
        packCompactChipsToRows(chipDefs, rosterColumnWidthFor(width, height)).length);
    const layout = seatsLayout({
      width,
      height,
      chipRows,
      detailLines: 10,
      detailsOpen: this.#detailsOpen,
      searchOpen: this.#searchOpen,
      filtersButton: behindButton,
      chipsShown: !folded,
      pairRows: Math.min(insights.pairs.length, 3),
      noticeRows: unresolved.length > 0 ? 1 : 0,
    });
    const earnedPromos = earnedPromoSets();
    const promoShown = heroPromoShown(earnedPromos, appSession().settings.promoArtOn);
    const heroArtNow = heroArtInForce(appSession().settings.heroArt, promoShown);
    this.#tileArt = { choice: heroArtNow, earned: earnedPromos };
    const active = this.#activeRoster(deckOptions);
    const packShelves = this.#shelves(deckOptions, seating, active);
    const composed: Composed = {
      width,
      height,
      layout,
      deckOptions,
      insights,
      chipDefs,
      folded,
      padMode,
      unresolved,
      tableLock: this.#tableLock(deckOptions),
      randomAvailable: this.#randomHeroCandidates(deckOptions, seating).length > 0,
      detailOption,
      seating,
      chipRows,
      heroArtNow,
      active,
      packShelves,
    };
    this.#composed = composed;

    this.#mountChrome(composed, true);
    const roster = this.#mountRoster(composed, recCollapsed);
    this.#mountInsights();
    this.#mountTip(composed);
    if (!folded && !layout.chipsScroll) this.#checkChipRows(chipRowsKey, chipRows, chipDefs);

    // Where focus starts on arrival: the topmost hero tile on screen (a recommended pick when that shelf leads).
    this.#firstTileKey =
      roster.recIds[0] !== undefined
        ? `hero-rec:${roster.recIds[0]}`
        : roster.cardIds[0] !== undefined
          ? `hero:${roster.cardIds[0]}`
          : null;
    const baseOrder = seatsFocusOrder({
      seatCount: MAX_SEATS,
      deckIds: roster.cardIds,
      ...(roster.shelfStopKeys ? { shelfStopKeys: roster.shelfStopKeys } : {}),
      heroChipIds: folded ? [] : chipDefs.map((c) => c.id),
      filtersToggle: this.#stops.has("filters-toggle"),
      narrow: !layout.wide,
      hasRecommended: this.#stops.has("rec-toggle"),
      recommendedIds: roster.recIds,
      hasConflictNotice: this.#stops.has("conflict-notice"),
    });
    // Each aspect chip's "i" is a stop of its own, right after its chip: Enter or A on it opens or shuts the tip.
    const infoIds = new Set((folded ? [] : chipDefs).filter((chip) => chip.info).map((chip) => chip.id));
    const order = baseOrder.flatMap((key) =>
      key.startsWith("hero-chip:") && infoIds.has(key.slice("hero-chip:".length))
        ? [key, infoStopKey(key.slice("hero-chip:aspect:".length))]
        : [key],
    );
    this.#areas = {
      filters: order.filter((key) => FILTER_STOP.test(key)),
      entry:
        order.find((key) => key.startsWith("hero-chip:")) ??
        order.find((key) => key === "filters-toggle") ??
        order.find((key) => key === "hero-search") ??
        null,
      list: order.filter((key) => LIST_STOP.test(key)),
    };
    // Y on a stop with no Inspect of its own jumps between the filters and the list; a hero tile keeps its Inspect.
    for (const [key, stop] of this.#stops) {
      if (!stop.inspect) this.#stops.set(key, { ...stop, inspect: () => this.#jumpAreas(false) });
    }
    this.#route?.set(order, this.#stops);
    this.#leases.end();
    this.#updateRosterHint();
    this.#hover?.onDraw();
    this.#installDebugHook();
  }

  /** Once the chip bar is drawn, counts the rows it wrapped to; when they differ from what the layout reserved, lays out again with the real count. */
  #checkChipRows(key: string, reserved: number, chipDefs: readonly HeroChipDef[]): void {
    requestAnimationFrame(() => {
      if (!this.#alive || this.#chipRowsSeen.get(key) !== undefined) return;
      const element = this.#chromeRegion?.element as unknown as
        | { elementOf(key: string): HTMLElement | null }
        | undefined;
      const tops = new Set<number>();
      for (const chip of chipDefs) {
        const found = element?.elementOf(`${CHIP_PREFIX}${chip.id}`);
        if (found) tops.add(Math.round(found.getBoundingClientRect().top));
      }
      if (tops.size === 0) return;
      this.#chipRowsSeen.set(key, tops.size);
      if (tops.size !== reserved) this.#rebuild();
    });
  }

  /** Dev e2e hook (never referenced by product code): every control's current rect, by focus key. */
  #installDebugHook(): void {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __mcSeatsDebug?: unknown }).__mcSeatsDebug = {
      folded: () => [...this.#folded],
      seats: () => [...this.#draft.seats],
      unseatable: () =>
        this.#deckOptions()
          .filter((o) => !o.seatable)
          .map((o) => o.deck.id as string),
      activeSeat: () => this.#draft.activeSeatIndex,
      drilledPack: () => this.#drill.packId,
      listRect: () => this.#rosterRegion?.rect ?? null,
      recommended: () => this.#insights?.recommended.map((r) => ({ deckId: r.deckId, reason: r.reason })) ?? [],
      pairs: () => this.#insights?.pairs.map((p) => p.label) ?? [],
      hover: (deckId: string | null) => {
        this.#hoverDeckId = deckId;
        this.#remountInsights();
      },
      stops: () =>
        [...this.#stops].map(([key, stop]) => ({
          key,
          ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
        })),
      hoverCards: () => this.#hoverCards().size,
      heroPictures: () =>
        [...(this.#rosterRegion?.element.renderRoot.querySelectorAll("mc-picture-card") ?? [])].map((card) => {
          const tile = (card as HTMLElement & { artElement: HTMLElement | null }).artElement;
          const img = tile?.shadowRoot?.querySelector("img") ?? null;
          return {
            src: img?.getAttribute("src") ?? null,
            loaded: img ? img.complete && img.naturalWidth > 0 : false,
            width: img?.naturalWidth ?? 0,
          };
        }),
    };
  }

  // -------------------------------------------------------------------------------------------------------------
  // The fixed parts
  // -------------------------------------------------------------------------------------------------------------

  /** The fixed parts drawn again alone: the focus moved to a stop with another Y word, or a glyph changed. */
  #remountChrome(): void {
    const composed = this.#composed;
    if (!composed || !this.#alive || !this.#chromeRegion) return;
    // The stops are the same rects, and the route already holds them: only the parts are drawn again.
    this.#mountChrome(composed, false);
  }

  /** What the word after the Y glyph says where focus is now: back to the list from the filters, Inspect on a hero tile, else Filters. */
  #yWordFor(key: string | null): string {
    const settings = appSession().settings;
    const pad = glyphSetOf(inputDevice(), settings.inputGlyphs, settings.glyphSource) === "pad";
    if (pad && this.#padFilters.padMode) return t("seats.hintFilters");
    if (areaOf(key, this.#areas) === "filters") return t("seats.hintList");
    return key !== null && /^hero(-rec)?:/.test(key) ? t("seats.hintInspect") : t("seats.hintFilters");
  }

  /**
   * A key or pad glyph with its word after it, in the header row: the glyph where a keyboard or pad is in use (the word
   * slides over for it), the word alone otherwise. Returns where the next item may start.
   */
  #hintWithWord(
    b: SheetBuilder,
    entry: {
      readonly key: string;
      readonly x: number;
      readonly y: number;
      readonly ids: readonly ShortcutId[];
      readonly word: string;
      readonly idsNow?: (set: "keyboard" | "pad") => readonly ShortcutId[] | null;
    },
  ): void {
    const before = b.nodes.length;
    this.#glyphs.hint(b, {
      key: entry.key,
      x: entry.x,
      y: entry.y,
      ids: entry.ids,
      height: HINT_HEIGHT,
      ground: "paper",
      ...(entry.idsNow ? { idsNow: entry.idsNow } : {}),
    });
    const node = b.nodes[before];
    // A word with no glyph beside it says nothing (a mouse or touch has no key to name): it shows with its glyph only.
    // The sheet redraws when the glyph appears (a key or pad is used), so the word follows it.
    if (node?.kind !== "glyph" || node.openness <= 0) return;
    const wordX = entry.x + glyphWidthOf(node) + 6;
    b.text(wordX, entry.y, entry.word, typeRole.label, {
      color: surface.ink.hex,
      alpha: ink.label,
      origin: [0, 0.5],
    });
  }

  /**
   * The header row's key and pad hints (wide only): LB / RB pick the seat, X clears it, Y moves between the filters and the
   * list. Each glyph shows only while a keyboard or pad is in use, never on touch (`dom/sheet-glyphs.ts`).
   */
  #drawHints(b: SheetBuilder, padMode: boolean, y: number, fromX: number, maxX: number): void {
    const yWord = this.#yWordFor(this.#route?.focused ?? null);
    this.#yWordShown = yWord;
    const items = [
      { key: "hint-seat", ids: ["zonePrevious", "zoneNext"] as const, text: t("seats.hintSeat"), width: 118 },
      { key: "hint-clear", ids: ["guide"] as const, text: t("seats.clearSeat"), width: 132 },
      { key: "hint-y", ids: ["inspect"] as const, text: yWord, width: 112 },
    ];
    let x = fromX;
    for (const item of items) {
      if (x + item.width > maxX) break;
      // With a controller the Filters button beside the search field carries the Y glyph, so it is not repeated here.
      const keyboardOnly = item.key === "hint-y" && padMode;
      this.#hintWithWord(b, {
        key: item.key,
        x,
        y,
        ids: item.ids,
        word: item.text,
        ...(keyboardOnly ? { idsNow: (set: "keyboard" | "pad") => (set === "pad" ? null : item.ids) } : {}),
      });
      x += item.width;
    }
  }

  /** Whether the fixed parts being built register their focus stops (a full compose does; drawing them again alone does not). */
  #registerStops = true;

  /** A focus stop of the fixed parts, registered on a full compose only. */
  #stop(key: string, stop: FocusStop): void {
    if (this.#registerStops) this.#stops.set(key, stop);
  }

  /** One control of the fixed parts: its action and its focus stop, at the rect the layout gave it. */
  #control(key: string, rect: Rect, activate: () => void): void {
    this.#actions.set(key, activate);
    this.#stop(key, { rect, activate });
  }

  /** Builds the fixed parts and hands them to their panel (made once) rendered now, so stops can be read this frame. */
  #mountChrome(c: Composed, registerStops: boolean): void {
    this.#registerStops = registerStops;
    const { width, height, layout, deckOptions } = c;
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    this.#glyphs.reset();
    this.#yWordShown = "";
    const padMode = c.padMode;
    const barHeight = layout.headerBar.height;

    // Ground: paper body under the same full-width ink header bar Scenario select uses.
    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    b.dots(
      { x: 0, y: barHeight, width, height: height - barHeight },
      "paper",
      dotGrid.onPaper.spacing,
      dotGrid.onPaper.radius,
      dotGrid.onPaper.alpha,
    );
    b.box(layout.headerBar, { fill: surface.ink.hex });

    const back = (): void => this.#back();
    this.#glyphs.button(b, {
      key: "back",
      rect: layout.back,
      label: t("seats.backToScenarios"),
      look: "onInk",
      type: typeRole.backLabel,
      ids: ["cancel"],
      ground: "ink",
    });
    this.#control("back", layout.back, back);
    const titleX = layout.back.x + layout.back.width + 16;
    const stepRight = layout.step.x + layout.step.width;
    const seatCount = this.#draft.seats.length;
    const title = t("seats.title");
    // A phone's title is smaller, so it fits under the dark mode tab (the shared rule drops it there) without ending before it.
    const titleSize = layout.wide ? 28 : 22;
    const titleWidth = b.measure(title, typeRole.pageTitle, { size: titleSize }).width;
    const widthOf = (text: string): number => b.measure(text, typeRole.label).width;
    let stepText = tPlural("seats.stepFilled", seatCount);
    // The title keeps its name whole; on a narrow header it is the step line that gives way, to its short form.
    if (titleX + titleWidth + 12 + widthOf(stepText) > stepRight) stepText = t("seats.stepCount", { count: seatCount });
    if (titleX + titleWidth + 12 + widthOf(stepText) > stepRight) stepText = t("seats.step");
    const stepWidth = Math.min(widthOf(stepText), layout.step.width);
    b.text(stepRight, barHeight / 2, stepText, typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
      origin: [1, 0.5],
      fitWidth: layout.step.width,
    });
    // The dark mode tab hangs from the top centre: the shared rule drops the title under it or ends it before it.
    const titleHeight = titleSize;
    const { drop, maxRight } = sheetThemeFor(this, {
      width,
      textLeft: titleX,
      textRight: titleX + Math.min(titleWidth, stepRight - stepWidth - titleX - 12),
      textTop: barHeight / 2 - titleHeight / 2,
      textHeight: titleHeight,
      barHeight,
    });
    const titleRoom = stepRight - stepWidth - titleX - 12;
    b.text(titleX, barHeight / 2 + drop, title, typeRole.pageTitle, {
      size: titleSize,
      color: surface.paper.hex,
      origin: [0, 0.5],
      fitWidth: maxRight === null ? titleRoom : Math.max(40, Math.min(titleRoom, maxRight - titleX)),
    });

    // The four selectable seat cards (the active-seat model, docs/phase4-screen-gaps.md §3 W2b's own bug fix).
    const deckOptionsById = new Map(deckOptions.map((o) => [o.deck.id as string, o]));
    const slots = seatSlotsOf(
      this.#draft.seats,
      deckOptions,
      currentCardsById(),
      MAX_SEATS,
      this.#draft.activeSeatIndex,
    );
    slots.forEach((slot, index) => {
      const rect = layout.seatSlots[index]!;
      const selectable = seatIsSelectable(this.#draft, index);
      const frame = seatFrameOf({ active: slot.active, filled: slot.deckId !== null }, selectable);
      const youWords = {
        seat: t("seats.seatLabel", { seat: index + 1 }),
        picking: t("seats.seatPicking", { seat: index + 1 }),
        you: t("seats.youSuffix"),
      };
      if (frame !== "locked") {
        // A seat further out than `seatIsSelectable` allows is deliberately not wired to any press or focus stop: it cannot
        // be reached at all, not merely discouraged, so "I clicked seat 3 and the hero landed in seat 2" cannot happen.
        const selectSeat = (): void => {
          this.#draft = setActiveSeat(this.#draft, index);
          this.#rebuild();
        };
        this.#control(`seat:${index}`, rect, selectSeat);
      }
      if (layout.wide) {
        const option = slot.deckId ? deckOptionsById.get(slot.deckId) : undefined;
        const identity = option ? currentCardsById().get(option.deck.identityCardId as string) : undefined;
        drawSeatCard(b, {
          rect,
          index,
          deckId: slot.deckId,
          frame,
          // " · YOU" only where the card is wide enough to keep the name beside the clear button whole.
          label: seatLabelOf(youWords, frame, index, rect.width >= 260),
          name: slot.identityName,
          meta: slot.deckId
            ? t("seats.slotMeta", { aspect: slot.aspectLabel ?? "", hp: slot.hp ?? "—", hand: slot.handSize ?? "—" })
            : null,
          empty: slot.deckId
            ? null
            : selectable
              ? t("seats.emptyPick")
              : t("seats.fillFirst", { seat: this.#draft.seats.length + 1 }),
          picture: identity ? this.#leases.image(artFor(identity, { kind: "hero" })) : null,
          clearLabel: slot.deckId ? t("seats.clearSeat") : null,
        });
        if (slot.deckId) {
          const clearing = slot.deckId;
          this.#actions.set(`seat-clear:${clearing}`, () => {
            // The seat may have changed under a slow press: clear only the deck the ✕ named.
            if (this.#draft.seats[index] !== clearing) return;
            this.#draft = clearSeat(this.#draft, index);
            this.#rebuild();
          });
        }
      } else {
        // "· YOU" only where it fits without shrinking "SEAT 1" itself (a tablet-portrait chip; never a phone one).
        const roomy = rect.width >= 120;
        drawSeatChip(b, {
          rect,
          index,
          frame,
          label: seatLabelOf(youWords, frame === "activeEmpty" ? "empty" : frame, index, roomy),
          name: slot.identityName,
          meta:
            slot.deckId && roomy
              ? t("seats.slotMetaShort", { aspect: slot.aspectLabel ?? "", hp: slot.hp ?? "—" })
              : null,
          empty: slot.deckId ? null : frame === "activeEmpty" ? t("seats.picking") : t("seats.empty"),
        });
      }
    });
    if (layout.pairStrip) {
      drawPairStrip(b, {
        strip: layout.pairStrip,
        seatRects: layout.seatSlots,
        pairs: c.insights.pairs.map((p) => ({ seats: p.seats, label: p.label, names: p.pair.names })),
        rowHeight: PAIR_ROW_HEIGHT,
      });
    }
    if (layout.notice) {
      // Same-name clash: a caution-colored strip that names the count in words, and opens the sheet that answers it.
      const open = (): void => this.#openConflictSheet();
      b.box(layout.notice, { fill: signal.caution.hex });
      b.box(layout.notice, { stroke: surface.ink.hex, strokeWidth: 2.5 });
      b.text(
        layout.notice.x + layout.notice.width / 2,
        layout.notice.y + layout.notice.height / 2,
        `${conflictNoticeOf(c.unresolved.length)} ▸`,
        typeRole.rowTitle,
        {
          color: surface.ink.hex,
          origin: [0.5, 0.5],
          fitWidth: layout.notice.width - 16,
        },
      );
      b.tap("conflict-notice", layout.notice);
      this.#control("conflict-notice", layout.notice, open);
    }
    if (layout.seatSummary && layout.clearSeat)
      this.#drawSeatSummary(b, layout.seatSummary, layout.clearSeat, c.detailOption);

    if (layout.detailsToggle) {
      // Narrow: the active seat's facts are a disclosure in this row (2026-09-21 owner note: the always-open
      // summary, header and search cost the phone roster ~150px — "this stuff should be collapsible").
      const toggleDetails = (): void => {
        this.#detailsOpen = !this.#detailsOpen;
        this.#rebuild();
      };
      b.button({
        key: "seat-details-toggle",
        rect: layout.detailsToggle,
        label: `${this.#seatDetailsSummary(c.detailOption)} ${this.#detailsOpen ? "▾" : "▸"}`,
        look: "quiet",
        type: typeRole.label,
      });
      this.#control("seat-details-toggle", layout.detailsToggle, toggleDetails);
    } else {
      const heading = b.text(
        layout.rosterHeader.x,
        layout.rosterHeader.y + layout.rosterHeader.height / 2,
        t("seats.heroesHeading", { seat: this.#draft.activeSeatIndex + 1, max: MAX_SEATS }),
        typeRole.label,
        {
          color: surface.ink.hex,
          alpha: ink.label,
          origin: [0, 0.5],
          fitWidth: layout.random.x - layout.rosterHeader.x - 12,
        },
      );
      this.#drawHints(
        b,
        padMode,
        layout.rosterHeader.y + layout.rosterHeader.height / 2,
        layout.rosterHeader.x + heading.width + 18,
        layout.random.x - 12,
      );
    }
    const usePreconstructed = (): void => {
      this.#draft = usePreconstructedForAllSeats(this.#draft, deckOptions);
      this.#rebuild();
    };
    b.button({
      key: "use-preconstructed",
      rect: layout.usePreconstructed,
      label: t("seats.usePrecon"),
      look: "quiet",
      type: typeRole.label,
    });
    this.#control("use-preconstructed", layout.usePreconstructed, usePreconstructed);
    const stepHeroArt = (): void => {
      const { settings } = appSession();
      const promoShown = heroPromoShown(earnedPromoSets(), settings.promoArtOn);
      appSession().settings = { ...settings, heroArt: nextHeroArt(settings.heroArt, promoShown) };
      this.#rebuild();
    };
    b.button({
      key: "hero-art",
      rect: layout.heroArt,
      label: t(HERO_ART_KEYS[c.heroArtNow]),
      look: "quiet",
      type: typeRole.label,
    });
    this.#control("hero-art", layout.heroArt, stepHeroArt);
    const randomReason = searchPending(this.#draft.heroFilter, this.#rankedFor)
      ? t("seats.randomHeroSearching")
      : t("seats.randomHeroNone");
    b.button({
      key: "hero-random",
      rect: layout.random,
      label: t("seats.randomHero"),
      look: "quiet",
      type: typeRole.label,
      ...(c.randomAvailable ? {} : { disabled: randomReason }),
    });
    this.#actions.set("hero-random", () => this.#randomHero());
    if (c.randomAvailable) this.#control("hero-random", layout.random, () => this.#randomHero());

    if (layout.search.height > 0) {
      const rect = this.#searchRect(layout, padMode);
      b.search(rect, {
        key: SEARCH,
        // What is typed stays across a compose (the field's debounce lags behind the keys).
        value: this.#field(SEARCH)?.text ?? this.#draft.heroFilter.text,
        placeholder: t("seats.search"),
        clearLabel: t("deckPicker.searchClear"),
        maxLength: 80,
        debounce: 140,
        escapeClears: true,
      });
      this.#stop(SEARCH, { rect, activate: () => this.#focusField(SEARCH) });
    }
    if (layout.searchToggle) this.#drawSearchToggle(b, layout.searchToggle);
    if (layout.filtersButton) {
      const filter = this.#draft.heroFilter;
      const active = (filter.aspect ? 1 : 0) + (filter.source ? 1 : 0) + (filter.playableOnly ? 1 : 0);
      const toggle = (): void => this.#toggleFilters();
      this.#glyphs.button(b, {
        key: "filters-toggle",
        rect: layout.filtersButton,
        label: filtersLabel(active, !c.folded, artLanguageNow()),
        look: "secondary",
        type: typeRole.rowTitle,
        ids: ["inspect"],
        idsNow: (set) => (set === "pad" ? ["inspect"] : null),
        ground: "paper",
      });
      this.#control("filters-toggle", layout.filtersButton, toggle);
      // View opens the Inspect sheet here, because Y is the filters' on a pad (the keyboard's Inspect key is unchanged).
      if (padMode && layout.wide) {
        this.#hintWithWord(b, {
          key: "hint-view",
          x: layout.filtersButton.x - 8 - 104 + 4,
          y: layout.filtersButton.y + layout.filtersButton.height / 2,
          ids: ["peek"],
          word: t("seats.hintInspect"),
          idsNow: (set) => (set === "pad" ? ["peek"] : null),
        });
      }
    }
    if (!c.folded && layout.chips.height > 0) this.#drawChips(b, c);

    // The hero-detail panel — dark, matching D03's own sidebar, for the active seat's own pick. Wide only: on
    // narrow the same facts live in the seat summary line under the seat chips, and the shelves get the room.
    this.#insightArea = null;
    if (layout.detail) {
      // The active seat's own hero, or — while the next empty seat is being chosen — the one just seated.
      const subject = seatDetailSubject(this.#draft);
      const panelOption =
        subject.deckId === null ? undefined : deckOptions.find((o) => (o.deck.id as string) === subject.deckId);
      const seatNote =
        panelOption && subject.seatIndex !== null && subject.pickingSeatIndex !== null
          ? t("seats.seatSetPickNext", { seat: subject.seatIndex + 1, next: subject.pickingSeatIndex + 1 })
          : null;
      const detail = panelOption ? heroCandidateDetailOf(panelOption, currentCardsById(), POOL_ENCOUNTER_SETS) : null;
      const credit = panelOption ? testedSubtitleOf(panelOption.deck, testedCatalog()) : null;
      const endY = drawDetailPanel(b, {
        rect: layout.detail,
        hero:
          panelOption && detail
            ? {
                name: detail.identityName,
                credit: credit ? `${deckDisplayName(panelOption.deck)} · ${credit}` : null,
                stats: t("seats.detailFull", {
                  aspect: detail.aspectLabel,
                  hp: detail.hp ?? "—",
                  hand: detail.handSize ?? "—",
                  thw: detail.thw ?? "—",
                  atk: detail.atk ?? "—",
                  def: detail.def ?? "—",
                }),
                obligationLabel: t("seats.obligation"),
                obligation: detail.obligationName ?? t("seats.obligationNone"),
                nemesisLabel: t("seats.nemesisSet"),
                nemesis: detail.nemesisSetName ?? t("seats.nemesisNone"),
              }
            : null,
        seatNote,
        emptyText: t("seats.selectHeroBelow"),
        textWidth: detailPanelWidthFor(width, height) - DETAIL_TEXT_PAD,
      });
      this.#insightArea = {
        x: layout.detail.x + 16,
        y: endY + 20,
        width: layout.detail.width - 32,
        height: layout.deckCheck.y - 12 - (endY + 20),
      };
    }

    // Drilled into a pack: the "All packs" button and the pack's name above its grid.
    if (this.#drill.packId !== null) {
      const shelf = c.packShelves.find((s) => s.id === this.#drill.packId);
      const backRect: Rect = { x: layout.shelves.x, y: layout.shelves.y, width: 130, height: 28 };
      b.button({
        key: "drill-back",
        rect: backRect,
        label: t("scenario.allPacks"),
        look: "quiet",
        type: typeRole.rowTitle,
      });
      this.#control("drill-back", backRect, () => this.#drillOut());
      b.text(
        layout.shelves.x + 140,
        layout.shelves.y + 14,
        (shelf?.title ?? "").toUpperCase(),
        typeRole.sectionHeader,
        {
          color: surface.ink.hex,
          origin: [0, 0.5],
        },
      );
    }

    // Narrow: the sticky ink footer both actions sit inside (P03/P12's own shape).
    if (layout.footer) b.box(layout.footer, { fill: surface.ink.hex });

    // The two actions at the panel's own foot: the primary "Play N heroes ▸" on to Table setup, and a quiet
    // "Deck check ▸" for the active seat's own deck. D03 draws them the other way round; the owner's call
    // (2026-09-18) is that the way forward is the red one and looking at a deck is the side trip.
    const noHeroes = this.#draft.seats.length === 0;
    const play = (): void => {
      if (c.tableLock || noHeroes) return;
      // A card that can't be played beside another seat's hero is answered first, in the sheet; Continue there plays.
      if (c.unresolved.length > 0) {
        this.#openConflictSheet();
        return;
      }
      this.#goToTableSetup();
    };
    const playLabel = c.tableLock
      ? t("seats.heroLocked")
      : noHeroes
        ? t("seats.pickHeroCta")
        : tPlural("seats.playHeroes", this.#draft.seats.length);
    const playReason = c.tableLock ?? (noHeroes ? t("seats.pickHeroFirst") : null);
    // The red fill on an ink footer takes the same paper outline Table setup's "Deal it out" does, so the two sticky
    // footers of the setup flow read as one. Drawn first and outside the button: a box over it would take its presses.
    if (layout.footer)
      b.box(
        {
          x: layout.play.x - 1.5,
          y: layout.play.y - 1.5,
          width: layout.play.width + 3,
          height: layout.play.height + 3,
        },
        { stroke: surface.paper.hex, strokeWidth: 3 },
      );
    // Start moves forward on this screen (the route's primary), so its glyph sits on the red button, on a pad only.
    this.#glyphs.button(b, {
      key: "play",
      rect: layout.play,
      label: playLabel,
      look: "primary",
      type: typeRole.barTitle,
      ...(playReason !== null ? { disabled: playReason, pressable: true } : {}),
      ids: ["pause"],
      idsNow: (set) => (set === "pad" && playReason === null ? ["pause"] : null),
      ground: "ink",
    });
    this.#actions.set("play", play);
    if (!noHeroes) this.#stop("play", { rect: layout.play, activate: play });

    const deckCheck = (): void => {
      if (this.#leaving || noHeroes) return;
      this.#leaving = true;
      this.scale.off("resize", this.#rebuild, this);
      goToDeckCheckOrTableSetup(this, this.#draft, this.#deckOptions());
    };
    b.button({
      key: "deck-check",
      rect: layout.deckCheck,
      label: t("seats.deckCheck"),
      look: layout.footer ? "onInk" : "secondary",
      type: typeRole.barTitle,
      ...(noHeroes ? { disabled: t("seats.pickHeroFirst") } : {}),
    });
    this.#actions.set("deck-check", deckCheck);
    if (!noHeroes) this.#stop("deck-check", { rect: layout.deckCheck, activate: deckCheck });

    const region = (this.#chromeRegion ??= this.#wire(document.createElement("mc-sheet") as McSheet, {
      x: 0,
      y: 0,
      width,
      height,
    }));
    region.setRect({ x: 0, y: 0, width, height });
    region.element.nodes = b.nodes;
    renderNow(region.element);
  }

  /** The search field's rect, with room cut from its right for the Inspect hint beside the Filters button (pad, wide only). */
  #searchRect(layout: SeatsLayout, padMode: boolean): Rect {
    const show = padMode && layout.wide && layout.filtersButton !== null;
    return show && layout.search.height > 0
      ? { ...layout.search, width: layout.search.width - 104 - 8 }
      : layout.search;
  }

  /** Puts the caret in the search field once it has rendered its input. */
  #focusField(key: string): void {
    const field = this.#field(key);
    if (field) void field.updateComplete.then(() => field.focusInput());
  }

  /** Narrow layouts' search toggle: the square at the head of the chip rail, a magnifier; chosen while the field is open or a search is in force. */
  #drawSearchToggle(b: SheetBuilder, rect: Rect): void {
    const active = this.#searchOpen || this.#draft.heroFilter.text.length > 0;
    const toggle = (): void => this.#toggleSearch();
    b.button({
      key: "hero-search-toggle",
      rect,
      label: "",
      look: "secondary",
      selected: active,
      aria: t("seats.searchToggle"),
      type: typeRole.rowTitle,
    });
    // The magnifier, in whichever ink the button's own state uses (paper on the ink-filled selected state).
    const color = sheetColor(active ? surface.paper.hex : surface.ink.hex, "line");
    const cx = rect.width / 2 - 2;
    const cy = rect.height / 2 - 2;
    b.svg(
      rect,
      [rect.width, rect.height],
      [
        { k: "circle", cx, cy, r: 7, stroke: color, sw: 2.5 },
        { k: "line", x1: cx + 5, y1: cy + 5, x2: cx + 11, y2: cy + 11, stroke: color, sw: 3 },
      ],
    );
    this.#control("hero-search-toggle", rect, toggle);
  }

  /** The filter chips as one filter bar: wrapped rows on a wide screen, one row that scrolls sideways on a narrow one. */
  #drawChips(b: SheetBuilder, c: Composed): void {
    const { layout, chipDefs } = c;
    const chips: FilterChip[] = chipDefs.map((chip) => ({
      id: chip.id,
      label: chip.text,
      selected: chip.selected,
      ...(chip.tint
        ? { tint: { fill: sheetColor(chip.tint.fill, "fill"), ink: sheetColor(chip.tint.ink, "text") } }
        : {}),
      ...(chip.info ? { info: { open: chip.info.isOpen, label: t("seats.aspectInfo", { aspect: chip.text }) } } : {}),
    }));
    b.filterBar(CHIPS, layout.chips, chips, {
      prefix: CHIP_PREFIX,
      rowHeight: hit.target,
      gap: CHIP_GAP,
      ...(layout.chipsScroll ? { rail: true } : {}),
    });
    const scrollInto = (id: string) => (): void =>
      this.#chromeRegion?.element.elementOf(id)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    for (const chip of chipDefs) {
      const key = `${CHIP_PREFIX}${chip.id}`;
      this.#actions.set(key, chip.onClick);
      this.#stop(key, {
        rect: () => this.#liveRect(this.#chromeRegion, key) ?? layout.chips,
        activate: chip.onClick,
        ensureVisible: scrollInto(key),
        view: () => layout.chips,
      });
      if (chip.info) {
        const info = chip.info;
        const infoKey = `${key}:info`;
        this.#stop(infoStopKey(chip.id.replace(/^aspect:/, "")), {
          rect: () => this.#liveRect(this.#chromeRegion, infoKey) ?? layout.chips,
          activate: () => (info.isOpen ? info.onClose() : info.onOpen()),
          ensureVisible: scrollInto(infoKey),
          view: () => layout.chips,
        });
      }
    }
  }

  /** Narrow only: the one line the details disclosure shows while shut — enough to know what's in the seat without opening it. */
  #seatDetailsSummary(option: DeckOption | undefined): string {
    const seatNumber = this.#draft.activeSeatIndex + 1;
    if (!option) return t("seats.summaryEmpty", { seat: seatNumber });
    const detail = heroCandidateDetailOf(option, currentCardsById(), POOL_ENCOUNTER_SETS);
    // Short enough to read whole beside "Use preconstructed" at 375px; the hand size and the rest are one tap away.
    return t("seats.summary", { seat: seatNumber, aspect: detail.aspectLabel, hp: detail.hp ?? "—" });
  }

  /** Narrow only: the active seat's facts on one strip under the seat chips, with the "Clear seat" control the chips have no room for. */
  #drawSeatSummary(b: SheetBuilder, rect: Rect, clearRect: Rect, option: DeckOption | undefined): void {
    const seatNumber = this.#draft.activeSeatIndex + 1;
    // `clearSeat` itself refuses to empty the last seat (a game needs one hero), so the control says so rather than
    // silently doing nothing.
    const canClear = this.#draft.seats.length > 1;
    const clear = (): void => {
      if (!canClear) return;
      this.#draft = clearSeat(this.#draft, this.#draft.activeSeatIndex);
      this.#rebuild();
    };
    if (!option) {
      drawSeatSummary(b, {
        rect,
        clearRect,
        hint: t("seats.tapHeroForSeat", { seat: seatNumber }),
        lines: [],
        clearLabel: t("seats.clearSeat"),
        clearBlocked: null,
      });
      return;
    }
    const detail = heroCandidateDetailOf(option, currentCardsById(), POOL_ENCOUNTER_SETS);
    drawSeatSummary(b, {
      rect,
      clearRect: { ...clearRect, width: CLEAR_SEAT_WIDTH },
      hint: null,
      lines: [
        {
          text: t("seats.detailHpHand", {
            aspect: detail.aspectLabel,
            hp: detail.hp ?? "—",
            hand: detail.handSize ?? "—",
          }),
          strong: true,
        },
        {
          text: t("seats.detailStats", { thw: detail.thw ?? "—", atk: detail.atk ?? "—", def: detail.def ?? "—" }),
          strong: true,
        },
        {
          text: t("seats.obligationLine", { name: detail.obligationName ?? t("seats.obligationNoneLower") }),
          strong: false,
        },
        { text: t("seats.nemesisLine", { name: detail.nemesisSetName ?? t("seats.nemesisNoneLower") }), strong: false },
      ],
      clearLabel: t("seats.clearSeat"),
      clearBlocked: canClear ? null : t("seats.needOneHero"),
    });
    this.#control("clear-seat", clearRect, clear);
  }

  // -------------------------------------------------------------------------------------------------------------
  // The hero roster
  // -------------------------------------------------------------------------------------------------------------

  /** ~220px wide portrait cards, tall enough to fill most of the shelf viewport's own height (mirrors `scenario-select.ts`'s own sizing, narrower since a hero identity scan is a portrait card, not a landscape villain scene). */
  #cardMetrics(shelvesRect: Rect): {
    cardWidth: number;
    cardHeight: number;
    cardGap: number;
    headerHeight: number;
    shelfGap: number;
  } {
    const headerHeight = 28;
    const headerToCardsGap = 8;
    const shelfGap = 18;
    const cardWidth = Math.min(220, shelvesRect.width - 40);
    const available = shelvesRect.height - headerHeight - headerToCardsGap - shelfGap;
    // Floored at 160 (was 200): a short phone (375×667) gives the narrow layout's shelves about 250px, and a card
    // that fits that beats one that's cropped at the knees.
    const cardHeight = Math.max(160, Math.min(360, available));
    return { cardWidth, cardHeight, cardGap: 12, headerHeight, shelfGap };
  }

  /**
   * The hero roster: the shelves (the Recommended shelf first, then a shelf per release wave or A–Z letter), or one pack
   * opened as a full grid. Returns the focus keys the screen's route is built from.
   */
  #mountRoster(
    c: Composed,
    recCollapsed: boolean,
  ): {
    readonly cardIds: readonly string[];
    readonly shelfStopKeys: readonly string[] | undefined;
    readonly recIds: readonly string[];
  } {
    const { layout, deckOptions, insights, active, packShelves } = c;
    const drilled = this.#drill.packId !== null;
    // The shelves' box; narrow, the sticky footer covers whatever a too-short viewport let them run under.
    const footerTop = layout.footer ? layout.footer.y : Number.POSITIVE_INFINITY;
    const shelvesBox: Rect = {
      ...layout.shelves,
      height: Math.max(0, Math.min(layout.shelves.y + layout.shelves.height, footerTop) - layout.shelves.y),
    };
    // Drilled in, the "All packs" back button and the pack's name take the top band and the grid the rest.
    const gridBox: Rect = drilled
      ? { x: shelvesBox.x, y: shelvesBox.y + 36, width: shelvesBox.width, height: Math.max(0, shelvesBox.height - 36) }
      : shelvesBox;
    this.#rosterView = gridBox;
    const metrics = this.#cardMetrics(layout.shelves);
    let cardIds: readonly string[];
    let shelfStopKeys: readonly string[] | undefined;
    let recIds: readonly string[] = [];
    const rosterShelves: ShelfRosterShelf[] = [];
    let emptyText: string | null = null;
    const clearFilters = (): void => {
      this.#draft = clearHeroFilter(this.#draft);
      this.#requestSearch("");
    };
    if (drilled) {
      const shelf = packShelves.find((s) => s.id === this.#drill.packId);
      const items = shelf?.items ?? [];
      rosterShelves.push({
        id: shelf?.id ?? "pack",
        title: shelf?.title ?? "",
        count: "",
        cover: null,
        open: undefined,
        seeAll: "",
        items: items.map((option) => this.#heroCardOf(option, active, false, (card) => `hero:${card}`)),
      });
      if (items.length === 0) emptyText = t("scenario.noMatches");
      cardIds = ["drill-back", ...items.map((o) => o.deck.id as string)];
      for (const option of items) this.#wireHeroTile(option, active, "hero", false, "pack");
    } else {
      // The first shelf of the list, drawn by the same widget and the same tile as the pack shelves below it: the
      // heroes worth a look for this seat, with the reason as the caption. Folding it leaves its header band.
      const recOptions = insights.recommended.flatMap((rec) => {
        const option = deckOptions.find((o) => (o.deck.id as string) === rec.deckId);
        return option ? [option] : [];
      });
      const recShelf: Shelf<DeckOption> | null =
        recOptions.length > 0
          ? {
              id: REC_SHELF_ID,
              title: t("seats.recommendedFor", { seat: this.#draft.activeSeatIndex + 1 }),
              items: recOptions,
              ...(recCollapsed ? { collapsed: true } : {}),
            }
          : null;
      const shelves = recShelf ? [recShelf, ...packShelves] : packShelves;
      const toggleRecommended = (): void => {
        this.#recCollapsed = !recCollapsed;
        saveRecommendedCollapsed(this.#recCollapsed);
        this.#rebuild();
      };
      for (const shelf of shelves) {
        const rec = shelf.id === REC_SHELF_ID;
        const prefix = rec ? "hero-rec" : "hero";
        const folded = shelf.collapsed === true;
        rosterShelves.push({
          id: shelf.id,
          title: shelf.title,
          count: rec
            ? `${tPlural("seats.heroCount", shelf.items.length)}  ·  ${recCollapsed ? t("seats.show") : t("seats.hide")}`
            : `${tPlural("seats.identityCount", shelf.items.length)}  ·`,
          cover: null,
          open: !folded,
          seeAll: rec ? "" : `${t("scenario.seeAll")} ▸`,
          items: folded
            ? []
            : shelf.items.map((option) => this.#heroCardOf(option, active, rec, (id) => `${prefix}:${id}`)),
        });
        // A shelf's header folds it (the Recommended shelf too); the "See all" end opens a pack as a full grid.
        this.#actions.set(`fold:${shelf.id}`, rec ? toggleRecommended : () => this.#toggleFold(shelf.id));
        if (!rec) {
          this.#actions.set(`all:${shelf.id}`, () => {
            this.#drill = drillIntoPack(shelf.id);
            this.#rebuild();
          });
        }
        if (!folded) for (const option of shelf.items) this.#wireHeroTile(option, active, prefix, rec, shelf.id);
      }
      emptyText = shelves.length === 0 ? t("scenario.noMatches") : null;
      if (recShelf && !recCollapsed) recIds = recOptions.map((o) => o.deck.id as string);
      cardIds = openShelfItems(packShelves).map((o) => o.deck.id as string);
      const keys = shelfFocusKeys(packShelves, "hero-shelf", "hero", (o) => o.deck.id as string);
      shelfStopKeys = keys.length > 0 ? keys : undefined;
    }

    const empty = emptyText !== null || rosterShelves.length === 0;
    if (empty) this.#actions.set("clear", clearFilters);
    const model = {
      mode: drilled ? ("grid" as const) : ("shelves" as const),
      shelves: rosterShelves,
      cardWidth: metrics.cardWidth,
      cardHeight: metrics.cardHeight,
      gap: metrics.cardGap,
      contentWidth: Math.max(0, gridBox.width - SCROLL_GUTTER),
      emptyText: empty ? t("scenario.noMatches") : null,
      clearLabel: empty ? t("scenario.clear") : "",
      previousLabel: t("seats.shelfPrevious"),
      nextLabel: t("seats.shelfNext"),
      hint: this.#rosterHint(),
    };
    const fresh = !this.#rosterRegion;
    const region = (this.#rosterRegion ??= this.#wireRoster(gridBox));
    region.setRect(gridBox);
    region.element.model = model;
    renderNow(region.element);
    // Back from Deck check (or Table setup): the roster is where it was left.
    if (fresh && rememberedScroll) {
      region.element.restoreScroll(rememberedScroll);
      rememberedScroll = null;
    }
    const element = region.element;
    if (empty) {
      this.#stops.set("hero-clear", {
        rect: () => this.#liveRect(region, "clear") ?? gridBox,
        activate: clearFilters,
      });
    }
    if (this.#actions.has(`fold:${REC_SHELF_ID}`)) {
      this.#stops.set("rec-toggle", {
        rect: () => this.#liveRect(region, `fold:${REC_SHELF_ID}`) ?? gridBox,
        activate: this.#actions.get(`fold:${REC_SHELF_ID}`)!,
        ensureVisible: () => element.elementOf(`fold:${REC_SHELF_ID}`)?.scrollIntoView({ block: "nearest" }),
        view: () => this.#rosterView,
      });
    }
    if (!drilled) {
      for (const shelf of rosterShelves) {
        if (shelf.id === REC_SHELF_ID) continue;
        const header = `fold:${shelf.id}`;
        this.#stops.set(`hero-shelf:${shelf.id}`, {
          rect: () => this.#liveRect(region, header) ?? gridBox,
          activate: () => this.#toggleFold(shelf.id),
          ensureVisible: () => element.elementOf(header)?.scrollIntoView({ block: "nearest" }),
          view: () => this.#rosterView,
        });
      }
    }
    return { cardIds, shelfStopKeys, recIds };
  }

  /** The roster's own panel, wired for hero tiles: a hover over a tile names the deck the insights explain. */
  #wireRoster(rect: Rect): SeatsRegion<McShelfRoster> {
    const region = this.#wire(document.createElement("mc-shelf-roster") as McShelfRoster, rect);
    const deckOf = (event: Event): string | null => {
      for (const node of event.composedPath()) {
        const key = node instanceof HTMLElement ? node.dataset.key : undefined;
        const id = key === undefined ? null : deckIdOfStop(key);
        if (id !== null) return id;
      }
      return null;
    };
    region.element.addEventListener("pointerover", (event) => {
      if ((event as PointerEvent).pointerType !== "mouse") return;
      this.#setHoverDeck(deckOf(event));
    });
    region.element.addEventListener("pointerleave", () => this.#setHoverDeck(null));
    return region;
  }

  #setHoverDeck(deckId: string | null): void {
    if (deckId === this.#hoverDeckId) return;
    this.#hoverDeckId = deckId;
    this.#remountInsights();
  }

  /** The tile of one deck: the hero's tile copy of its picture, its words, and the marks that say what the roster says of it. */
  #heroCardOf(
    option: DeckOption,
    active: ReadonlyMap<string, ActiveSeatRosterEntry>,
    recommended: boolean,
    keyOf: (id: string) => string,
  ): ShelfRosterItem {
    const identityId = option.deck.identityCardId as string;
    const identity = currentCardsById().get(identityId);
    const entry = active.get(option.deck.id as string);
    const sourceText =
      testedSubtitleOf(option.deck, testedCatalog()) ??
      t(
        option.deck.source.kind === "precon"
          ? "deckSource.precon"
          : option.deck.source.kind === "imported"
            ? "deckSource.imported"
            : "deckSource.built",
      );
    const seatedElsewhere = entry?.seatIndex !== null && entry?.seatIndex !== undefined && !entry.isActiveSeat;
    // Second-pass item 12/cosmetic: a deck seated elsewhere gets only its short "SEAT N" tag (no truncated
    // "ALREADY SEATED · SEA…" string); a genuinely illegal/duplicate deck gets "AT THE TABLE" instead of its own
    // full sentence ("Captain Marvel is already at the table"), which used to truncate in the subtitle line — the
    // full reason is still one Inspect away (`#inspectOption`'s own `note`).
    const blockedBy = seatedElsewhere ? null : (entry?.blockedBy ?? null);
    const lock = seatedElsewhere ? null : deckLockOf(option.deck);
    // A hero with several matching decks is one tile: the hero's name, every aspect its decks wear, "N decks".
    const decks = recommended ? [option] : (this.#groupOf(option)?.decks ?? [option]);
    const several = decks.length > 1;
    const countTag = deckCountTagOf(decks.length, decks.filter((d) => d.deck.source.kind !== "precon").length);
    const aspects = [...new Set(decks.flatMap((d) => d.deck.aspects))];
    const tag = entry?.isActiveSeat
      ? t("seats.seatLabel", { seat: this.#draft.activeSeatIndex + 1 })
      : seatedElsewhere
        ? t("seats.seatLabel", { seat: entry!.seatIndex! + 1 })
        : lock
          ? t("scenario.locked")
          : blockedBy
            ? blockedTagOf(blockedBy)
            : // A custom hero says so and still says how many decks it has.
              [decks.some((d) => customBadgeOf(d.deck) !== null) ? customBadge() : null, countTag]
                .filter((part) => part !== null)
                .join(" · ") || null;
    const rec = this.#insights?.analysis.get(option.deck.id as string);
    const name = identityLabelOf(option) ?? deckDisplayName(option.deck);
    const model = heroCardModelOf(
      {
        title: several ? name : titleWithoutAspects(deckDisplayName(option.deck).split(" — ")[0]!, option.deck.aspects),
        // A recommended tile says *why* in the line a normal tile uses for its source.
        subtitle:
          recommended && rec?.caption
            ? rec.caption
            : several
              ? t("seats.decksSummary", { count: formatCount(decks.length), sources: sourceWordsOf(decks) })
              : `${sourceText} · ${identityLabelOf(option) ?? t("seats.unknownIdentity")}`,
        // Locked: the free way (the villain to beat) and the paid one (tap it to spend points), side by side.
        warning: seatedElsewhere
          ? null
          : lock
            ? t("seats.lockOrPoints", {
                lock,
                cost: unlockCostOf({ kind: "hero", identityCardId: identityId }),
              })
            : shortWarningOf(entry?.warning ?? null, artLanguageNow()),
        stamps: aspectStampsOf(several ? aspects : option.deck.aspects, artLanguageNow()),
        tag,
        // "TEAM-UP WITH PHOENIX", top left of the art (the tag is top right, the aspect stamps bottom left). It stays one
        // line (a pair of names, never a sentence).
        plate:
          rec && rec.teamUps.length > 0 && !seatedElsewhere && !entry?.isActiveSeat
            ? t("seats.teamUpWith", { names: rec.teamUps.map((link) => link.partner).join(" + ") })
            : null,
        selected: entry?.isActiveSeat ?? false,
      },
      name.slice(0, 1),
    );
    const shown = heroTilePictureOf(this.#heroPictureFor(identityId), identity, this.#leases);
    return {
      id: option.deck.id as string,
      key: keyOf(option.deck.id as string),
      cardId: identityId,
      card: model,
      selected: entry?.isActiveSeat ?? false,
      inspect: true,
      picture: {
        src: shown.src,
        fill: sheetColor(surface.parchment.hex, "fill"),
        cover: shown.cover,
        ...(shown.retry !== undefined ? { retry: shown.retry } : {}),
      },
      dim: blockedBy !== null,
    };
  }

  /** A tile's actions and its focus stop: a tap picks (or opens the deck submenu), a hold or Y inspects. */
  #wireHeroTile(
    option: DeckOption,
    active: ReadonlyMap<string, ActiveSeatRosterEntry>,
    prefix: string,
    recommended: boolean,
    shelfId: string,
  ): void {
    const id = option.deck.id as string;
    const key = `${prefix}:${id}`;
    const activate = (): void => (recommended ? this.#pickHero(option, active) : this.#onHeroTile(option, active));
    const inspect = (): void => this.#inspectOption(option, active);
    this.#actions.set(key, activate);
    this.#inspects.set(key, inspect);
    this.#shelfOfKey.set(key, shelfId);
    this.#stops.set(key, {
      rect: () => this.#liveRect(this.#rosterRegion, key) ?? this.#rosterView,
      activate,
      inspect,
      ensureVisible: () =>
        this.#rosterRegion?.element.elementOf(key)?.scrollIntoView({ block: "nearest", inline: "nearest" }),
      view: () => this.#rosterView,
    });
  }

  /**
   * The row-paging glyphs for the shelf focus is in: LT before and RT after, on a pad only, shown by the roster over each
   * chevron gutter while that end of the row can page (`mc-shelf-roster`'s `hint`).
   */
  #rosterHint(): ShelfRosterHint | null {
    const snapshot = this.#glyphs.snapshot;
    const shelfId = this.#shelfOfKey.get(this.#route?.focused ?? "");
    if (!snapshot || shelfId === undefined) return null;
    const set = glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource);
    if (set !== "pad") return null;
    const specOf = (layer: "lt" | "rt") => {
      const spec = layerTriggerGlyph(layer, snapshot.state, snapshot.settings);
      return spec ? [uiSpecOf(spec)] : null;
    };
    return {
      shelfId,
      previous: specOf("lt"),
      next: specOf("rt"),
      height: scaledGlyphHeight(PAGE_HINT_HEIGHT, snapshot.settings.glyphSize),
      still: snapshot.settings.reducedMotion,
    };
  }

  /** The glyphs follow the focused row: only the roster's `hint` changes, nothing is drawn again. */
  #updateRosterHint(): void {
    const region = this.#rosterRegion;
    if (!region || !this.#alive) return;
    const hint = this.#rosterHint();
    const model = region.element.model;
    if ((model.hint ?? null) === hint) return;
    if (JSON.stringify(model.hint ?? null) === JSON.stringify(hint)) return;
    region.element.model = { ...model, hint };
  }

  // -------------------------------------------------------------------------------------------------------------
  // The detail panel's insights, and the aspect tip
  // -------------------------------------------------------------------------------------------------------------

  /** The pictures on screen, for the hover popover: each tile's picture, clipped to the roster's box. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const region = this.#rosterRegion;
    if (!region) return found;
    region.element.hoverFaces().forEach(({ cardId, element }, index) => {
      const rect = clipHoverRect(region.rectOf(element), this.#rosterView);
      if (rect) found.set(hoverSlotOf(cardId, index), { ...rect, cardId, face: { kind: "hero" }, through: true });
    });
    return found;
  }

  /** Mounts the insights block's panel (made once), and draws it. */
  #mountInsights(): void {
    this.#insightRegion ??= this.#wire(document.createElement("mc-sheet") as McSheet, {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    this.#remountInsights();
  }

  /**
   * The detail panel's lower block, redrawn on its own as the pointer or focus moves (a compose per hover would rebuild
   * the whole roster): every seated Team-Up pair in full, then, for the hero in hover or focus, why it is recommended.
   */
  #remountInsights(): void {
    const region = this.#insightRegion;
    if (!region || !this.#alive) return;
    const area = this.#insightArea;
    const insights = this.#insights;
    if (!area || !insights || area.height < 40) {
      region.setHidden(true);
      return;
    }
    const b = new SheetBuilder(this.game, { x: area.x, y: area.y }, isDesktopType);
    let y = area.y;
    const put = (text: string, role: TypeSpec, alpha = 1, gap = 6): void => {
      if (y > area.y + area.height - 12) return;
      const measured = b.text(area.x, y, text, role, { color: surface.paper.hex, alpha, wrapWidth: area.width });
      y += measured.height + gap;
    };
    for (const pair of insights.pairs) {
      put(t("seats.pairSeats", { label: pair.label, a: pair.seats[0], b: pair.seats[1] }), typeRole.label, 1, 2);
      const held = pair.inDecks.map((d) => t("seats.deckHas", { hero: d.heroName, copies: d.copies }));
      put(
        `${listOf(pair.cardNames)}: ${held.length > 0 ? held.join("; ") : t("seats.inNeitherDeck")}.`,
        typeRole.body,
        ink.label,
        10,
      );
    }
    const focusId = this.#hoverDeckId ?? this.#focusDeckId;
    const rec = focusId ? insights.analysis.get(focusId) : undefined;
    const option = focusId ? this.#deckOptions().find((o) => (o.deck.id as string) === focusId) : undefined;
    if (rec && rec.lines.length > 0 && option) {
      put(t("seats.why", { name: identityLabelOf(option) ?? deckDisplayName(option.deck) }), typeRole.label, 1, 2);
      for (const line of rec.lines) put(line, typeRole.body, 1, 4);
    }
    region.setRect(area);
    region.setHidden(false);
    region.element.nodes = b.nodes;
    renderNow(region.element);
  }

  /** Shuts an open aspect tip; true when there was one (B then does nothing more). */
  #closeAspectTip(): boolean {
    if (this.#aspectTipOpen === null) return false;
    this.#aspectTipOpen = null;
    this.#rebuild();
    return true;
  }

  /**
   * G10b's tip panel for whichever aspect chip's "i" segment is open, anchored at that segment's current rect and drawn
   * above everything; none when no tip is open, or the open chip has scrolled off the rail.
   */
  #mountTip(c: Composed): void {
    const aspect = this.#aspectTipOpen;
    const content = aspect ? aspectTipContentOf(aspect) : null;
    const infoElement = aspect ? this.#chromeRegion?.element.elementOf(`${CHIP_PREFIX}aspect:${aspect}:info`) : null;
    if (!aspect || !content || !infoElement || c.folded || !this.#chromeRegion) {
      this.#tipRegion?.destroy();
      this.#tipRegion = null;
      return;
    }
    const anchor = this.#chromeRegion.rectOf(infoElement);
    const chips = c.layout.chips;
    // Scrolled off the rail: the segment is not on screen, so the tip has nothing to point at.
    if (anchor.x < chips.x - 1 || anchor.x + anchor.width > chips.x + chips.width + 1) {
      this.#tipRegion?.destroy();
      this.#tipRegion = null;
      return;
    }
    const probe = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const screen = { x: 0, y: 0, width: c.width, height: c.height };
    const tipWidth = tipWidthFor(screen);
    const layout = tipLayoutOf(probe, content, tipWidth);
    const placement = tipPlacement(anchor, layout.height, screen, tipWidth);
    const b = new SheetBuilder(this.game, { x: placement.bounds.x, y: placement.bounds.y }, isDesktopType);
    drawAspectTip(b, placement, content, layout);
    this.#actions.set(TIP_LINK_KEY, () => {
      this.scene.launch(SCENES.aspectLesson, {
        aspect: content.aspect,
        backTo: "previous",
      } satisfies AspectLessonSceneData);
    });
    const region = (this.#tipRegion ??= this.#wire(document.createElement("mc-sheet") as McSheet, placement.bounds));
    region.setRect(placement.bounds);
    region.element.nodes = b.nodes;
    renderNow(region.element);
  }

  /** B / Escape: shuts an open tip, then from the list returns to the filters (scrolled back to the top), then backs out. */
  #onCancel(): void {
    if (this.#closeAspectTip()) return;
    if (areaOf(this.#route?.focused ?? null, this.#areas) === "list") {
      this.#jumpAreas(true);
      return;
    }
    if (this.#drill.packId !== null) this.#drillOut();
    else this.#back();
  }

  /**
   * Y toggles focus between the filters and the list (back to the row it left); B from the list goes to the filters and
   * scrolls the list to its start (`view/focus-areas.ts`).
   */
  #jumpAreas(fromBack: boolean): void {
    // B from the list with the chips folded opens them first, so there is a row to land on.
    if (this.#chipsFolded) {
      this.#padFilters.open();
      this.#rebuild();
    }
    const focus = this.#route?.focused ?? null;
    const target = fromBack ? this.#areaJump.toFilters(focus, this.#areas) : this.#areaJump.toggle(focus, this.#areas);
    if (target === null) return;
    if (fromBack) this.#scroller()?.scrollTo({ top: 0 });
    this.#route?.focusKey(target);
  }

  /** LB / RB: the seat being edited steps to the previous or next one; the hero list then fills that seat. */
  #stepSeat(direction: 1 | -1): void {
    const next = steppedSeatIndex(this.#draft, direction, MAX_SEATS);
    if (next === this.#draft.activeSeatIndex) return;
    this.#draft = setActiveSeat(this.#draft, next);
    this.#rebuild();
  }

  /** X: clears the focused seat tile's seat (or the active seat), the same as its ✕; the last hero stays. */
  #clearSeatByPad(): void {
    const index = seatToClear(this.#draft, this.#route?.focused ?? null);
    if (index === null) return;
    this.#draft = clearSeat(this.#draft, index);
    this.#rebuild();
  }

  /**
   * Y (or the Filters button) while a controller is in use: shows the chips, or folds them away again. Opening moves
   * focus to the first chip, remembering the tile it left; folding from a chip returns to that tile.
   */
  #toggleFilters(): void {
    const focus = this.#route?.focused ?? null;
    const opening = this.#chipsFolded;
    const onChip = focus?.startsWith("hero-chip") ?? false;
    this.#padFilters.toggle();
    this.#rebuild();
    // The ring follows a pad or keyboard user; a mouse press leaves focus alone (no ring appears for it).
    if (focus === null && !this.#padFilters.padMode) return;
    if (opening) {
      const target = this.#areaJump.toFilters(focus, this.#areas);
      if (target !== null) this.#route?.focusKey(target);
    } else if (onChip) {
      const target = this.#areaJump.toList(this.#areas);
      if (target !== null) this.#route?.focusKey(target);
    }
  }

  /** LT / RT: pages the shelf row focus is in, as its chevron would, and moves focus to the first card in view. */
  #pageRow(direction: 1 | -1): void {
    const shelfId = this.#shelfOfKey.get(this.#route?.focused ?? "");
    const element = this.#rosterRegion?.element;
    if (shelfId === undefined || !element) return;
    const first = element.pageShelf(shelfId, direction);
    if (first !== null) this.#route?.focusKey(first);
    this.#updateRosterHint();
  }

  #toggleSearch(): void {
    this.#searchOpen = !this.#searchOpen;
    // Shutting the field also clears its text: a filter whose field you can no longer see must not keep hiding
    // heroes. The aspect/source chips are their own visible controls and stay as they were.
    if (!this.#searchOpen && this.#draft.heroFilter.text) {
      this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, text: "" });
      this.#search.cancel();
      this.#ranking = null;
      this.#rankedFor = null;
    }
    this.#rebuild();
    if (this.#searchOpen) this.#focusField(SEARCH);
  }

  /** The roster's per-deck seating facts for the active seat, as the shelves and the deck submenu read them. */
  #activeRoster(deckOptions: readonly DeckOption[]): ReadonlyMap<string, ActiveSeatRosterEntry> {
    return new Map(
      activeSeatRosterOf(
        this.#seatOptionsExcludingActive(deckOptions),
        this.#draft.seats,
        this.#draft.activeSeatIndex,
      ).map((e) => [e.deckId, e]),
    );
  }

  /** The key a deck's tile groups under: its hero, or the deck itself while a search is typed (`heroGroupKeyOf`). */
  #groupKeyOf(option: DeckOption): string {
    return heroGroupKeyOf(this.#ranking !== null, option.deck.identityCardId as string, option.deck.id as string);
  }

  #groupOf(option: DeckOption): HeroDeckGroup<DeckOption> | undefined {
    return this.#heroGroups.get(this.#groupKeyOf(option));
  }

  /**
   * What the search looks in for each deck (view/deck-search.ts): names first, then aspects, source, pack, author and
   * tags, and a community deck's write-up last. Sent to the worker only when the deck list changes.
   */
  #searchDocumentOf(option: DeckOption, heroPack: string | undefined): SearchDocument {
    const deck = option.deck;
    const identity = currentCardsById().get(deck.identityCardId as string);
    const hero = identity?.type === "hero_identity" ? identity : undefined;
    const entry = testedEntryOf(deck, testedCatalog());
    const packs = heroPack
      ? [packNameOf(heroPack), currentHeroShelfPacks().find((p) => p.code === heroPack)?.cycleName]
      : [];
    return {
      id: deck.id as string,
      primary: [
        deck.name,
        deckDisplayName(deck),
        option.identityName,
        identityLabelOf(option),
        hero?.hero.faceName,
        hero?.alterEgo.faceName,
        entry?.heroName,
      ].filter((t): t is string => typeof t === "string"),
      secondary: [
        ...seatSearchWordsOf(deck.aspects, deck.source.kind, entry !== undefined),
        ...packs.filter((t): t is string => typeof t === "string"),
        ...testedSearchFieldsOf(deck, testedCatalog()),
        ...(entry?.tags ?? []),
      ],
      notes: entry ? [entry.description] : [],
    };
  }

  /** Hands the worker the deck list when it has changed, and re-asks the open query of the new list. */
  #syncSearchDocuments(deckOptions: readonly DeckOption[]): void {
    if (this.#searchDocsFor === deckOptions) return;
    this.#searchDocsFor = deckOptions;
    const heroPacks = heroPacksOf(
      deckOptions,
      (option) => option.deck.identityCardId as string,
      (option) => (option.deck.source.kind === "precon" ? (option.deck.source.packCode as string) : null),
    );
    const documents = deckOptions.map((option) =>
      this.#searchDocumentOf(option, heroPacks.get(option.deck.identityCardId as string)),
    );
    this.#search.setDocuments(documents, POOL_VERSION + ":" + deckOptions.map((o) => o.deck.id as string).join("|"));
    const text = this.#draft.heroFilter.text;
    // After this redraw, not inside it: the answer redraws again.
    if (text.trim() !== "") queueMicrotask(() => this.sys.isActive() && this.#requestSearch(text));
  }

  /** The search field's debounced text: the filter holds it and the worker ranks the decks for it. */
  #onSearch(text: string): void {
    this.#draft = setHeroFilter(this.#draft, { ...this.#draft.heroFilter, text });
    this.#requestSearch(text);
  }

  /** Asks the worker to rank the decks for the text; the screen redraws when the newest answer arrives. An empty text clears the search at once. */
  #requestSearch(text: string): void {
    if (text.trim() === "") {
      this.#search.cancel();
      this.#ranking = null;
      this.#rankedFor = null;
      this.#rebuild();
      return;
    }
    this.#search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#ranking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#rankedFor = text;
      this.#rebuild();
    });
  }

  /**
   * Random (#911): seats a random hero in the active seat, from the heroes the roster lets the player take right now.
   * Nothing is decided here: a deck qualifies by the roster's own checks (`seatable`, so legal and not a hero that is
   * not ready; `#seatOptionsExcludingActive`, so not a hero already at another seat and not locked; the chips and the
   * search; a shelf drilled into one pack does not narrow it, as it does not narrow Recommended), and the seat's own hero is left out so Random always changes it.
   */
  #randomHeroCandidates(
    deckOptions: readonly DeckOption[],
    seating: ReadonlyMap<string, SeatOption>,
  ): readonly RandomHeroCandidate[] {
    const ownDeckId = this.#draft.seats[this.#draft.activeSeatIndex];
    return randomHeroCandidatesOf(
      deckOptions,
      (deckId) => seating.get(deckId)?.blockedBy ?? null,
      this.#draft.heroFilter,
      this.#ranking,
      ownDeckId ? this.#identityOfDeck.get(ownDeckId) : undefined,
      this.#rankedFor,
    );
  }

  #randomHero(): void {
    const deckOptions = this.#deckOptions();
    const seating = new Map(this.#seatOptionsExcludingActive(deckOptions).map((o) => [o.deckId, o]));
    const deckId = randomHeroDeck(this.#randomHeroCandidates(deckOptions, seating), Math.random);
    if (deckId === null) return;
    this.#draft = assignToActiveSeat(this.#draft, deckId);
    this.#rebuild();
  }

  /** A hero tile tapped: one matching deck seats as it always did; several open the deck submenu. */
  #onHeroTile(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    const group = this.#groupOf(option);
    if (group && group.decks.length > 1) {
      this.#openDeckSheet(group);
      return;
    }
    this.#pickHero(option, active);
  }

  /** "Pick a deck" (`scenes/hero-decks-sheet.ts`): a row per matching deck; a pick runs `#pickHero`, the code a single tile's tap runs. */
  #openDeckSheet(group: HeroDeckGroup<DeckOption>): void {
    if (this.scene.isActive(SCENES.heroDecks)) return;
    const deckOptions = this.#deckOptions();
    const active = this.#activeRoster(deckOptions);
    const identityId = group.rep.deck.identityCardId as string;
    const rows = group.decks.map((option) => {
      const entry = active.get(option.deck.id as string);
      const deck = option.deck;
      return {
        row: heroDeckRowOf({
          deckId: deck.id as string,
          name: titleWithoutAspects(deckDisplayName(deck).split(" — ")[0]!, deck.aspects),
          sourceKind: deck.source.kind,
          testedCredit: testedSubtitleOf(deck, testedCatalog()),
          cardCount: deck.cards.reduce((sum, card) => sum + card.quantity, 0),
          blockedBy: reasonOrNull(entry?.blockedBy ?? option.blockedReason),
          lock: deckLockOf(deck),
          warning: shortWarningOf(entry?.warning ?? option.warning, artLanguageNow()),
          activeSeat: entry?.isActiveSeat ?? false,
          otherSeat:
            entry?.seatIndex !== null && entry?.seatIndex !== undefined && !entry.isActiveSeat
              ? entry.seatIndex + 1
              : null,
        }),
        stamps: aspectStampsOf(deck.aspects, artLanguageNow()),
      };
    });
    this.scene.launch(SCENES.heroDecks, {
      from: this.scene.key,
      heroName: identityLabelOf(group.rep) ?? deckDisplayName(group.rep.deck),
      identityCardId: identityId,
      picture: this.#heroPictureFor(identityId),
      rows,
      onPick: (deckId) => {
        if (!this.sys.isActive()) return;
        const options = this.#deckOptions();
        const option = options.find((o) => (o.deck.id as string) === deckId);
        if (option) this.#pickHero(option, this.#activeRoster(options));
      },
    } satisfies HeroDecksSheetData);
  }

  #pickHero(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    const entry = active.get(option.deck.id as string);
    if (this.#offerUnlock(option)) return;
    if (entry?.blockedBy) return;
    this.#draft = assignToActiveSeat(this.#draft, option.deck.id as string);
    this.#rebuild();
  }

  /**
   * The hero's own artwork (`art/heroes/`, `art/hero-art.ts`), picked once per visit so a redraw doesn't reshuffle a
   * hero with several pictures. A hero printed as more than one identity card (Ironheart's three versions) shares
   * the picture filed under any of them: same name, same set. Card or Promo art (`Settings.heroArt`) goes first.
   */
  #heroPictureFor(identityId: string): Picture | null {
    // An installed pack's own hero picture (`pack.json` `pictures.hero`): resolved from the store, so not cached here.
    if (isCustomCard(identityId)) return packPictureFor("hero", identityId);
    const { choice, earned } = this.#tileArt;
    const chosen = heroTilePicture(choice, currentCardsById().get(identityId), earned, appSession().settings.promoArt);
    if (chosen) return chosen;
    if (!this.#heroArtCache.has(identityId)) {
      this.#heroArtCache.set(identityId, heroArtForIdentity(HERO_ART, identityId, currentPool()));
    }
    return this.#heroArtCache.get(identityId) ?? null;
  }

  /** The hero tiles the Recommended shelf and the detail panel's "why" read: one analysis per redraw. */
  #seatInsights(deckOptions: readonly DeckOption[], seating: ReadonlyMap<string, SeatOption>): SeatInsights {
    const seated = this.#draft.seats
      .map((id) => deckOptions.find((o) => (o.deck.id as string) === id)?.deck)
      .filter((deck): deck is Deck => deck !== undefined);
    const ranking = this.#ranking;
    const candidates = takeableHeroesOf(
      deckOptions,
      (deckId) => seating.get(deckId)?.blockedBy ?? null,
      this.#draft.heroFilter,
      ranking,
    ).map(({ option, shown }) => ({ deck: option.deck, shown }));
    return seatInsightsOf({
      seated,
      activeSeatIndex: this.#draft.activeSeatIndex,
      candidates,
      pool: currentCardsById(),
      catalog: seatPairCatalog(),
      limit: REC_LIMIT,
    });
  }

  #shelves(
    deckOptions: readonly DeckOption[],
    seating: ReadonlyMap<string, SeatOption>,
    active: ReadonlyMap<string, ActiveSeatRosterEntry>,
  ): readonly Shelf<DeckOption>[] {
    const heroPacks = heroPacksOf(
      deckOptions,
      (option) => option.deck.identityCardId as string,
      (option) => (option.deck.source.kind === "precon" ? (option.deck.source.packCode as string) : null),
    );
    const candidates: ShelfCandidate<DeckOption>[] = withSelectionPinned(
      deckOptions,
      () => true,
      (option) => active.get(option.deck.id as string)?.isActiveSeat ?? false,
    ).map((option) => {
      // A hero's saved and community decks sit on the shelf of the hero's own pack, beside its precons: one tile per hero.
      const packCode = heroPacks.get(option.deck.identityCardId as string) ?? null;
      const chipsOk = this.#heroPassesChips(option, seating.get(option.deck.id as string)?.blockedBy ?? null);
      return {
        item: option,
        packCode,
        searchHaystacks: [],
        passesChips: chipsOk && (this.#ranking === null || this.#ranking.has(option.deck.id as string)),
      };
    });
    // "By wave" (default): one shelf per release wave (Core, Wave 1, The Rise of Red Skull, The Galaxy's Most
    // Wanted, …) rather than one per pack — a campaign box's own heroes and the hero packs FFG ships alongside it
    // land on the same shelf, replacing the old one-shelf-per-single-hero-pack "Hero packs" catch-all.
    // "A–Z": the same candidates, flattened into one letter-headed run by hero name (the roster's own sort
    // toggle) — see `azShelvesOf`'s own doc comment for why letter shelves over a single long row or a grid.
    const shelves =
      this.#draft.heroSortMode === "az"
        ? azShelvesOf(
            candidates,
            "",
            (option) => option.identityName ?? option.deck.name,
            (option) => option.deck.name,
          )
        : cycleShelvesOf(candidates, currentHeroShelfPacks(), "");
    // One tile per hero: the decks that pass the filters fold into it, and a tap on it opens them (`#onHeroTile`).
    const grouped = groupShelvesByHero(
      withTestedShelf(shelves, (option) => isCommunityDeckId(option.deck.id as string)),
      (option) => this.#groupKeyOf(option),
      (option) => {
        const entry = active.get(option.deck.id as string);
        if (entry?.isActiveSeat) return 4;
        if (entry?.seatIndex !== null && entry?.seatIndex !== undefined) return 3;
        const lock = deckLockOf(option.deck);
        return !entry?.blockedBy && !lock ? 2 : !lock ? 1 : 0;
      },
    );
    this.#heroGroups = grouped.groups;
    // A search puts the best match first, within each shelf and among the shelves.
    const ranking = this.#ranking;
    const ordered = ranking
      ? rankShelvesByScore(grouped.shelves, (option) => ranking.get(option.deck.id as string) ?? 0)
      : grouped.shelves;
    // The shelves the player folded show as their header alone (#753), unless a search or chip is narrowing the list.
    const filter = this.#draft.heroFilter;
    const filtering = ranking !== null || !!filter.aspect || !!filter.source || !!filter.playableOnly;
    return foldShelves(ordered, this.#folded, filtering);
  }

  #toggleFold(shelfId: string): void {
    this.#folded = toggleShelfFold(this.#folded, shelfId);
    saveShelfFolds("seats", this.#folded);
    this.#rebuild();
  }

  #heroPassesChips(option: DeckOption, blockedBy: string | null): boolean {
    return heroPassesChips(option.deck, this.#draft.heroFilter, blockedBy);
  }

  /** The "i" segment's toggle for an aspect chip with a tip (`aspectTipContentOf`); undefined when it has none. */
  #aspectInfoOf(aspect: CoreAspect): ChipInfoToggle | undefined {
    if (!aspectTipContentOf(aspect)) return undefined;
    return {
      isOpen: this.#aspectTipOpen === aspect,
      pressOnly: true,
      onOpen: () => {
        this.#aspectTipOpen = aspect;
        this.#rebuild();
      },
      onClose: () => {
        this.#aspectTipOpen = null;
        this.#rebuild();
      },
    };
  }

  #heroChipDefs(deckOptions: readonly DeckOption[]): readonly HeroChipDef[] {
    // Each aspect chip wears its aspect's printed card-frame color (`view/aspect-stamp.ts`), the same stamp the
    // hero cards below carry, so "filter by Justice" and "this deck is Justice" read as one color.
    const aspectChips: HeroChipDef[] = heroAspectsOf(deckOptions.map((option) => option.deck)).map((aspect) => ({
      ...withInfo(this.#aspectInfoOf(aspect as CoreAspect)),
      id: `aspect:${aspect}`,
      text: aspectLabelOf([aspect], artLanguageNow()),
      selected: this.#draft.heroFilter.aspect === aspect,
      tint: { fill: aspectStampOf(aspect).fill, ink: aspectStampOf(aspect).ink },
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, {
          ...this.#draft.heroFilter,
          aspect: this.#draft.heroFilter.aspect === aspect ? null : aspect,
        });
        this.#rebuild();
      },
    }));
    const sources: readonly { kind: HeroSourceFilter; text: string }[] = [
      { kind: "precon", text: t("deckSource.precon") },
      { kind: "imported", text: t("deckSource.imported") },
      { kind: "userBuilt", text: t("deckSource.built") },
      { kind: "tested", text: t("deckSource.tested") },
    ];
    const sourceChips = sources.map(({ kind, text }) => ({
      id: `source:${kind}`,
      text,
      selected: this.#draft.heroFilter.source === kind,
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, {
          ...this.#draft.heroFilter,
          source: this.#draft.heroFilter.source === kind ? null : kind,
        });
        this.#rebuild();
      },
    }));
    const playableChip = {
      id: "playable-now",
      text: t("seats.playableNow"),
      selected: this.#draft.heroFilter.playableOnly === true,
      onClick: () => {
        this.#draft = setHeroFilter(this.#draft, {
          ...this.#draft.heroFilter,
          playableOnly: !this.#draft.heroFilter.playableOnly,
        });
        this.#rebuild();
      },
    };
    return [...aspectChips, ...sourceChips, playableChip, ...this.#heroSortChipDefs()];
  }

  /**
   * "By wave" / "A–Z" — a segmented pair, not another filter chip: unlike every other chip here (which toggles a
   * narrowing on or off, all independently), exactly one of this pair is selected at all times, and clicking the
   * one already selected does nothing (there's no "off" state to fall back to). Built from the same `HeroChipDef`
   * shape as the filter chips above so it shares their exact drawing, wrapping and focus-order wiring — appended
   * at the row's own end, matching the brief's "segmented pair at the end of the row".
   */
  #heroSortChipDefs(): readonly HeroChipDef[] {
    const modes: readonly { readonly mode: HeroSortMode; readonly text: string }[] = [
      { mode: "wave", text: t("seats.sortWave") },
      { mode: "az", text: t("seats.sortAz") },
    ];
    return modes.map(({ mode, text }) => ({
      id: `sort:${mode}`,
      text,
      selected: this.#draft.heroSortMode === mode,
      onClick: () => {
        if (this.#draft.heroSortMode === mode) return;
        this.#draft = setHeroSortMode(this.#draft, mode);
        this.#rebuild();
      },
    }));
  }

  /**
   * A locked precon, tapped: offer to unlock it with champion points (`scenes/unlock-confirm.ts`), and seat it once
   * it's paid for. False when the deck isn't locked, so the tap goes on as usual.
   */
  #offerUnlock(option: DeckOption): boolean {
    if (!deckLockOf(option.deck)) return false;
    // A tested deck can also be shut by a card's wave, which champion points on its hero do not open: it stays blocked.
    if (testedEntryOf(option.deck, testedCatalog()) && !unlocks().heroLock(option.deck.identityCardId as string))
      return false;
    const deckId = option.deck.id as string;
    unlockOrAsk(this, { kind: "hero", identityCardId: option.deck.identityCardId as string }, () => {
      if (!this.sys.isActive()) return;
      this.#draft = assignToActiveSeat(this.#draft, deckId);
      this.#rebuild();
    });
    return true;
  }

  #onInspectChoose(rowId: string): void {
    const deckOptions = this.#deckOptions();
    const option = deckOptions.find((o) => (o.deck.id as string) === rowId);
    const group = option ? this.#groupOf(option) : undefined;
    if (group && group.decks.length > 1) {
      this.#openDeckSheet(group);
      return;
    }
    if (option && this.#offerUnlock(option)) return;
    const seating = new Map(this.#seatOptionsExcludingActive(deckOptions).map((o) => [o.deckId, o]));
    if (option && !seating.get(rowId)?.blockedBy) {
      this.#draft = assignToActiveSeat(this.#draft, rowId);
      this.#rebuild();
    }
  }

  #inspectOption(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    const entry = active.get(option.deck.id as string);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId as CardId, face: { kind: "hero" } },
      ...(entry?.blockedBy
        ? { note: reasonLabelOf(entry.blockedBy, artLanguageNow()) }
        : {
            choice: {
              optionId: option.deck.id as string,
              label: entry?.isActiveSeat
                ? t("seats.alreadyPick")
                : (this.#groupOf(option)?.decks.length ?? 1) > 1
                  ? t("seats.pickDeck")
                  : t("seats.takeSeat"),
            },
          }),
    });
  }
}

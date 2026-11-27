/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2/W2b, D02/P02): a
 * searchable pack-shelf roster of every scenario in the pool (S8, the owner's
 * pack-shelves decision), drill-in to one pack as a full grid (the owner's
 * second-pass "drill into the packs" ask), a full-height detail panel for
 * whichever scenario is selected (stage boxes, the played record, data only —
 * §4: no blurb), Back to the Title menu, and "Choose heroes ▸" into
 * `SeatsScene`.
 *
 * Everything on the screen is a Lit panel over the canvas (`dom/dom-region.ts`): one sheet for the top bar, the search
 * and the chips, the Random buttons, the stat strip and the ink stages panel with its Choose heroes button; and the
 * shelves (`mc-shelf-roster`) as a panel of their own over it, scrolling natively (down the shelves, sideways along a
 * row). The scene keeps the focus route (its ring drawn in the panel layer), the card hover popover and the ground.
 * Tiles draw the build-time roster-size copy of a villain's picture (`art/scenario-art.ts` `tileUrl`), never the full
 * picture.
 */
import Phaser from "phaser";
import "@mc/ui";
import type {
  McSearchField,
  McShelfRoster,
  McSheet,
  PictureSource,
  ShelfRosterItem,
  ShelfRosterModel,
  ShelfRosterShelf,
} from "@mc/ui";
import { reportRoomSetup } from "./room-setup-report.js";
import { leaveRoomSetup, placeholderSeats, roomSeatCount, roomSetupActive } from "../view/room-table-setup.js";
import type { TableSetupData } from "./table-setup.js";
import type { CardId, Deck, Scenario } from "@mc/content";
import {
  CUSTOM_SHELF_ID,
  POOL_PACKS,
  currentCardsById,
  currentEncounterSets,
  currentPoolKey,
  currentScenarios,
  isPackScenario,
  packNameOf,
} from "../content/pool.js";
import { PackLeases, packPictureFor, refreshPackArt } from "../art/pack-art.js";
import { customBadge } from "../view/custom-content.js";
import { placeScenarioShelves } from "../packs/custom-placement.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { customContentPrefsNow } from "../packs/custom-content-prefs.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { ART_CATALOG, packCoverFor, villainArtFor } from "../art/scenario-art.js";
import type { Picture } from "../art/pictures.js";
import { artFor } from "../art/art-source.js";
import { hasRandomChosenVillain } from "../view/random-villain.js";
import { hit, ink, surface, typeRole } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { lockCaptionOf, scenarioDetailOf, shelfSubtitleOf } from "../view/scenario-detail.js";
import { foeWord } from "../view/foe-words.js";
import { selectionAmongVisible } from "../view/scenario-selection.js";
import { scenarioProductsOf, withSelectionPinned } from "../view/roster-filter.js";
import { CHIP_GAP, compactChipWidthOf, packCompactChipsToRows } from "../view/chip-layout.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { rankShelvesByScore } from "../view/deck-search.js";
import { scenarioSearchDocumentOf } from "../view/scenario-search.js";
import { shelvesOf, flattenShelves, type Shelf, type ShelfCandidate } from "../view/roster-shelves.js";
import { ALL_PACKS, drillIntoPack, drillOut, type ShelfDrillState } from "../view/shelf-drill.js";
import { padInputTracked } from "../platform/input-device.js";
import { resultsHistoryOf, type ScenarioRecord } from "../view/results-history.js";
import { setScenario, setScenarioFilter, clearScenarioFilter, type SetupDraft } from "../view/setup-draft.js";
import {
  isCivilWarScenario,
  customizeEntryOf,
  enterBuilder,
  setBuilderOrigin,
  isBuilderTile,
  shelvesWithBuilderTile,
  type RosterEntry,
} from "../view/civil-war-entry.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import { scenarioSelectFocusOrder } from "../view/screen-focus.js";
import { FOOTER_HEIGHT, scenarioSelectLayout, type ScenarioSelectLayout } from "../view/scenario-select-layout.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { PadFilters } from "./pad-filters.js";
import { filtersLabel, SCENARIO_FILTERS_BREAKPOINT } from "../view/filters-layout.js";
import {
  foldShelves,
  loadShelfFolds,
  openShelfItems,
  saveShelfFolds,
  shelfFocusKeys,
  toggleShelfFold,
  unfoldShelf,
} from "../view/shelf-folds.js";
import { randomBox, randomScenario, randomVillainIn } from "../view/scenario-random.js";
import { bindExtraInput } from "./extra-input.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { AreaJump, areaOf, type FocusAreas } from "../view/focus-areas.js";
import { SCENES } from "./keys.js";
import type { SeatsData } from "./seats.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { artLanguageNow } from "../art/art-source.js";
import { t, tPlural } from "../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { refreshUnlocks, unlocks } from "../progression/progression.js";
import { unlockCostOf, unlockOrAsk } from "./unlock-confirm.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { sheetTopBar } from "../dom/sheet-top-bar.js";
import { drawSidePanel, drawStatStrip } from "../dom/scenario-panels.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { campaignFrame } from "../ui/campaign-chrome.js";

export interface ScenarioSelectData {
  readonly draft: SetupDraft;
  /** Decks Take your seats should know before its own list loads (Decks & Collection's "Play this deck"). */
  readonly seedDecks?: readonly Deck[];
}

/** The stops that are the filters (search and the product chips), and the ones that are the list. */
const FILTER_STOP = /^(scenario-search-toggle|scenario-search|filters-toggle|scenario-chip:.*)$/;
const LIST_STOP = /^(drill-back|random-.*|scenario-clear|scenario:.*|scenario-shelf:.*)$/;
/** The row above the list that holds its Random buttons (and, drilled into a box, "◂ All packs"). */
const RANDOM_ROW_HEIGHT = 36;
const RANDOM_BUTTON_WIDTH = 150;
/** The search field's key in the sheet. */
const SEARCH = "scenario-search";
/** The room the Inspect hint takes beside the Filters button (a pad on a wide screen), and its gap. */
const INSPECT_HINT_WIDTH = 104;
const HINT_GAP = 8;
/** A shelf header's height in the roster panel (`mc-shelf-roster`). */
const SHELF_HEADER = 44;
/** The caption strip of a scenario tile: a display title over a two-line label. */
const TILE_CAPTION = 76;
/** The scrollbar's room beside the roster (`SCROLL_GUTTER` in `@mc/ui`). */
const ROSTER_GUTTER = 8;
const PAGE = 0.85;

interface TileMetrics {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly cardGap: number;
}

const scenarioCountCaption = (count: number): string => tPlural("scenario.countCaption", count);

/** Where the shelves were scrolled to, kept outside the scene: a trip to Take your seats and back stops and starts it. */
let scrollMemory: { readonly top: number; readonly rows: Readonly<Record<string, number>> } = { top: 0, rows: {} };

export class ScenarioSelectScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #alive = false;
  #stops = new Map<string, FocusStop>();
  /** What each key in the panels does when tapped, this compose. */
  #actions = new Map<string, () => void>();
  /** What a hold or right-click on a tile does, by its `entry:<id>` key. */
  #inspects = new Map<string, () => void>();
  /** Whether the phone's stages panel is open. Shut by default: it is reading, not choosing, and it crowds a small screen. */
  #stagesOpen = false;
  /** Narrow only: whether the search field is shown (`ScenarioSelectLayout.searchToggle`). Off by default — the roster gets the row. */
  #searchOpen = false;
  /** Text search runs in a worker (view/deck-search-client.ts); #ranking is its last answer, shown until the next one arrives. Null when no search is active. */
  readonly #search = new DeckSearchClient();
  #ranking: ReadonlyMap<string, number> | null = null;
  /** The panels: the sheet (everything but the shelves) and the shelves over it. */
  #sheet: DomRegion<McSheet> | null = null;
  #roster: DomRegion<McShelfRoster> | null = null;
  readonly #leases = new PackLeases();
  /** The desktop hover popover over the scenario tiles (`ui/card-hover-preview.ts`). */
  #hover: HoverPreview | null = null;
  /** The box the shelves scroll in, on screen: what a hover popover is clipped to. */
  #listView: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** Whether "Choose heroes" can be pressed now, for the route's primary stop (Start). */
  #canContinue = false;
  /** A screen change is under way (Back, Choose heroes): later presses do nothing. */
  #leaving = false;
  /** The columns of the open box's grid, for the row a tile sits in. */
  #route: FocusRoute | null = null;
  /** The filters and the list as two areas of the route, for Y and B (`view/focus-areas.ts`). */
  readonly #areaJump = new AreaJump();
  #areas: FocusAreas = { filters: [], entry: null, list: [] };
  /** The key and button glyphs the sheet shows beside its controls (pad or keyboard only). */
  #glyphs!: SheetGlyphs;
  /** The chips fold away while a controller is in use (`view/pad-filters.ts`). */
  #padFilters!: PadFilters;
  /** Each scenario tile's shelf and place in it, by focus key, for LT / RT. */
  readonly #rowOfKey = new Map<string, { readonly shelfId: string; readonly itemIndex: number }>();
  /** Whether the last compose folded the chips, so Y knows whether it opens or folds them. */
  #chipsFolded = false;
  #drill: ShelfDrillState = ALL_PACKS;
  /** The shelves folded to their header, remembered across visits (#753). */
  #folded: ReadonlySet<string> = loadShelfFolds("scenario-select");
  /** A scenario a Random just picked: scrolled to once the compose has drawn its shelf. */
  #revealId: string | null = null;
  /** Every scenario's played record, keyed by scenario id, so the side panel reads the *current* selection's row on each redraw (issue 141). */
  #history: ReadonlyMap<string, ScenarioRecord> = new Map();
  /** The record line last drawn in the side panel, for the dev e2e hook only. */
  #recordText = "";
  /** The focus key of the topmost scenario tile as of the last compose, where focus starts on arrival. */
  #firstTileKey: string | null = null;
  readonly #artCache = new Map<string, Picture | null>();
  /** Dev e2e hook only: every tile drawn so far (see `create`). */
  readonly #tileDebug = new Map<string, { id: string; title: string; villainArt: boolean; baked: boolean }>();
  readonly #coverCache = new Map<string, Picture | null>();
  #seedDecks: readonly Deck[] = [];
  /** The sheets whose text field this scene already listens to. */
  readonly #bound = new WeakSet<HTMLElement>();
  /** The scroll position was put back (once a visit). */
  #restored = false;

  constructor() {
    super(SCENES.scenarioSelect);
  }

  init(data: ScenarioSelectData): void {
    this.#draft = data.draft;
    this.#seedDecks = data.seedDecks ?? [];
    this.#sheet = null;
    this.#roster = null;
    this.#restored = false;
  }

  create(): void {
    this.#alive = true;
    this.#leaving = false;
    reportRoomSetup("scenario");
    // The scene is reused: a visit starts on the full shelf list with the stages panel shut.
    this.#drill = ALL_PACKS;
    this.#stagesOpen = false;
    this.#glyphs = new SheetGlyphs(this, () => this.#compose());
    this.#padFilters = new PadFilters(this, () => this.#compose(), SCENARIO_FILTERS_BREAKPOINT);
    this.#padFilters.reset();
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    this.scale.on("resize", this.#compose, this);
    // A pack picture that resolves later (its pack has loaded) draws in place of the plain ground; a language switch
    // (#390) reads the screen again in the new language.
    const artOff = onArtChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    const languageOff = onLanguageChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    // Dev e2e hook (never referenced by product code): the tiles drawn so far (their printed title, whether the
    // scenario has villain art of its own, whether its tile has a picture) and every control's rect.
    if (import.meta.env.DEV) {
      this.#tileDebug.clear();
      (window as unknown as { __mcScenarioSelectDebug?: unknown }).__mcScenarioSelectDebug = {
        tiles: () => [...this.#tileDebug.values()],
        selectedId: () => (this.#scenarioPicked() ? this.#draft.scenarioId : null),
        folded: () => [...this.#folded],
        drilledPack: () => this.#drill.packId,
        listRect: () => this.#listView,
        recordText: () => this.#recordText,
        hoverKey: () => this.#hover?.shownKey ?? null,
        stops: () =>
          [...this.#stops].map(([key, stop]) => ({
            key,
            ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
          })),
      };
    }
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#field(SEARCH)?.focused ?? false }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#compose, this);
      artOff();
      languageOff();
      this.#glyphs.dispose();
      this.#leases.dispose();
      this.#search.destroy();
      // The panels go with the scene (`DomRegion`); the next visit makes new ones.
      const rows = this.#roster?.element.readScroll();
      if (rows) scrollMemory = rows;
      this.#sheet = null;
      this.#roster = null;
    });
    const covered = (): boolean => this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.unlockConfirm);
    // A pad that put the caret in the search field can take it out again (B, A or Start).
    bindTextFieldEscape(this, () => this.#field(SEARCH), covered);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // The LT / RT glyphs belong to the row focus is in.
      onFocusChange: () => this.#glyphs.refresh(),
      blocked: () => covered() || (this.#field(SEARCH)?.focused ?? false),
      // B from the list returns to the filters (scrolled back to the top); from the filters it backs out.
      // Y is the filters' fold while a controller is in use (the keyboard's Inspect key is unchanged); View inspects.
      onInspect: (source) => {
        if (source === "key" || !this.#padFilters.padMode) return false;
        this.#toggleFilters();
        return true;
      },
      // LT / RT page the focused row, like its ‹ / › chevrons.
      onTrigger: (trigger) => this.#pageRow(trigger === "lt" ? -1 : 1),
      onCancel: () => {
        if (areaOf(this.#route?.focused ?? null, this.#areas) === "list") {
          this.#jumpAreas(true);
          return;
        }
        if (this.#drill.packId !== null) this.#drillOut();
        else this.#back();
      },
      // Start / Menu (and A with nothing focused) is "Choose heroes ▸".
      primary: () => (this.#canContinue ? "next" : null),
      // The right stick, PageUp / PageDown and Home / End scroll the shelves, or the stages sheet when it is open.
      onScroll: (_dx, dy) => this.#roster?.element.scroller?.scrollBy({ top: dy }),
      onPage: (direction) => {
        const scroller = this.#roster?.element.scroller;
        scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
      },
      onHomeEnd: (edge) =>
        this.#roster?.element.scroller?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    bindExtraInput(this, {
      blocked: () => covered() || (this.#field(SEARCH)?.focused ?? false),
      intents: {
        view: () => {
          const key = this.#route?.focused ?? null;
          if (this.#padFilters.padMode && key?.startsWith("scenario:")) this.#route?.inspectFocused();
        },
      },
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
    });
    const setSearchDocuments = (): void => {
      this.#search.setDocuments(
        currentScenarios().map((s) =>
          scenarioSearchDocumentOf(s, currentCardsById(), currentEncounterSets(), packNameOf),
        ),
        currentPoolKey() + ":scenarios",
      );
    };
    setSearchDocuments();
    // Packs load a moment after boot and change in the Mod Store: their scenarios appear (or go) under this screen.
    rebuildOnPackChange(this, () => {
      setSearchDocuments();
      this.#compose();
    });
    this.#compose();
    // Arriving by pad, focus is on the picked villain (coming back from Seats) or else the topmost one; a mouse or
    // touch player gets no ring, which would read as a preselection.
    if (padInputTracked()) {
      const picked = this.#scenarioPicked() ? `scenario:${this.#draft.scenarioId}` : null;
      const key = picked !== null && this.#stops.has(picked) ? picked : this.#firstTileKey;
      if (key !== null) this.#route?.focusKey(key);
    }
    if (this.#draft.scenarioFilter.text.trim() !== "") this.#requestSearch(this.#draft.scenarioFilter.text);
    fadeScreenIn(this);
    void refreshUnlocks().then((changed) => {
      if (changed && this.sys.isActive()) this.#compose();
    });
    void appSession()
      .store.listSaves()
      .then((saves) => {
        if (!this.sys.isActive()) return;
        this.#history = new Map(resultsHistoryOf(saves).scenarios.map((r) => [r.scenarioId, r]));
        this.#compose();
      });
  }

  /** False on a fresh New game until the player taps a villain (`SetupDraft.scenarioPicked`). */
  #scenarioPicked(): boolean {
    return this.#draft.scenarioPicked !== false;
  }

  /** The search field of the sheet, for its caret. */
  #field(key: string): McSearchField | null {
    return (this.#sheet?.element.elementOf(key) as McSearchField | null) ?? null;
  }

  #back(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#compose, this);
    // Room mode (#880): the host set the table up from the lobby, and Back returns there.
    if (roomSetupActive()) {
      leaveRoomSetup();
      goToScreen(this, SCENES.roomLobby);
      return;
    }
    goToScreen(this, SCENES.title);
  }

  /** Whether a search or a chip is narrowing the list: folds are set aside so every match shows. */
  #filtering(): boolean {
    return this.#ranking !== null || !!this.#draft.scenarioFilter.product;
  }

  #toggleFold(shelfId: string): void {
    this.#folded = toggleShelfFold(this.#folded, shelfId);
    saveShelfFolds("scenario-select", this.#folded);
    this.#compose();
  }

  readonly #isScenarioEntry = (entry: RosterEntry): entry is Scenario => !isBuilderTile(entry);

  /** What Random may land on: a scenario that is on offer now, so not the builder tile and not one still locked. */
  readonly #isRandomPick = (entry: RosterEntry): boolean =>
    !isBuilderTile(entry) && unlocks().scenarioLock(entry) === null;

  /** Step one: a random box of the ones showing, opened as its own grid of villains. */
  #randomBox(): void {
    const shelf = randomBox(this.#shelves(), this.#isRandomPick, Math.random);
    if (!shelf) return;
    this.#drill = drillIntoPack(shelf.id);
    this.#compose();
  }

  /** Both steps at once: a random box, then a random villain in it, picked. */
  #randomScenario(): void {
    const pick = randomScenario(this.#shelves(), this.#isRandomPick, Math.random);
    if (pick && this.#isScenarioEntry(pick.item)) this.#pickRandom(pick.shelf.id, pick.item);
  }

  /** Step two: a random villain of the box that is open. */
  #randomVillain(): void {
    const shelf = this.#shelves().find((s) => s.id === this.#drill.packId);
    const item = shelf ? randomVillainIn(shelf, this.#isRandomPick, Math.random) : null;
    if (shelf && item && this.#isScenarioEntry(item)) this.#pickRandom(shelf.id, item);
  }

  /** Picks what Random landed on, opening its shelf if it was folded so the pick is seen. */
  #pickRandom(shelfId: string, entry: Scenario): void {
    if (this.#folded.has(shelfId)) {
      this.#folded = unfoldShelf(this.#folded, shelfId);
      saveShelfFolds("scenario-select", this.#folded);
    }
    this.#revealId = entry.id as string;
    this.#activateEntry(entry);
  }

  /** After a Random pick, brings its tile into view (and the pad's focus onto it). */
  #revealPicked(): void {
    const id = this.#revealId;
    if (id === null) return;
    this.#revealId = null;
    this.#roster?.element.elementOf(`entry:${id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (padInputTracked() && this.#stops.has(`scenario:${id}`)) this.#route?.focusKey(`scenario:${id}`);
  }

  #drillOut(): void {
    this.#drill = drillOut();
    this.#compose();
  }

  #villainArtFor(scenario: Scenario): Picture | null {
    const id = scenario.id as string;
    if (!this.#artCache.has(id)) this.#artCache.set(id, villainArtFor(ART_CATALOG, id));
    return this.#artCache.get(id) ?? null;
  }

  #packCoverFor(packCode: string): Picture | null {
    if (!this.#coverCache.has(packCode)) this.#coverCache.set(packCode, packCoverFor(ART_CATALOG, packCode));
    return this.#coverCache.get(packCode) ?? null;
  }

  /** A panel part's box on screen now, scroll included; null when it is not drawn. */
  #liveRect(region: DomRegion<McSheet> | DomRegion<McShelfRoster> | null, key: string): Rect | null {
    const found = (region?.element as { elementOf(key: string): HTMLElement | null } | undefined)?.elementOf(key);
    return found && region ? region.rectOf(found) : null;
  }

  /** Wires a panel's region: presses reach `#actions`, a hold `#inspects`, a stale pack picture asks again, the mouse reaches the hover popover. */
  #wire<E extends McSheet | McShelfRoster>(element: E, rect: Rect): DomRegion<E> {
    element.addEventListener("mc-activate", (event) => {
      // Leaving already: a second tap must not act.
      if (this.#leaving) return;
      this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
    });
    element.addEventListener("mc-inspect", (event) => {
      if (this.#leaving) return;
      this.#inspects.get((event as CustomEvent<{ key: string }>).detail.key)?.();
    });
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
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

  #addAction(key: string, run: () => void): void {
    this.#actions.set(key, run);
  }

  /** Builds both panels from the current state and hands them over, and the focus stops that walk them. */
  #compose(): void {
    if (!this.#alive) return;
    this.#rowOfKey.clear();
    this.#actions = new Map();
    this.#inspects = new Map();
    this.#stops = new Map();
    this.#glyphs.reset();
    this.#leases.begin();
    resetHoverCards(this);

    const frame = campaignFrame(this);
    const { width, height } = frame;
    // The selection is always something the shelf shows: a chip or a search that hides it moves it to the first
    // scenario still visible (`view/scenario-selection.ts`); with none visible, "Choose heroes" is disabled.
    const shelves = this.#shelves();
    const selection = selectionAmongVisible(
      this.#scenarioPicked() ? this.#draft.scenarioId : null,
      flattenShelves(shelves)
        .filter((entry): entry is Scenario => !isBuilderTile(entry))
        .map((entry) => entry.id as string),
    );
    const scenario = currentScenarios().find((candidate) => (candidate.id as string) === selection.selectedId);
    // Nothing is picked until the player picks one: the draft is left alone (its scenarioId is only a placeholder).
    if (selection.selectedId !== null) this.#draft = setScenario(this.#draft, scenario, selection.selectedId);

    const placement = this.#placement();
    // A chosen chip leads with a check, which the packing leaves room for.
    const chipDefs = scenarioProductsOf(currentScenarios(), placement.shelfOf, placement.order).map((code) => ({
      id: `product:${code}`,
      text: `${code === CUSTOM_SHELF_ID ? t("scenario.customPacks") : packNameOf(code)}✓ `,
      selected: this.#draft.scenarioFilter.product === code,
      onClick: () => {
        this.#draft = setScenarioFilter(this.#draft, {
          ...this.#draft.scenarioFilter,
          product: this.#draft.scenarioFilter.product === code ? null : code,
        });
        this.#compose();
      },
    }));

    // "Customize this scenario": only on a ready-made Civil War scenario (inert until one is in the pool).
    const customize = customizeEntryOf(scenario);
    const detail = scenario
      ? scenarioDetailOf(scenario, currentCardsById(), currentEncounterSets(), artLanguageNow())
      : null;

    // Two passes: the chips wrap against the roster column's own width, which only the layout knows.
    // A lock reason is a sentence: it wraps in the footer, and the layout gives the footer the height it measures.
    const lock = scenario ? unlocks().scenarioLock(scenario) : null;
    const probe = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    let footerHeight = FOOTER_HEIGHT;
    // Behind the Filters button while a controller is in use or the game is narrower than the breakpoint (Y or the
    // button brings the chips back).
    const behindButton = this.#padFilters.behindButton(width);
    const folded = this.#padFilters.folded(width);
    this.#chipsFolded = folded;
    const layoutFor = (chipRowCount: number): ScenarioSelectLayout =>
      scenarioSelectLayout({
        headerHeight: frame.topBar,
        footerHeight,
        width,
        height,
        chipRows: chipRowCount,
        detailLines: 12,
        // Nothing picked: the panel has no stages to show, so it stays a bar (it has no toggle either).
        detailCollapsed: !this.#stagesOpen || scenario === undefined,
        searchOpen: this.#searchOpen,
        secondaryAction: customize !== null,
        filtersButton: behindButton,
        chipsShown: !folded,
      });
    const estimatedRows = folded ? 0 : packCompactChipsToRows(chipDefs, width).length;
    const firstPass = layoutFor(estimatedRows);
    const chipRows = folded ? [] : packCompactChipsToRows(chipDefs, firstPass.chips.width);
    let layout = chipRows.length === estimatedRows ? firstPass : layoutFor(chipRows.length);
    if (lock) {
      footerHeight = Math.ceil(probe.measure(lock, typeRole.label, { wrapWidth: layout.footer.width }).height);
      if (footerHeight > FOOTER_HEIGHT) layout = layoutFor(chipRows.length);
    }

    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    // Ground: paper body under a full-width ink header bar (docs/design-renders/ScreensDesktop_01-02.png).
    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    b.dots({ x: 0, y: frame.topBar, width, height: height - frame.topBar }, "paper", 6, 1, 0.1);
    const bar = sheetTopBar(b, this.#glyphs, {
      scene: this,
      frame,
      backLabel: t("scenario.back"),
      title: t("scenario.title"),
      right: t("scenario.step"),
    });
    if (bar.backRect) {
      this.#addAction("back", () => this.#back());
      this.#stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
    }

    // A phone's open stages sheet covers the chips, the search row and the shelves.
    const overlay = layout.detailOverlay;
    if (!overlay) this.#drawSearchAndChips(b, layout, chipDefs, chipRows, folded);

    // The Random row takes the top of the list, so the tiles are sized for what is left.
    const cardMetrics = this.#cardMetrics({ ...layout.shelves, height: layout.shelves.height - RANDOM_ROW_HEIGHT });
    let cardIds: readonly string[] = [];
    let shelfStopKeys: readonly string[] | undefined;
    let randomStops: readonly string[] = [];
    let listRect: Rect | null = null;
    const drilled = this.#drill.packId !== null;
    if (!overlay) {
      if (drilled) {
        const shelf = shelves.find((s) => s.id === this.#drill.packId);
        const items = shelf?.items ?? [];
        // "All packs" leads the list in the focus order, so a keyboard or pad can leave the box.
        randomStops = [
          "drill-back",
          ...this.#drawRandomRow(b, layout.shelves, [
            { id: "random-villain", label: t("scenario.randomVillain"), onClick: () => this.#randomVillain() },
          ]),
        ];
        const drillBack = (): void => this.#drillOut();
        const backRect: Rect = { x: layout.shelves.x, y: layout.shelves.y, width: 130, height: 28 };
        b.button({
          key: "drill-back",
          rect: backRect,
          label: t("scenario.allPacks"),
          look: "quiet",
          type: typeRole.rowTitle,
        });
        this.#addAction("drill-back", drillBack);
        this.#stops.set("drill-back", { rect: backRect, activate: drillBack });
        b.text(
          layout.shelves.x + 140,
          layout.shelves.y + 14,
          shelf ? shelf.title.toUpperCase() : "",
          typeRole.sectionHeader,
          {
            color: surface.ink.hex,
            origin: [0, 0.5],
            fitWidth: layout.shelves.width - 140 - RANDOM_BUTTON_WIDTH - 12,
          },
        );
        listRect = {
          x: layout.shelves.x,
          y: layout.shelves.y + 36,
          width: layout.shelves.width,
          height: layout.shelves.height - 36,
        };
        cardIds = items.map((s) => s.id as string);
      } else {
        randomStops = this.#drawRandomRow(b, layout.shelves, [
          { id: "random-box", label: t("scenario.randomBox"), onClick: () => this.#randomBox() },
          { id: "random-scenario", label: t("scenario.randomScenario"), onClick: () => this.#randomScenario() },
        ]);
        listRect = {
          x: layout.shelves.x,
          y: layout.shelves.y + RANDOM_ROW_HEIGHT,
          width: layout.shelves.width,
          height: layout.shelves.height - RANDOM_ROW_HEIGHT,
        };
        cardIds = openShelfItems(shelves).map((s) => s.id as string);
        const keys = shelfFocusKeys(shelves, "scenario-shelf", "scenario", (s) => s.id as string);
        shelfStopKeys = keys.length > 0 ? keys : undefined;
      }
    }

    // Stat strip (D02's own band below the roster): main scheme, starting threat, villain HP (stage I), encounter sets —
    // the same `detail` the ink panel reads, so the two can't disagree. Zero-height while the phone's disclosure is shut.
    if (detail && layout.statStrip.height > 0 && !overlay) {
      drawStatStrip(b, layout.statStrip, detail, layout.statStripRows);
    }

    // The side panel (D02's own "SCENARIO STAGES" sidebar): a header, one outlined box per stage (bright at the draft's
    // current difficulty, dim otherwise), the played record, and the CTA pinned at the foot.
    const panel = drawSidePanel(b, {
      layout,
      detail,
      difficulty: this.#draft.difficulty,
      record: this.#history.get(this.#draft.scenarioId) ?? null,
      stagesOpen: this.#stagesOpen,
    });
    this.#recordText = panel.recordText;
    if (panel.bar) {
      const toggle = (): void => {
        this.#stagesOpen = !this.#stagesOpen;
        this.#compose();
      };
      this.#addAction("stages-toggle", toggle);
      this.#stops.set("stages-toggle", { rect: panel.bar, activate: toggle });
    }

    // Locked, the CTA becomes the door to unlocking this one scenario with champion points, right here.
    const unlockTarget = { kind: "scenario", scenarioId: (scenario?.id ?? this.#draft.scenarioId) as string } as const;
    const next = (): void => {
      if (this.#leaving) return;
      if (lock) {
        unlockOrAsk(this, unlockTarget, () => this.#compose());
        return;
      }
      this.#leaving = true;
      this.scale.off("resize", this.#compose, this);
      // Room mode (#880): no hero step, the players bring their own decks; Table setup gets one placeholder per seat.
      if (roomSetupActive()) {
        reportRoomSetup("table", this.#draft.scenarioId as string);
        goToScreen(this, SCENES.setup, {
          draft: { ...this.#draft, seats: placeholderSeats(roomSeatCount()) },
        } satisfies TableSetupData);
        return;
      }
      goToScreen(this, SCENES.seats, {
        draft: this.#draft,
        ...(this.#seedDecks.length > 0 ? { seedDecks: this.#seedDecks } : {}),
      } satisfies SeatsData);
    };
    // Start moves forward on this screen (the route's primary), so its glyph sits on the red button, on a pad only.
    this.#glyphs.button(b, {
      key: "next",
      rect: layout.next,
      label: lock ? t("scenario.unlockCost", { cost: unlockCostOf(unlockTarget) }) : t("scenario.chooseHeroes"),
      look: "primary",
      type: typeRole.barTitle,
      ...(selection.canContinue
        ? {}
        : {
            disabled: selection.selectedId === null ? t("scenario.pickVillainFirst") : t("scenario.noneShowing"),
          }),
      ids: ["pause"],
      ground: "ink",
      idsNow: (set) => (selection.canContinue && set === "pad" ? ["pause"] : null),
    });
    this.#addAction("next", next);
    this.#canContinue = selection.canContinue;
    // Kept a stop while greyed (specs wait on it as "the list is ready"); the route's primary is null until a pick.
    this.#stops.set("next", { rect: layout.next, activate: selection.canContinue ? next : () => {} });
    if (customize && layout.secondary) {
      const open = (): void => this.#openBuilder("customize", customize.scenarioId);
      b.button({
        key: "customize",
        rect: layout.secondary,
        label: customize.label,
        look: layout.wide ? "onInk" : "secondary",
        type: typeRole.rowTitle,
      });
      this.#addAction("customize", open);
      this.#stops.set("customize", { rect: layout.secondary, activate: open });
    }
    // Locked: the footer says how to open it for free, since the CTA itself is the paid way.
    b.text(layout.footer.x, layout.footer.y, lock ?? t("scenario.stepFooter"), typeRole.label, {
      // On the dark detail panel (wide) the caption is paper; on a phone it sits on the page's own ground.
      color: layout.wide ? surface.paper.hex : surface.ink.hex,
      alpha: lock ? 1 : ink.label,
      ...(lock ? { wrapWidth: layout.footer.width } : {}),
    });

    // The sheet region (the whole screen), then the shelves over it.
    const full: Rect = { x: 0, y: 0, width, height };
    const sheet = (this.#sheet ??= this.#wire(document.createElement("mc-sheet") as McSheet, full));
    this.#bindFields(sheet.element);
    sheet.setRect(full);
    sheet.element.nodes = b.nodes;
    renderNow(sheet.element);
    this.#mountRoster(listRect, cardMetrics, shelves, drilled);

    // Stops of the sheet's parts that are read off live elements (chips scroll in their rail).
    for (const [key, stop] of this.#stops) {
      if (key.startsWith("scenario-chip:")) {
        const fallback = typeof stop.rect === "function" ? stop.rect() : stop.rect;
        this.#stops.set(key, {
          ...stop,
          rect: () => this.#liveRect(sheet, key) ?? fallback,
          ensureVisible: () => sheet.element.elementOf(key)?.scrollIntoView({ block: "nearest", inline: "nearest" }),
        });
      }
    }

    this.#firstTileKey = cardIds[0] !== undefined ? `scenario:${cardIds[0]}` : null;
    const order = scenarioSelectFocusOrder({
      scenarioIds: cardIds,
      scenarioChipIds: folded || overlay ? [] : chipDefs.map((c) => c.id),
      randomStops,
      ...(shelfStopKeys ? { shelfStopKeys } : {}),
      filtersToggle: this.#stops.has("filters-toggle"),
      stagesToggle: !layout.wide,
      searchToggle: !layout.wide,
      customize: customize !== null,
    });
    this.#areas = {
      filters: order.filter((key) => FILTER_STOP.test(key)),
      entry:
        order.find((key) => key.startsWith("scenario-chip:")) ??
        order.find((key) => key === "filters-toggle") ??
        order.find((key) => key === "scenario-search") ??
        null,
      list: order.filter((key) => LIST_STOP.test(key)),
    };
    // Y on a stop with no Inspect of its own jumps between the filters and the list; a scenario tile keeps its Inspect.
    for (const [key, stop] of this.#stops) {
      if (!stop.inspect) this.#stops.set(key, { ...stop, inspect: () => this.#jumpAreas(false) });
    }
    this.#route?.set(order, this.#stops);
    this.#leases.end();
    this.#revealPicked();
    this.#listView = listRect ?? { x: 0, y: 0, width: 0, height: 0 };
    this.#hover?.onDraw();
  }

  /** Listens to the sheet's search field (once: the sheet outlives a compose). */
  #bindFields(element: McSheet): void {
    if (this.#bound.has(element)) return;
    this.#bound.add(element);
    element.addEventListener("mc-search", (event) => {
      const { key, value } = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (key !== SEARCH) return;
      this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: value });
      this.#requestSearch(value);
    });
  }

  /**
   * The row above the list: its Random buttons (drilled into a box, "◂ All packs" holds the left and they sit at the
   * right). Each is a focus stop and a tap, the same control. Returns the stop keys.
   */
  #drawRandomRow(
    b: SheetBuilder,
    area: Rect,
    buttons: readonly { readonly id: string; readonly label: string; readonly onClick: () => void }[],
  ): readonly string[] {
    const gap = 8;
    // As wide as the longest word needs (a Spanish "Escenario aleatorio" is wider than the English), up to what the row has.
    const wanted = Math.max(
      RANDOM_BUTTON_WIDTH,
      ...buttons.map((button) => Math.ceil(b.measure(button.label, typeRole.label).width) + 32),
    );
    const width = Math.min(wanted, Math.floor((area.width - gap * (buttons.length - 1)) / buttons.length));
    let x =
      this.#drill.packId === null
        ? area.x
        : area.x + area.width - (width * buttons.length + gap * (buttons.length - 1));
    for (const button of buttons) {
      const rect: Rect = { x, y: area.y, width, height: RANDOM_ROW_HEIGHT - 8 };
      b.button({ key: button.id, rect, label: button.label, look: "secondary", type: typeRole.label });
      this.#addAction(button.id, button.onClick);
      this.#stops.set(button.id, { rect, activate: button.onClick });
      x += width + gap;
    }
    return buttons.map((button) => button.id);
  }

  /**
   * The search field and the product chips. Wide draws the field above wrapped chips, always. Narrow draws one
   * row — the search toggle at its head, the chips as a sideways rail beside it — and the field only while the
   * toggle is on (`view/scenario-select-layout.ts`'s `searchOpen`), so a phone's roster gets the row back.
   */
  #drawSearchAndChips(
    b: SheetBuilder,
    layout: ScenarioSelectLayout,
    chipDefs: readonly { id: string; text: string; selected: boolean; onClick: () => void }[],
    chipRows: readonly (readonly { id: string; text: string; selected: boolean; onClick: () => void }[])[],
    folded: boolean,
  ): void {
    const filter = this.#draft.scenarioFilter;
    // The View "Inspect" hint beside the button needs room a phone does not have.
    const inspectHint = this.#padFilters.padMode && layout.wide && layout.filtersButton !== null;
    if (layout.search.height > 0) {
      const search =
        inspectHint && layout.search.height > 0
          ? { ...layout.search, width: layout.search.width - INSPECT_HINT_WIDTH - HINT_GAP }
          : layout.search;
      b.search(search, {
        key: SEARCH,
        // The field keeps what is typed in it across a compose (the search's debounce lags behind the keys).
        value: this.#field(SEARCH)?.text ?? filter.text,
        placeholder: t("scenario.search"),
        clearLabel: t("deckPicker.searchClear"),
        maxLength: 80,
        debounce: 140,
        escapeClears: true,
      });
      const focus = (): void => {
        const field = this.#field(SEARCH);
        if (field) void field.updateComplete.then(() => field.focusInput());
      };
      this.#addAction(SEARCH, focus);
      this.#stops.set(SEARCH, { rect: search, activate: focus });
    }
    if (layout.searchToggle) {
      const rect = layout.searchToggle;
      const active = this.#searchOpen || filter.text.length > 0;
      const toggle = (): void => this.#toggleSearch();
      b.button({
        key: "scenario-search-toggle",
        rect,
        label: "",
        look: "secondary",
        selected: active,
        aria: t("scenario.search"),
      });
      // The magnifier, in whichever ink the button's own state uses (paper on the ink-filled selected state).
      const color = active ? "var(--mc-line-paper, #f4efe3)" : "var(--mc-line-ink, #14110e)";
      const cx = rect.width / 2 - 2;
      b.svg(
        rect,
        [rect.width, rect.height],
        [
          { k: "circle", cx, cy: cx, r: 7, stroke: color, sw: 2.5 },
          { k: "line", x1: cx + 5, y1: cx + 5, x2: cx + 11, y2: cx + 11, stroke: color, sw: 3 },
        ],
        "scenario-search-icon",
      );
      this.#addAction("scenario-search-toggle", toggle);
      this.#stops.set("scenario-search-toggle", { rect, activate: toggle });
    }
    if (layout.filtersButton) {
      const rect = layout.filtersButton;
      const toggle = (): void => this.#toggleFilters();
      this.#glyphs.button(b, {
        key: "filters-toggle",
        rect,
        label: filtersLabel(this.#draft.scenarioFilter.product ? 1 : 0, !folded, artLanguageNow()),
        look: "secondary",
        type: typeRole.rowTitle,
        ids: ["inspect"],
        ground: "paper",
        idsNow: (set) => (set === "pad" ? ["inspect"] : null),
      });
      this.#addAction("filters-toggle", toggle);
      this.#stops.set("filters-toggle", { rect, activate: toggle });
      if (inspectHint) {
        // View opens the Inspect sheet here, because Y is the filters' (the keyboard's Inspect key is unchanged).
        const hintX = rect.x - HINT_GAP - INSPECT_HINT_WIDTH + 4;
        this.#glyphs.hint(b, {
          key: "view-inspect",
          x: hintX,
          y: rect.y + rect.height / 2,
          ids: ["peek"],
          height: 16,
          ground: "paper",
          idsNow: (set) => (set === "pad" ? ["peek"] : null),
        });
        b.text(hintX + 36, rect.y + rect.height / 2, t("seats.hintInspect"), typeRole.label, {
          color: surface.ink.hex,
          alpha: ink.label,
          origin: [0, 0.5],
        });
      }
    }
    if (folded) return;
    // The product chips: wrapped rows of compact chips on a wide screen, one sideways rail on a narrow one.
    const entries = (chipsOf: readonly { id: string; text: string; selected: boolean }[]) =>
      chipsOf.map((chip) => ({
        id: chip.id,
        label: chip.text.replace(/✓ $/, ""),
        selected: chip.selected,
      }));
    if (layout.chipsScroll) {
      b.filterBar("chips", layout.chips, entries(chipDefs), {
        prefix: "scenario-chip:",
        rail: true,
        rowHeight: hit.target,
        gap: CHIP_GAP,
      });
    } else {
      b.filterBar(
        "chips",
        layout.chips,
        chipRows.flatMap((row) => entries(row).map((chip, at) => ({ ...chip, width: compactChipWidthOf(row[at]!) }))),
        { prefix: "scenario-chip:", rows: chipRows.length, rowHeight: hit.target, gap: CHIP_GAP },
      );
    }
    for (const chip of chipDefs) {
      const key = `scenario-chip:${chip.id}`;
      this.#addAction(key, chip.onClick);
      this.#stops.set(key, { rect: layout.chips, activate: chip.onClick });
    }
  }

  /** The shelves panel over the sheet: its model from the shelves, its places for the focus route, the hover and the scroll put back. */
  #mountRoster(
    listRect: Rect | null,
    metrics: TileMetrics,
    shelves: readonly Shelf<RosterEntry>[],
    drilled: boolean,
  ): void {
    if (!listRect) {
      this.#roster?.setHidden(true);
      return;
    }
    const entries = drilled ? (shelves.find((s) => s.id === this.#drill.packId)?.items ?? []) : [];
    const contentWidth = listRect.width - ROSTER_GUTTER;
    const shelfModels: ShelfRosterShelf[] = drilled
      ? [
          {
            id: this.#drill.packId!,
            title: "",
            count: "",
            cover: null,
            open: undefined,
            seeAll: "",
            items: entries.map((entry) => this.#itemOf(entry)),
          },
        ]
      : shelves.map((shelf) => {
          const cover = shelf.id === "your-decks" ? null : this.#packCoverFor(shelf.id);
          const folded = shelf.collapsed === true;
          return {
            id: shelf.id,
            title: shelf.title,
            count: scenarioCountCaption(shelf.items.filter((e) => !isBuilderTile(e)).length),
            cover: cover ? { src: cover.tileUrl ?? cover.url, cover: { x: 0.5, y: 0.5 } } : null,
            open: !folded,
            seeAll: t("scenario.seeAll"),
            items: folded ? [] : shelf.items.map((entry) => this.#itemOf(entry)),
          };
        });
    const model: ShelfRosterModel = {
      mode: drilled ? "grid" : "shelves",
      shelves: shelfModels,
      cardWidth: metrics.cardWidth,
      cardHeight: metrics.cardHeight,
      gap: metrics.cardGap,
      contentWidth,
      previousLabel: t("scenario.rowPrevious"),
      nextLabel: t("scenario.rowNext"),
      emptyText: shelves.length === 0 ? t("scenario.noMatches") : null,
      clearLabel: shelves.length === 0 ? t("scenario.clear") : "",
    };
    const fresh = this.#roster === null;
    const region = (this.#roster ??= this.#wire(document.createElement("mc-shelf-roster") as McShelfRoster, listRect));
    region.setRect(listRect);
    region.setHidden(false);
    region.element.model = model;
    renderNow(region.element);

    // Focus stops: a folding shelf's header, each tile of the shelves left open; or the clear button when nothing matches.
    const grid = region;
    const stopOf = (key: string, domKey: string, activate: () => void, extra: Partial<FocusStop> = {}): void => {
      this.#stops.set(key, {
        rect: () => this.#liveRect(grid, domKey) ?? listRect,
        activate,
        view: () => listRect,
        ...extra,
      });
    };
    if (shelves.length === 0) {
      const clear = (): void => {
        this.#draft = clearScenarioFilter(this.#draft);
        this.#search.cancel();
        this.#ranking = null;
        this.#compose();
      };
      this.#addAction("clear", clear);
      this.#stops.set("scenario-clear", {
        rect: () => this.#liveRect(grid, "clear") ?? listRect,
        activate: clear,
        view: () => listRect,
      });
      return;
    }
    const tileStop = (entry: RosterEntry, shelfId: string, index: number): void => {
      const id = entry.id as string;
      const activate = (): void => this.#activateEntry(entry);
      this.#addAction(`entry:${id}`, activate);
      if (!isBuilderTile(entry)) this.#inspects.set(`entry:${id}`, () => this.#inspectEntry(entry));
      this.#rowOfKey.set(`scenario:${id}`, { shelfId, itemIndex: index });
      stopOf(`scenario:${id}`, `entry:${id}`, activate, {
        ...(!isBuilderTile(entry) ? { inspect: () => this.#inspectEntry(entry) } : {}),
        ensureVisible: () =>
          region.element.elementOf(`entry:${id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" }),
      });
    };
    if (drilled) {
      const shelf = shelves.find((s) => s.id === this.#drill.packId);
      (shelf?.items ?? []).forEach((entry, index) => tileStop(entry, shelf!.id, index));
    } else {
      for (const shelf of shelves) {
        const toggle = (): void => this.#toggleFold(shelf.id);
        this.#addAction(`fold:${shelf.id}`, toggle);
        this.#addAction(`all:${shelf.id}`, () => {
          this.#drill = drillIntoPack(shelf.id);
          this.#compose();
        });
        stopOf(`scenario-shelf:${shelf.id}`, `fold:${shelf.id}`, toggle, {
          ensureVisible: () => region.element.elementOf(`fold:${shelf.id}`)?.scrollIntoView({ block: "nearest" }),
        });
        if (shelf.collapsed) continue;
        shelf.items.forEach((entry, index) => tileStop(entry, shelf.id, index));
      }
    }
    if (fresh && !this.#restored) {
      this.#restored = true;
      region.element.restoreScroll(scrollMemory);
    }
  }

  /** One roster entry as a tile of the shelves panel. */
  #itemOf(entry: RosterEntry): ShelfRosterItem {
    if (isBuilderTile(entry)) return this.#builderItem(entry.id as string);
    const s = entry;
    // The villain's scene art, or — with none yet (Klaw, Risky Business, Mutagen Formula today) — its own stage-I
    // card scan, cover-cropped, rather than an empty parchment box (second-pass item 7).
    const custom = isPackScenario(s.id as string);
    const picture = this.#pictureOf(s, custom);
    const cardDetail = scenarioDetailOf(s, currentCardsById(), currentEncounterSets(), artLanguageNow());
    const subtitle = shelfSubtitleOf(cardDetail);
    const selected = this.#scenarioPicked() && this.#draft.scenarioId === (s.id as string);
    // A locked scenario stays selectable, so its stages can be read ahead of time; only "Choose heroes" refuses it.
    const lock = unlocks().scenarioLock(s);
    // A pack's scenario says so in words, beside SELECTED when both apply.
    const tag = lock
      ? t("scenario.locked")
      : [custom ? customBadge() : null, selected ? t("scenario.selected") : null].filter(Boolean).join(" · ");
    if (import.meta.env.DEV) {
      this.#tileDebug.set(s.id as string, {
        id: s.id as string,
        title: cardDetail.tileTitle,
        villainArt: !custom && this.#villainArtFor(s) !== null,
        baked: picture.src !== null,
      });
    }
    const unknown = hasRandomChosenVillain(s);
    return {
      id: s.id as string,
      cardId: (unknown ? s.mainSchemeCardId : s.villainCardId) as string,
      picture,
      selected,
      inspect: true,
      card: {
        src: null,
        focusY: 0,
        dim: lock !== null,
        chip: tag,
        chipTone: lock ? "locked" : "action",
        title: cardDetail.tileTitle,
        titleDisplay: true,
        detail: lock
          ? lockCaptionOf(
              unlocks().scenarioLockShort(s) ?? lock,
              unlockCostOf({ kind: "scenario", scenarioId: s.id as string }),
            )
          : subtitle,
        detailLines: 2,
        detailTone: lock ? "alert" : "meta",
        initial: cardDetail.tileTitle.slice(0, 1).toUpperCase(),
        captionHeight: TILE_CAPTION,
      },
    };
  }

  /** The "Build your own" tile: the box cover (Captain America against Iron Man over the flag, which says "pick a side"). */
  #builderItem(id: string): ShelfRosterItem {
    const civilWar = currentScenarios().find((s) => isCivilWarScenario(s));
    const cover = civilWar ? this.#packCoverFor(civilWar.packCode as string) : null;
    return {
      id,
      cardId: "",
      picture: { src: cover ? (cover.tileUrl ?? cover.url) : null, cover: { x: 0.5, y: 0.25 } },
      selected: false,
      inspect: false,
      card: {
        src: null,
        focusY: 0,
        dim: false,
        chip: t("scenario.builder"),
        chipTone: "action",
        title: t("scenario.buildYourOwnTitle"),
        titleDisplay: true,
        detail: t("scenario.buildYourOwnSubtitle"),
        detailLines: 2,
        detailTone: "meta",
        initial: "+",
        captionHeight: TILE_CAPTION,
      },
    };
  }

  /** A tile's picture: a pack's own, else the villain's scene art (its roster-size copy), else its stage-I card scan. */
  #pictureOf(s: Scenario, custom: boolean): PictureSource {
    const crop = { x: 0.5, y: 0 } as const;
    if (custom) {
      const held = this.#leases.image(packPictureFor("villain", s.villainCardId as string));
      return { src: held.src, cover: crop, ...(held.retry !== undefined ? { retry: held.retry } : {}) };
    }
    const art = this.#villainArtFor(s);
    if (art) {
      const focus = art.focus;
      return {
        src: art.tileUrl ?? art.url,
        cover: focus?.y !== undefined ? { x: focus.x ?? 0.5, y: focus.y, centered: true } : crop,
      };
    }
    const villainCard = hasRandomChosenVillain(s) ? undefined : currentCardsById().get(s.villainCardId as string);
    if (!villainCard) return { src: null, cover: crop };
    const held = this.#leases.image(artFor(villainCard, { kind: "villainStage", sideIndex: 0, stageIndex: 0 }));
    return { src: held.src, cover: crop, ...(held.retry !== undefined ? { retry: held.retry } : {}) };
  }

  /** The scenario tiles on screen, for the hover popover: each shows its villain's stage I (or the main scheme when the villain is drawn at random). */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const region = this.#roster;
    const viewport = this.#listView;
    if (!region || viewport.width === 0) return found;
    const scenarios = new Map(currentScenarios().map((s) => [s.id as string, s] as const));
    for (const key of this.#stops.keys()) {
      if (!key.startsWith("scenario:")) continue;
      const id = key.slice("scenario:".length);
      const scenario = scenarios.get(id);
      const tile = region.element.elementOf(`entry:${id}`);
      if (!scenario || !tile) continue;
      const unknown = hasRandomChosenVillain(scenario);
      const cardId = (unknown ? scenario.mainSchemeCardId : scenario.villainCardId) as string;
      const card = currentCardsById().get(cardId);
      if (!card) continue;
      const rect = clipHoverRect(region.rectOf(tile), viewport);
      if (!rect) continue;
      const face = unknown
        ? ({ kind: "mainSchemeStage", stageIndex: 0, side: "A" } as const)
        : card.type === "villain"
          ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const)
          : ({ kind: "hero" } as const);
      found.set(hoverSlotOf(cardId, key), { ...rect, cardId, face, through: true });
    }
    return found;
  }

  /**
   * Y (or the Filters button) while a controller is in use: shows the chips, or folds them away again. Opening moves
   * focus to the first chip, remembering the tile it left; folding from a chip returns to that tile.
   */
  #toggleFilters(): void {
    const focus = this.#route?.focused ?? null;
    const opening = this.#chipsFolded;
    const onChip = focus?.startsWith("scenario-chip:") ?? false;
    this.#padFilters.toggle();
    this.#compose();
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

  /** LT / RT: pages the shelf row focus is in, as its chevrons would, and moves focus to the first card in view. */
  #pageRow(direction: 1 | -1): void {
    const row = this.#rowOfKey.get(this.#route?.focused ?? "");
    const first = row ? this.#roster?.element.pageShelf(row.shelfId, direction) : null;
    if (!row || first == null) return;
    const key = `scenario:${first}`;
    if (this.#stops.has(key)) this.#route?.focusKey(key);
  }

  /** Y toggles focus between the filters and the list (back to the row it left); B (`fromBack`) also scrolls the list to its start. */
  #jumpAreas(fromBack: boolean): void {
    // B from the list with the chips folded opens them first, so there is a row to land on.
    if (this.#chipsFolded) {
      this.#padFilters.open();
      this.#compose();
    }
    const focus = this.#route?.focused ?? null;
    const target = fromBack ? this.#areaJump.toFilters(focus, this.#areas) : this.#areaJump.toggle(focus, this.#areas);
    if (target === null) return;
    if (fromBack) this.#roster?.element.scroller?.scrollTo({ top: 0 });
    this.#route?.focusKey(target);
  }

  /** Asks the worker to rank the scenarios for the text; the screen redraws when the newest answer arrives. An empty text clears the search at once. */
  #requestSearch(text: string): void {
    if (text.trim() === "") {
      this.#search.cancel();
      this.#ranking = null;
      this.#compose();
      return;
    }
    this.#search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#ranking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#compose();
    });
  }

  #toggleSearch(): void {
    this.#searchOpen = !this.#searchOpen;
    // Shutting the field also clears its text: a filter whose field you can no longer see must not keep hiding
    // scenarios. The product chips are their own visible controls and stay as they were.
    if (!this.#searchOpen && this.#draft.scenarioFilter.text) {
      this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: "" });
      this.#search.cancel();
      this.#ranking = null;
    }
    this.#compose();
    if (this.#searchOpen) {
      const field = this.#field(SEARCH);
      if (field) void field.updateComplete.then(() => field.focusInput());
    }
  }

  /** Card size: ~300px wide (D02's own roughly-300px-wide art-dominant cards), tall enough to fill most of the shelf viewport's own height, capped so it doesn't run away on a very tall monitor. */
  #cardMetrics(shelvesRect: Rect): TileMetrics {
    const headerToCardsGap = 8;
    const shelfGap = 20;
    const cardWidth = Math.min(300, shelvesRect.width - 40);
    const available = shelvesRect.height - SHELF_HEADER - headerToCardsGap - shelfGap;
    const cardHeight = Math.max(220, Math.min(440, available));
    return { cardWidth, cardHeight, cardGap: 12 };
  }

  #onInspectChoose(rowId: string): void {
    const s = currentScenarios().find((candidate) => (candidate.id as string) === rowId);
    if (s) {
      this.#draft = setScenario(this.#draft, s, s.id as string);
      this.#compose();
    }
  }

  /**
   * Where each scenario is shelved: installed packs' scenarios on a t("scenario.customPacks") shelf first or last, or beside the
   * wave the pack names (issue #734). The product chips are these shelves too (issue #966).
   */
  #placement(): { readonly order: readonly string[]; readonly shelfOf: (scenario: Scenario) => string } {
    const placed = placeScenarioShelves(
      POOL_PACKS.map((p) => ({ code: p.code as string, cycleId: p.cycleId as string })),
      customContentPrefsNow().placement,
    );
    const packWaves = new Map(
      loadedPacks().flatMap((pack) => (pack.scenarios ?? []).map((one) => [one.id as string, pack.wave] as const)),
    );
    return {
      order: placed.order,
      shelfOf: (scenario) =>
        isPackScenario(scenario.id as string)
          ? placed.shelfOf(packWaves.get(scenario.id as string))
          : (scenario.packCode as string),
    };
  }

  #shelves(): readonly Shelf<RosterEntry>[] {
    const ranking = this.#ranking;
    const placed = this.#placement();
    const candidates: ShelfCandidate<Scenario>[] = withSelectionPinned(
      currentScenarios(),
      () => true,
      (s) => this.#scenarioPicked() && this.#draft.scenarioId === (s.id as string),
    ).map((s) => {
      const shelf = placed.shelfOf(s);
      const passesChips =
        (!this.#draft.scenarioFilter.product || shelf === this.#draft.scenarioFilter.product) &&
        (ranking === null || ranking.has(s.id as string));
      return {
        item: s,
        packCode: shelf,
        searchHaystacks: [],
        passesChips,
      };
    });
    const shelves = shelvesOf(
      candidates,
      placed.order,
      (code) => (code === CUSTOM_SHELF_ID ? t("scenario.customPacks") : packNameOf(code)),
      "",
    );
    // A search puts the best match first, within each shelf and among the shelves.
    const ordered = shelvesWithBuilderTile(
      ranking ? rankShelvesByScore(shelves, (s) => ranking.get(s.id as string) ?? 0) : shelves,
    );
    // The shelves the player folded show as their header alone (#753), unless a search or chip is narrowing the list.
    const result = foldShelves(ordered, this.#folded, this.#filtering());
    return result;
  }

  /** A roster entry's tap: a scenario becomes the draft's pick; the "Build your own" tile opens the builder. */
  #activateEntry(entry: RosterEntry): void {
    if (isBuilderTile(entry)) {
      const first = currentScenarios().find((s) => isCivilWarScenario(s));
      if (first) this.#openBuilder("build", first.id as string);
      return;
    }
    this.#draft = setScenario(this.#draft, entry, entry.id as string);
    this.#compose();
  }

  /** The builder scene on the draft: "Customize" (this scenario as printed) or "Build your own" (the last build, or the first leader). */
  #openBuilder(kind: "build" | "customize", scenarioId: string): void {
    const entry = enterBuilder(kind, this.#draft, scenarioId);
    setBuilderOrigin("scenarioSelect");
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.civilWarBuilder, {
      draft: entry.draft,
      step: entry.step,
      ...(this.#seedDecks.length > 0 ? { seedDecks: this.#seedDecks } : {}),
    } satisfies CivilWarBuilderData);
  }

  #inspectEntry(entry: RosterEntry): void {
    if (!isBuilderTile(entry)) this.#inspectScenario(entry);
  }

  #inspectScenario(s: Scenario): void {
    // A villain drawn at random (Shadows in the Night) is not known yet, so the sheet shows the main scheme instead.
    const unknown = hasRandomChosenVillain(s);
    const shownId = unknown ? s.mainSchemeCardId : s.villainCardId;
    const card = currentCardsById().get(shownId as string);
    const face = unknown
      ? ({ kind: "mainSchemeStage", stageIndex: 0, side: "A" } as const)
      : card?.type === "villain"
        ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const)
        : ({ kind: "hero" } as const);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: shownId as CardId, face },
      choice: {
        optionId: s.id as string,
        label: s.multipleVillains
          ? t("scenario.playThis")
          : t("scenario.playFoe", {
              foe: foeWord(s, { cardsById: currentCardsById(), lower: true, lang: artLanguageNow() }),
            }),
      },
    });
  }
}

/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2/W2b, D02/P02): a searchable pack-shelf roster of every scenario in the
 * pool (S8), drill-in to one pack as a full grid, a detail panel for whichever scenario is selected (stage boxes, the
 * played record, data only: §4, no blurb), Back to the Title menu, and "Choose heroes ▸" into `SeatsScene`.
 *
 * The screen is one custom element, `mc-scenario-select-page` (`views/scenario-select/`), that only composes sections
 * (`components/scenario-select/`). This scene mounts it in a `DomRegion`, hands it the model built from the draft and the
 * pool (`scenario-select/page-model.ts`), and handles its `mc-scenario-select` event. It keeps the focus route (its ring
 * drawn in the panel layer), the card hover popover and the ground. Layout is the page's own CSS.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/scenario-select/mc-scenario-select-page/mc-scenario-select-page.js";
import type { McScenarioSelectPage } from "../views/scenario-select/mc-scenario-select-page/mc-scenario-select-page.js";
import {
  SCENARIO_SELECT_EVENT,
  type ScenarioSelectDetail,
} from "../components/scenario-select/scenario-select.types.js";
import { reportRoomSetup } from "./room-setup-report.js";
import { leaveRoomSetup, placeholderSeats, roomSeatCount, roomSetupActive } from "../view/room-table-setup.js";
import type { TableSetupData } from "./table-setup.js";
import type { CardId, Deck, Scenario } from "@mc/content";
import {
  currentCardsById,
  currentEncounterSets,
  currentPoolKey,
  currentScenarios,
  packNameOf,
} from "../content/pool.js";
import { refreshPackArt } from "../art/pack-art.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { hasRandomChosenVillain } from "../view/random-villain.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { scenarioDetailOf } from "../view/scenario-detail.js";
import { foeWord } from "../view/foe-words.js";
import { selectionAmongVisible } from "../view/scenario-selection.js";
import { DeckSearchClient } from "../view/deck-search-client.js";
import { scenarioSearchDocumentOf } from "../view/scenario-search.js";
import { flattenShelves } from "../view/roster-shelves.js";
import { ALL_PACKS, drillIntoPack, drillOut, type ShelfDrillState } from "../view/shelf-drill.js";
import { padInputTracked } from "../platform/input-device.js";
import { resultsHistoryOf, type ScenarioRecord } from "../view/results-history.js";
import { setScenario, setScenarioFilter, clearScenarioFilter, type SetupDraft } from "../view/setup-draft.js";
import {
  isBuilderTile,
  isCivilWarScenario,
  customizeEntryOf,
  enterBuilder,
  setBuilderOrigin,
  type RosterEntry,
} from "../view/civil-war-entry.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { PadFilters } from "./pad-filters.js";
import { SCENARIO_FILTERS_BREAKPOINT } from "../view/filters-layout.js";
import { loadShelfFolds, saveShelfFolds, toggleShelfFold, unfoldShelf } from "../view/shelf-folds.js";
import { randomBox, randomScenario, randomVillainIn } from "../view/scenario-random.js";
import { bindExtraInput } from "./extra-input.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { AreaJump, areaOf, type FocusAreas } from "../view/focus-areas.js";
import { SCENES } from "./keys.js";
import type { SeatsData } from "./seats.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { artLanguageNow } from "../art/art-source.js";
import { t } from "../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { refreshUnlocks, unlocks } from "../progression/progression.js";
import { unlockCostOf, unlockOrAsk } from "./unlock-confirm.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { renderNow, type DomRegion } from "../dom/dom-region.js";
import { mountElement } from "../dom/element-region.js";
import { CardEvents } from "../dom/card-events.js";
import { bindStopFocus } from "../dom/element-stops.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { ScenarioHints } from "./scenario-select/hints.js";
import { pageModelOf } from "./scenario-select/page-model.js";
import { recordTextOf } from "./scenario-select/picked-model.js";
import { chipsOf, rosterShelvesOf } from "./scenario-select/roster.js";
import { routeStopsOf } from "./scenario-select/route-stops.js";
import { renderTree } from "./scenario-select/render-tree.js";
import { rowOfKeyOf, shelvesModelOf } from "./scenario-select/shelves-model.js";
import { faceOfScenario, ScenarioTiles } from "./scenario-select/tiles.js";

export interface ScenarioSelectData {
  readonly draft: SetupDraft;
  /** Decks Take your seats should know before its own list loads (Decks & Collection's "Play this deck"). */
  readonly seedDecks?: readonly Deck[];
}

/** The stops that are the filters (search and the product chips), and the ones that are the list. */
const FILTER_STOP = /^(scenario-search-toggle|scenario-search|filters-toggle|scenario-chip:.*)$/;
const LIST_STOP = /^(drill-back|random-.*|scenario-clear|scenario:.*|scenario-shelf:.*)$/;
const PAGE = 0.85;

/** Where the shelves were scrolled to, kept outside the scene: a trip to Take your seats and back stops and starts it. */
let scrollMemory: { readonly top: number; readonly rows: Readonly<Record<string, number>> } = { top: 0, rows: {} };

export class ScenarioSelectScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #alive = false;
  #stops = new Map<string, FocusStop>();
  /** Whether the phone's stages panel is open. Shut by default: it is reading, not choosing, and it crowds a small screen. */
  #stagesOpen = false;
  /** Narrow only: whether the search field is shown. Off by default: the roster gets the row. */
  #searchOpen = false;
  /** Text search runs in a worker (view/deck-search-client.ts); #ranking is its last answer. Null when no search is active. */
  readonly #search = new DeckSearchClient();
  #ranking: ReadonlyMap<string, number> | null = null;
  #region: DomRegion<McScenarioSelectPage> | null = null;
  #page: McScenarioSelectPage | null = null;
  readonly #tiles = new ScenarioTiles();
  #hover: HoverPreview | null = null;
  #cards: CardEvents | null = null;
  #canContinue = false;
  /** A screen change is under way (Back, Choose heroes): later presses do nothing. */
  #leaving = false;
  #route: FocusRoute | null = null;
  readonly #areaJump = new AreaJump();
  #areas: FocusAreas = { filters: [], entry: null, list: [] };
  #hints!: ScenarioHints;
  /** The chips fold away while a controller is in use (`view/pad-filters.ts`). */
  #padFilters!: PadFilters;
  #rowOfKey: ReadonlyMap<string, { readonly shelfId: string; readonly itemIndex: number }> = new Map();
  #entries = new Map<string, RosterEntry>();
  #chipsFolded = false;
  #drill: ShelfDrillState = ALL_PACKS;
  /** The shelves folded to their header, remembered across visits (#753). */
  #folded: ReadonlySet<string> = loadShelfFolds("scenario-select");
  /** A scenario a Random just picked: scrolled to once the compose has drawn its shelf. */
  #revealId: string | null = null;
  #history: ReadonlyMap<string, ScenarioRecord> = new Map();
  #recordText = "";
  #firstTileKey: string | null = null;
  #seedDecks: readonly Deck[] = [];
  /** A pointer is going down: the focus it gives a native button is the screen's own tap, not the route's to chase. */
  #pressing = false;
  #restored = false;

  constructor() {
    super(SCENES.scenarioSelect);
  }

  init(data: ScenarioSelectData): void {
    this.#draft = data.draft;
    this.#seedDecks = data.seedDecks ?? [];
    this.#region = null;
    this.#page = null;
    this.#restored = false;
  }

  create(): void {
    this.#alive = true;
    this.#leaving = false;
    reportRoomSetup("scenario");
    // The scene is reused: a visit starts on the full shelf list with the stages panel shut.
    this.#drill = ALL_PACKS;
    this.#stagesOpen = false;
    this.#hints = new ScenarioHints(this, () => this.#compose());
    this.#padFilters = new PadFilters(this, () => this.#compose(), SCENARIO_FILTERS_BREAKPOINT);
    this.#padFilters.reset();
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    this.scale.on("resize", this.#compose, this);
    // A pack picture that resolves later draws in place of the plain ground; a language switch (#390) rereads the screen.
    const artOff = onArtChange(() => this.sys.isActive() && this.#compose());
    const languageOff = onLanguageChange(() => this.sys.isActive() && this.#compose());
    if (import.meta.env.DEV) this.#installDebugHook();
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#page?.searchField?.isFocused ?? false }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.scale.off("resize", this.#compose, this);
      artOff();
      languageOff();
      this.#hints.dispose();
      this.#tiles.leases.dispose();
      this.#search.destroy();
      // The panel goes with the scene (`DomRegion`); the next visit makes a new one.
      const rows = this.#page?.roster?.readScroll();
      if (rows) scrollMemory = rows;
      this.#region = null;
      this.#page = null;
    });
    const covered = (): boolean => this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.unlockConfirm);
    const typing = (): boolean => this.#page?.searchField?.isFocused ?? false;
    // A pad that put the caret in the search field can take it out again (B, A or Start).
    bindTextFieldEscape(this, () => this.#page?.searchField ?? null, covered);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => covered() || typing(),
      // B from the list returns to the filters (scrolled back to the top); from the filters it backs out.
      // Y is the filters' fold while a controller is in use (the keyboard's Inspect key is unchanged); View inspects.
      onInspect: (source) => {
        if (source === "key" || !this.#padFilters.padMode) return false;
        this.#toggleFilters();
        return true;
      },
      // LT / RT page the focused row, like its chevrons.
      onTrigger: (trigger) => this.#pageRow(trigger === "lt" ? -1 : 1),
      onCancel: () => {
        if (areaOf(this.#route?.focused ?? null, this.#areas) === "list") this.#jumpAreas(true);
        else if (this.#drill.packId !== null) this.#drillOut();
        else this.#back();
      },
      // Start / Menu (and A with nothing focused) is "Choose heroes ▸".
      primary: () => (this.#canContinue ? "next" : null),
      // The right stick, PageUp / PageDown and Home / End scroll the shelves.
      onScroll: (_dx, dy) => this.#page?.roster?.scroller?.scrollBy({ top: dy }),
      onPage: (direction) => {
        const scroller = this.#page?.roster?.scroller;
        scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
      },
      onHomeEnd: (edge) =>
        this.#page?.roster?.scroller?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    bindExtraInput(this, {
      blocked: () => covered() || typing(),
      intents: {
        view: () => {
          const key = this.#route?.focused ?? null;
          if (this.#padFilters.padMode && key?.startsWith("scenario:")) this.#route?.inspectFocused();
        },
      },
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this),
    );
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

  /** Dev e2e hook (never referenced by product code): the tiles drawn, the pick, the folds, the open box, the stops and their rects. */
  #installDebugHook(): void {
    this.#tiles.debug.clear();
    (window as unknown as { __mcScenarioSelectDebug?: unknown }).__mcScenarioSelectDebug = {
      tiles: () => [...this.#tiles.debug.values()],
      selectedId: () => (this.#scenarioPicked() ? this.#draft.scenarioId : null),
      folded: () => [...this.#folded],
      drilledPack: () => this.#drill.packId,
      listRect: () => this.#listRect(),
      recordText: () => this.#recordText,
      hoverKey: () => this.#hover?.shownKey ?? null,
      stops: () =>
        [...this.#stops].map(([key, stop]) => ({
          key,
          ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
        })),
    };
  }

  /** The box the shelves scroll in, on screen. */
  #listRect(): Rect {
    const roster = this.#page?.roster;
    return roster && this.#region ? this.#region.rectOf(roster) : { x: 0, y: 0, width: 0, height: 0 };
  }

  /** False on a fresh New game until the player taps a villain (`SetupDraft.scenarioPicked`). */
  #scenarioPicked(): boolean {
    return this.#draft.scenarioPicked !== false;
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

  /** Mounts the page once per visit and wires it: its events, the focus that follows a native press, the hover popover. */
  #mount(rect: Rect): McScenarioSelectPage {
    if (this.#page && this.#region) {
      this.#region.setRect(rect);
      return this.#page;
    }
    const { region, element } = mountElement(this, "mc-scenario-select-page", rect);
    this.#region = region;
    this.#page = element;
    element.addEventListener(SCENARIO_SELECT_EVENT, (event) => {
      // Leaving already: a second tap must not act.
      if (!this.#leaving) this.#onSelect(event.detail);
    });
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
    });
    // A native button took focus (a screen reader, Tab): the route follows. A pointer press is the screen's own tap.
    element.addEventListener(
      "pointerdown",
      () => {
        this.#pressing = true;
        setTimeout(() => (this.#pressing = false), 0);
      },
      true,
    );
    bindStopFocus(element, (key) => {
      if (!this.#pressing) this.#route?.focusKey(key);
    });
    // The hover popover follows Phaser's pointer, which only hears the mouse over the canvas; the popover itself is
    // drawn in the canvas, so its box is left out of the panel. Inspect is the tile's own hold (`mc-inspect`).
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    this.#cards = new CardEvents(region);
    return element;
  }

  #onSelect(detail: ScenarioSelectDetail): void {
    if (detail.type === "search") {
      this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: detail.value });
      this.#requestSearch(detail.value);
      return;
    }
    const { key } = detail;
    if (detail.type === "inspect") {
      const entry = this.#entries.get(key.replace(/^entry:/, ""));
      if (entry && !isBuilderTile(entry)) this.#inspectScenario(entry);
      return;
    }
    if (key.startsWith("entry:")) {
      const entry = this.#entries.get(key.slice("entry:".length));
      if (entry) this.#activateEntry(entry);
    } else if (key.startsWith("fold:")) this.#toggleFold(key.slice("fold:".length));
    else if (key.startsWith("all:")) this.#drillInto(key.slice("all:".length));
    else if (key.startsWith("scenario-chip:")) this.#toggleChip(key.slice("scenario-chip:product:".length));
    else if (key === "clear") this.#clearFilters();
    else if (key === "back") this.#back();
    else if (key === "drill-back") this.#drillOut();
    else if (key === "scenario-search-toggle") this.#toggleSearch();
    else if (key === "filters-toggle") this.#toggleFilters();
    else if (key === "stages-toggle") this.#toggleStages();
    else if (key === "random-box") this.#randomBox();
    else if (key === "random-scenario") this.#randomScenario();
    else if (key === "random-villain") this.#randomVillain();
    else if (key === "customize") this.#customize();
    else if (key === "next") this.#next();
  }

  #shelves(): ReturnType<typeof rosterShelvesOf> {
    return rosterShelvesOf({
      ranking: this.#ranking,
      product: this.#draft.scenarioFilter.product ?? null,
      pickedId: this.#scenarioPicked() ? (this.#draft.scenarioId as string) : null,
      folded: this.#folded,
    });
  }

  /** Builds the page model from the current state, hands it over and reads the focus stops off what it drew. */
  #compose(): void {
    if (!this.#alive) return;
    this.#tiles.leases.begin();
    resetHoverCards(this);
    const frame = campaignFrame(this);
    const { width, height } = frame;
    const wide = ["desktop", "tabletLandscape"].includes(formFactorFor(width, height));
    // The selection is always something the shelf shows: a chip or a search that hides it moves it to the first
    // scenario still visible; with none visible, "Choose heroes" is disabled.
    const shelves = this.#shelves();
    const selection = selectionAmongVisible(
      this.#scenarioPicked() ? (this.#draft.scenarioId as string) : null,
      flattenShelves(shelves)
        .filter((entry): entry is Scenario => !isBuilderTile(entry))
        .map((entry) => entry.id as string),
    );
    const scenario = currentScenarios().find((candidate) => (candidate.id as string) === selection.selectedId);
    // Nothing is picked until the player picks one: the draft is left alone (its scenarioId is only a placeholder).
    if (selection.selectedId !== null) this.#draft = setScenario(this.#draft, scenario, selection.selectedId);
    this.#entries = new Map(flattenShelves(shelves).map((entry) => [entry.id as string, entry]));
    const drilled = this.#drill.packId;
    this.#rowOfKey = rowOfKeyOf(shelves, drilled);
    const lock = scenario ? unlocks().scenarioLock(scenario) : null;
    const behindButton = this.#padFilters.behindButton(width);
    this.#chipsFolded = this.#padFilters.folded(width);
    const detail = scenario
      ? scenarioDetailOf(scenario, currentCardsById(), currentEncounterSets(), artLanguageNow())
      : null;
    const record = this.#history.get(this.#draft.scenarioId as string) ?? null;
    this.#recordText = detail ? recordTextOf(record) : "";
    const customize = customizeEntryOf(scenario);
    const page = this.#mount({ x: 0, y: 0, width, height });
    this.#canContinue = selection.canContinue;
    page.model = pageModelOf({
      scene: this,
      width,
      wide,
      phone: frame.phone,
      hints: this.#hints,
      padMode: this.#padFilters.padMode,
      behindButton,
      folded: this.#chipsFolded,
      searchOpen: this.#searchOpen,
      stagesOpen: this.#stagesOpen,
      filter: { text: this.#draft.scenarioFilter.text, product: this.#draft.scenarioFilter.product ?? null },
      chips: chipsOf(this.#draft.scenarioFilter.product ?? null),
      shelves: shelvesModelOf({
        shelves,
        drilledPack: drilled,
        tiles: this.#tiles,
        selectedId: selection.selectedId !== null && this.#scenarioPicked() ? selection.selectedId : null,
      }),
      selection,
      scenario,
      detail,
      difficulty: this.#draft.difficulty,
      record,
      lock,
      unlockCost: unlockCostOf(this.#unlockTarget(scenario)),
      customize: customize?.label ?? null,
      liveSearchText: null,
    });
    renderNow(page);
    renderTree(page.shadowRoot);
    if (!this.#restored && this.#page?.roster) {
      this.#restored = true;
      this.#page.roster.restoreScroll(scrollMemory);
    }
    this.#readStops();
    this.#tiles.leases.end();
    this.#revealPicked();
    this.#hover?.onDraw();
  }

  /** Reads the focus stops off the drawn page, in reading order, and gives them to the route. */
  #readStops(): void {
    const page = this.#page;
    const region = this.#region;
    if (!page || !region) return;
    this.#stops = routeStopsOf(
      page,
      (target) => region.rectOf(target),
      () => this.#jumpAreas(false),
    );
    const order = [...this.#stops.keys()];
    this.#firstTileKey = order.find((key) => key.startsWith("scenario:")) ?? null;
    this.#areas = {
      filters: order.filter((key) => FILTER_STOP.test(key)),
      entry:
        order.find((key) => key.startsWith("scenario-chip:")) ??
        order.find((key) => key === "filters-toggle") ??
        order.find((key) => key === "scenario-search") ??
        null,
      list: order.filter((key) => LIST_STOP.test(key)),
    };
    this.#route?.set(order, this.#stops);
  }

  #unlockTarget(scenario: Scenario | undefined) {
    return { kind: "scenario", scenarioId: (scenario?.id ?? this.#draft.scenarioId) as string } as const;
  }

  /** After a Random pick, brings its tile into view (and the pad's focus onto it). */
  #revealPicked(): void {
    const id = this.#revealId;
    if (id === null) return;
    this.#revealId = null;
    this.#page?.roster?.elementOf(`entry:${id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (padInputTracked() && this.#stops.has(`scenario:${id}`)) this.#route?.focusKey(`scenario:${id}`);
  }

  #toggleFold(shelfId: string): void {
    this.#folded = toggleShelfFold(this.#folded, shelfId);
    saveShelfFolds("scenario-select", this.#folded);
    this.#compose();
  }

  #toggleChip(code: string): void {
    const filter = this.#draft.scenarioFilter;
    this.#draft = setScenarioFilter(this.#draft, { ...filter, product: filter.product === code ? null : code });
    this.#compose();
  }

  #clearFilters(): void {
    this.#draft = clearScenarioFilter(this.#draft);
    this.#search.cancel();
    this.#ranking = null;
    this.#compose();
  }

  #toggleStages(): void {
    this.#stagesOpen = !this.#stagesOpen;
    this.#compose();
  }

  #drillInto(shelfId: string): void {
    this.#drill = drillIntoPack(shelfId);
    this.#compose();
  }

  #drillOut(): void {
    this.#drill = drillOut();
    this.#compose();
  }

  /** What Random may land on: a scenario that is on offer now, so not the builder tile and not one still locked. */
  readonly #isRandomPick = (entry: RosterEntry): boolean =>
    !isBuilderTile(entry) && unlocks().scenarioLock(entry) === null;

  /** Step one: a random box of the ones showing, opened as its own grid of villains. */
  #randomBox(): void {
    const shelf = randomBox(this.#shelves(), this.#isRandomPick, Math.random);
    if (shelf) this.#drillInto(shelf.id);
  }

  /** Both steps at once: a random box, then a random villain in it, picked. */
  #randomScenario(): void {
    const pick = randomScenario(this.#shelves(), this.#isRandomPick, Math.random);
    if (pick && !isBuilderTile(pick.item)) this.#pickRandom(pick.shelf.id, pick.item);
  }

  /** Step two: a random villain of the box that is open. */
  #randomVillain(): void {
    const shelf = this.#shelves().find((s) => s.id === this.#drill.packId);
    const item = shelf ? randomVillainIn(shelf, this.#isRandomPick, Math.random) : null;
    if (shelf && item && !isBuilderTile(item)) this.#pickRandom(shelf.id, item);
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

  /** Y (or the Filters button) while a controller is in use: shows the chips, or folds them away again. */
  #toggleFilters(): void {
    const focus = this.#route?.focused ?? null;
    const opening = this.#chipsFolded;
    const onChip = focus?.startsWith("scenario-chip:") ?? false;
    this.#padFilters.toggle();
    this.#compose();
    // The ring follows a pad or keyboard user; a mouse press leaves focus alone (no ring appears for it).
    if (focus === null && !this.#padFilters.padMode) return;
    const target = opening
      ? this.#areaJump.toFilters(focus, this.#areas)
      : onChip
        ? this.#areaJump.toList(this.#areas)
        : null;
    if (target !== null) this.#route?.focusKey(target);
  }

  /** LT / RT: pages the shelf row focus is in, as its chevrons would, and moves focus to the first card in view. */
  #pageRow(direction: 1 | -1): void {
    const row = this.#rowOfKey.get(this.#route?.focused ?? "");
    const first = row ? this.#page?.roster?.pageShelf(row.shelfId, direction) : null;
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
    if (fromBack) this.#page?.roster?.scroller?.scrollTo({ top: 0 });
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
      const field = this.#page?.searchField;
      if (field) void field.updateComplete.then(() => field.focusInput());
    }
  }

  #onInspectChoose(rowId: string): void {
    const s = currentScenarios().find((candidate) => (candidate.id as string) === rowId);
    if (s) {
      this.#draft = setScenario(this.#draft, s, s.id as string);
      this.#compose();
    }
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

  #customize(): void {
    const scenario = currentScenarios().find((s) => (s.id as string) === (this.#draft.scenarioId as string));
    const entry = customizeEntryOf(scenario);
    if (entry) this.#openBuilder("customize", entry.scenarioId);
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

  /** "Choose heroes ▸": locked, it becomes the door to unlocking this one scenario with champion points, right here. */
  #next(): void {
    if (this.#leaving || !this.#canContinue) return;
    const scenario = currentScenarios().find((s) => (s.id as string) === (this.#draft.scenarioId as string));
    if (scenario && unlocks().scenarioLock(scenario)) {
      unlockOrAsk(this, this.#unlockTarget(scenario), () => this.#compose());
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
  }

  #inspectScenario(s: Scenario): void {
    // A villain drawn at random (Shadows in the Night) is not known yet, so the sheet shows the main scheme instead.
    const shownId = hasRandomChosenVillain(s) ? s.mainSchemeCardId : s.villainCardId;
    this.scene.launch(SCENES.inspect, {
      card: { cardId: shownId as CardId, face: faceOfScenario(s) },
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

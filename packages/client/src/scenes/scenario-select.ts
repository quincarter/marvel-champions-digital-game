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
import { type ScenarioSelectDetail } from "../components/scenario-select/scenario-select.types.js";
import { reportRoomSetup } from "./room-setup-report.js";
import type { Deck, Scenario } from "@mc/content";
import { currentCardsById, currentEncounterSets, currentScenarios } from "../content/pool.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { scenarioDetailOf } from "../view/scenario-detail.js";
import { selectionAmongVisible } from "../view/scenario-selection.js";
import { flattenShelves } from "../view/roster-shelves.js";
import { ALL_PACKS, drillIntoPack, drillOut, type ShelfDrillState } from "../view/shelf-drill.js";
import { padInputTracked } from "../platform/input-device.js";
import { resultsHistoryOf, type ScenarioRecord } from "../view/results-history.js";
import { setScenario, setScenarioFilter, clearScenarioFilter, type SetupDraft } from "../view/setup-draft.js";
import { isBuilderTile, isCivilWarScenario, customizeEntryOf, type RosterEntry } from "../view/civil-war-entry.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { FocusRoute } from "./focus-route.js";
import { PadFilters } from "./pad-filters.js";
import { SCENARIO_FILTERS_BREAKPOINT } from "../view/filters-layout.js";
import { loadShelfFolds, saveShelfFolds, toggleShelfFold, unfoldShelf } from "../view/shelf-folds.js";
import { SCENES } from "./keys.js";
import { fadeScreenIn } from "../ui/transitions.js";
import { artLanguageNow } from "../art/art-source.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { refreshUnlocks, unlocks } from "../progression/progression.js";
import { unlockCostOf, unlockOrAsk } from "./unlock-confirm.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { renderNow, type DomRegion } from "../dom/dom-region.js";
import { CardEvents } from "../dom/card-events.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { ScenarioSearch } from "./scenario-select/search.js";
import { ScenarioHints } from "./scenario-select/hints.js";
import { pageModelOf } from "./scenario-select/page-model.js";
import { recordTextOf } from "./scenario-select/picked-model.js";
import { chipsOf, rosterShelvesOf } from "./scenario-select/roster.js";
import { renderTree } from "./scenario-select/render-tree.js";
import { rowOfKeyOf, shelvesModelOf } from "./scenario-select/shelves-model.js";
import { ScenarioTiles } from "./scenario-select/tiles.js";
import { ScenarioFocus } from "./scenario-select/focus.js";
import { randomOutcome, type RandomKind } from "./scenario-select/random.js";
import { mountScenarioPage } from "./scenario-select/mount.js";
import { createScenarioRoute } from "./scenario-select/route.js";
import { installDebugHook } from "./scenario-select/debug-hook.js";
import { chooseHeroes, goBack, inspectScenario, openBuilder } from "./scenario-select/leave.js";

export interface ScenarioSelectData {
  readonly draft: SetupDraft;
  /** Decks Take your seats should know before its own list loads (Decks & Collection's "Play this deck"). */
  readonly seedDecks?: readonly Deck[];
}

/** Where the shelves were scrolled to, kept outside the scene: a trip to Take your seats and back stops and starts it. */
let scrollMemory: { readonly top: number; readonly rows: Readonly<Record<string, number>> } = { top: 0, rows: {} };

export class ScenarioSelectScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #alive = false;
  /** Whether the phone's stages panel is open. Shut by default: it is reading, not choosing, and it crowds a small screen. */
  #stagesOpen = false;
  /** Narrow only: whether the search field is shown. Off by default: the roster gets the row. */
  #searchOpen = false;
  readonly #search = new ScenarioSearch();
  #region: DomRegion<McScenarioSelectPage> | null = null;
  #page: McScenarioSelectPage | null = null;
  readonly #tiles = new ScenarioTiles();
  #hover: HoverPreview | null = null;
  #cards: CardEvents | null = null;
  #canContinue = false;
  /** A screen change is under way (Back, Choose heroes): later presses do nothing. */
  #leaving = false;
  #route: FocusRoute | null = null;
  readonly #focus = new ScenarioFocus({
    page: () => this.#page,
    region: () => this.#region,
    route: () => this.#route,
    padFilters: () => this.#padFilters,
    chipsFolded: () => this.#chipsFolded,
    compose: () => this.#compose(),
    rowOfKey: () => this.#rowOfKey,
  });
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
  #seedDecks: readonly Deck[] = [];
  /** A pointer is going down: the focus it gives a native button is the screen's own tap, not the route's to chase. */
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
    if (import.meta.env.DEV) {
      installDebugHook({
        tiles: this.#tiles,
        selectedId: () => (this.#scenarioPicked() ? (this.#draft.scenarioId as string) : null),
        folded: () => this.#folded,
        drilledPack: () => this.#drill.packId,
        listRect: () => this.#listRect(),
        recordText: () => this.#recordText,
        hoverKey: () => this.#hover?.shownKey ?? null,
        stops: () => this.#focus.stops,
      });
    }
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
    this.#route = createScenarioRoute(this, {
      page: () => this.#page,
      focus: this.#focus,
      padFilters: () => this.#padFilters,
      canContinue: () => this.#canContinue,
      drilledPack: () => this.#drill.packId,
      drillOut: () => this.#drillOut(),
      back: () => this.#back(),
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this),
    );
    this.#search.setDocuments();
    // Packs load a moment after boot and change in the Mod Store: their scenarios appear (or go) under this screen.
    rebuildOnPackChange(this, () => {
      this.#search.setDocuments();
      this.#compose();
    });
    this.#compose();
    // Arriving by pad, focus is on the picked villain (coming back from Seats) or else the topmost one; a mouse or
    // touch player gets no ring, which would read as a preselection.
    if (padInputTracked()) {
      const picked = this.#scenarioPicked() ? `scenario:${this.#draft.scenarioId}` : null;
      const key = picked !== null && this.#focus.stops.has(picked) ? picked : this.#focus.firstTileKey;
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
    goBack(this);
  }

  /** Mounts the page once per visit; later composes only resize its region. */
  #mount(rect: Rect): McScenarioSelectPage {
    if (this.#page && this.#region) {
      this.#region.setRect(rect);
      return this.#page;
    }
    const mounted = mountScenarioPage(this, rect, {
      onSelect: (detail) => this.#onSelect(detail),
      leaving: () => this.#leaving,
      focusKey: (key) => this.#route?.focusKey(key),
      hover: () => this.#hover,
    });
    this.#region = mounted.region;
    this.#page = mounted.element;
    this.#cards = mounted.cards;
    return mounted.element;
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
      if (entry && !isBuilderTile(entry)) inspectScenario(this, entry);
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
    else if (key === "filters-toggle") this.#focus.toggleFilters();
    else if (key === "stages-toggle") this.#toggleStages();
    else if (key === "random-box" || key === "random-scenario" || key === "random-villain") this.#random(key);
    else if (key === "customize") this.#customize();
    else if (key === "next") this.#next();
  }

  #shelves(): ReturnType<typeof rosterShelvesOf> {
    return rosterShelvesOf({
      ranking: this.#search.ranking,
      product: this.#draft.scenarioFilter.product ?? null,
      pickedId: this.#scenarioPicked() ? (this.#draft.scenarioId as string) : null,
      folded: this.#folded,
    });
  }

  /** Builds the page model from the current state, hands it over and reads the focus stops off what it drew. */
  #compose(): void {
    // Not before `create` has bound the hints and the filters' fold (the hints' first snapshot arrives while it does).
    if (!this.#alive || !this.#padFilters || !this.#hints) return;
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
    this.#focus.read();
    this.#tiles.leases.end();
    this.#revealPicked();
    this.#hover?.onDraw();
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
    if (padInputTracked() && this.#focus.stops.has(`scenario:${id}`)) this.#route?.focusKey(`scenario:${id}`);
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
    this.#search.clear();
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

  /** A Random button: opens a box as a grid, or picks a scenario. */
  #random(kind: RandomKind): void {
    const outcome = randomOutcome(kind, this.#shelves(), this.#drill.packId);
    if (outcome?.kind === "box") this.#drillInto(outcome.shelfId);
    else if (outcome) this.#pickRandom(outcome.shelfId, outcome.entry);
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

  #requestSearch(text: string): void {
    this.#search.run(
      text,
      () => this.#compose(),
      () => this.sys.isActive(),
    );
  }

  #toggleSearch(): void {
    this.#searchOpen = !this.#searchOpen;
    // Shutting the field also clears its text: a filter whose field you can no longer see must not keep hiding
    // scenarios. The product chips are their own visible controls and stay as they were.
    if (!this.#searchOpen && this.#draft.scenarioFilter.text) {
      this.#draft = setScenarioFilter(this.#draft, { ...this.#draft.scenarioFilter, text: "" });
      this.#search.clear();
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

  #openBuilder(kind: "build" | "customize", scenarioId: string): void {
    this.scale.off("resize", this.#compose, this);
    openBuilder(this, this.#draft, this.#seedDecks, kind, scenarioId);
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
    chooseHeroes(this, this.#draft, this.#seedDecks);
  }
}

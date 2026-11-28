/**
 * Take your seats (docs/phase4-screen-gaps.md section 3 W2/W2b, D03/P03/T-P02): four selectable seat cards over an
 * **active-seat model**: the pack-shelf hero roster picks a hero *for the active seat* (`view/setup-draft.ts`), with a hero
 * detail panel, "Use preconstructed for all seats", "Play N heroes" on to Table setup and "Deck check" for the *active*
 * seat's own deck.
 *
 * **The screen is one custom element**, `mc-seats-page` (`views/seats/mc-seats-page`), composing the sections in
 * `components/seats/`. This scene mounts it, sets its `model` from the draft and the engine's seat options (`scenes/seats/`),
 * handles the `mc-seats` events (`seats-actions.ts`) and keeps what is a decision: the draft, the text search worker, the
 * focus route (its ring drawn in the panel layer), the card hover popover and navigation. Layout is the page's CSS.
 */
import "@mc/ui";
import Phaser from "phaser";
import type { Deck } from "@mc/content";
import type { CardId } from "@mc/content";
import { PackLeases } from "../art/pack-art.js";
import "../views/seats/mc-seats-page/mc-seats-page.js";
import type { McSeatsRoster } from "../components/seats/mc-seats-roster/McSeatsRoster.js";
import type { SeatsHintsModel, SeatsPageModel } from "../components/seats/seats.types.js";
import { CardEvents } from "../dom/card-events.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { padInputTracked } from "../platform/input-device.js";
import { refreshUnlocks } from "../progression/progression.js";
import { appSession, deckStorage } from "../session.js";
import { surface } from "../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn } from "../ui/transitions.js";
import { areaOf } from "../view/focus-areas.js";
import { pruneSeats, type SetupDraft } from "../view/setup-draft.js";
import { bindExtraInput } from "./extra-input.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { pagingGlyphsOf } from "./seats/seats-paging.js";
import { installSeatsDebug } from "./seats/seats-debug.js";
import { unresolvedConflictsOf } from "./seats/seats-flow.js";
import { deckIdOfStop, focusOrderOf, sheetRoute, withInspect } from "./seats/seats-order.js";
import { type RosterKeys } from "./seats/seats-roster-model.js";
import { SeatsSearch } from "./seats/seats-search.js";
import { goBack, goToTableSetup } from "./seats/seats-flow.js";
import { tipZoneOf, watchTipLeave, wirePage, type SearchFieldLike } from "./seats/seats-listeners.js";
import { hintsModelOf } from "./seats/seats-hints-model.js";
import { FilterAreas } from "./seats/seats-filter-areas.js";
import { SeatsActions } from "./seats/seats-actions.js";
import { buildSeatsPage } from "./seats/seats-page-model.js";
import { SeatsState } from "./seats/seats-state.js";
import { detailModelOf } from "./seats/seats-table-model.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export interface SeatsData {
  readonly draft: SetupDraft;
  /** Decks to list before `deckStorage().list()` resolves: "Play this deck" (W9) seeds the one it seats. */
  readonly seedDecks?: readonly Deck[];
  /** Open the "Cards that can't be played" sheet on arrival (Deck check's Start game with a clash still open). */
  readonly promptConflicts?: boolean;
  /** Back returns to the Civil War builder (the draft came from it) rather than to Scenario select. */
  readonly backTo?: "civil-war-builder";
}

/** Where the roster was scrolled when the screen was left, so a trip to Deck check and back returns to the same place. */
let rememberedScroll: ReturnType<McSeatsRoster["readScroll"]> | null = null;

export class SeatsScene extends Phaser.Scene {
  readonly #st = new SeatsState();
  readonly #actions: SeatsActions;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-seats-page"]> | null = null;
  #route: FocusRoute | null = null;
  #glyphs!: ControlGlyphs;
  #fa!: FilterAreas;
  #hover: HoverPreview | null = null;
  #cards: CardEvents | null = null;
  readonly #leases = new PackLeases();
  #stops = new Map<string, FocusStop>();
  #page: SeatsPageModel | null = null;
  #roster: { readonly keys: RosterKeys; readonly shelfOfKey: ReadonlyMap<string, string> } | null = null;
  #leaving = false;
  #alive = false;
  #typing = false;
  #promptOnOpen = false;
  #backTo: SeatsData["backTo"] | null = null;
  #seedDecks: readonly Deck[] = [];
  #firstTileKey: string | null = null;
  /** The stop that had focus when the Pick a deck sheet took the route; it gets focus back when the sheet closes. */
  #heldFocus: string | null = null;
  #built = 0;

  constructor() {
    super(SCENES.seats);
    this.#actions = new SeatsActions(this, this.#st, {
      rebuild: () => this.#rebuild(),
      back: () => this.#back(),
      goToTableSetup: () => this.#goToTableSetup(),
      leave: () => void this.#leave(),
      toggleFilters: () =>
        this.#fa.toggle(
          this.#route,
          () => this.#rebuild(),
          () => this.#renderPage(),
        ),
      focusSearchField: () => void this.#focusAfterRender(() => "hero-search"),
    });
  }

  init(data: SeatsData): void {
    this.#promptOnOpen = data.promptConflicts ?? false;
    this.#st.draft = data.draft;
    this.#backTo = data.backTo ?? null;
    this.#seedDecks = data.seedDecks ?? [];
    this.#mounted = null;
    this.#page = null;
  }

  create(): void {
    // Phaser reuses this scene: nothing from the last visit carries over.
    this.#leaving = false;
    this.#alive = true;
    this.#typing = false;
    this.#st.tipAspect = null;
    this.#st.decksKey = null;
    this.#st.hoverDeckId = null;
    this.#st.focusDeckId = null;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-seats-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    const { region, element } = mounted;
    this.#st.search = new SeatsSearch(
      () => this.#rebuild(),
      () => this.sys.isActive(),
    );
    wirePage(element, {
      seats: (detail) => !this.#leaving && this.#actions.onSeats(detail),
      typing: (focused) => (this.#typing = focused),
      hover: (id) => this.#setHoverDeck(id),
    });
    const tipOff = watchTipLeave(
      () => (this.#st.tipAspect ? tipZoneOf(element, this.#st.tipAspect) : null),
      () => {
        this.#st.tipAspect = null;
        this.#rebuild();
      },
    );
    this.scale.on("resize", this.#rebuild, this);
    rebuildOnPackChange(this, () => this.#rebuild());
    const artOff = onArtChange(() => this.sys.isActive() && this.#rebuild());
    const languageOff = onLanguageChange(() => this.sys.isActive() && this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      languageOff();
      tipOff();
      // Where the roster was scrolled, for the way back from Deck check; the page goes with the scene (`DomRegion`).
      rememberedScroll = this.#section<McSeatsRoster>("mc-seats-roster")?.readScroll() ?? null;
      this.#mounted = null;
      this.#cards?.destroy();
      this.#hover?.destroy();
      this.#hover = null;
      this.#st.search.destroy();
      this.#glyphs.dispose();
      this.#leases.dispose();
    });
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) =>
      this.scene.launch(SCENES.inspect, { card: { cardId: cardId as CardId, face: face ?? { kind: "hero" } } });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#typing }),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    this.#glyphs = new ControlGlyphs(this, () => this.#rebuild());
    this.#fa = new FilterAreas(this, () => this.#rebuild());
    const covered = (): boolean =>
      this.scene.isActive(SCENES.inspect) ||
      this.scene.isActive(SCENES.unlockConfirm) ||
      this.scene.isActive(SCENES.nameConflict) ||
      this.scene.isActive(SCENES.aspectLesson);
    // A pad that put the caret in the search field can take it out again (B, A or Start), bound before the route.
    bindTextFieldEscape(this, () => this.#searchField(), covered);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onFocusChange: (key) => this.#onFocusChange(key),
      blocked: () => covered() || this.#typing,
      onCancel: () => this.#onCancel(),
      // Y is the filters' fold on a pad (the keyboard keeps Inspect); LT / RT page the row; Start plays; LB / RB step the seat;
      // X clears it; the stick, PageUp / PageDown and Home / End scroll the list.
      onInspect: (source) => {
        if (source === "key" || !this.#fa.pad.padMode) return false;
        this.#fa.toggle(
          this.#route,
          () => this.#rebuild(),
          () => this.#renderPage(),
        );
        return true;
      },
      onTrigger: (trigger) => this.#pageRow(trigger === "lt" ? -1 : 1),
      primary: () => (this.#stops.has("play") ? "play" : null),
      onTab: (direction) => this.#actions.stepSeat(direction),
      onToggle: () => this.#actions.clearSeatByPad(this.#route?.focused ?? null),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) => {
        const scroller = this.#scroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * 0.85 });
      },
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    bindStopFocus(element, (key) => this.#route?.focusKey(key));
    bindExtraInput(this, {
      blocked: () => covered() || this.#typing,
      intents: {
        view: () => {
          const key = this.#route?.focused ?? null;
          if (this.#fa.pad.padMode && key !== null && /^hero(-rec)?:/.test(key)) this.#route?.inspectFocused();
        },
      },
    });
    this.game.events.on("mc-choice-toggle", this.#actions.onInspectChoose, this.#actions);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off("mc-choice-toggle", this.#actions.onInspectChoose, this.#actions),
    );
    this.#st.book.savedDecks = this.#seedDecks;
    this.#rebuild();
    // Arriving by pad at blank seats, focus is on the topmost hero rather than Back. A mouse or touch player gets no
    // ring (it would read as a preselection), and a return trip (Deck check, Table setup) keeps its own place.
    if (this.#st.draft.seats.length === 0 && padInputTracked()) void this.#focusAfterRender(() => this.#firstTileKey);
    fadeScreenIn(this);
    void refreshUnlocks().then((changed) => {
      if (changed && this.sys.isActive()) this.#rebuild();
    });
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#st.book.savedDecks = decks;
        this.#rebuild();
        if (this.#promptOnOpen) {
          this.#promptOnOpen = false;
          if (unresolvedConflictsOf(this.#st.draft, this.#st.book.deckOptions()).length > 0)
            this.#actions.openConflictSheet();
        }
      });
  }

  /** The page's own events: the sections' `mc-seats`, the hover on a tile (what the detail panel explains), a stale picture. */
  #section<E extends HTMLElement>(tag: string): E | null {
    return this.#mounted?.element.section<E>(tag) ?? null;
  }

  #searchField(): SearchFieldLike | null {
    const filters = this.#section("mc-seats-filters");
    return (filters?.shadowRoot?.querySelector("mc-search-field") as SearchFieldLike) ?? null;
  }

  #scroller(): HTMLElement | null {
    return this.#section<McSeatsRoster>("mc-seats-roster")?.scroller ?? null;
  }

  #goToTableSetup(): void {
    if (this.#leave()) goToTableSetup(this, this.#st.draft);
  }

  #back(): void {
    if (this.#leave()) goBack(this, this.#st.draft, this.#st.book.savedDecks, this.#backTo);
  }

  /** The screen is leaving: later presses do nothing, and a resize no longer redraws it. False when it already was. */
  #leave(): boolean {
    if (this.#leaving) return false;
    this.#leaving = true;
    this.scale.off("resize", this.#rebuild, this);
    return true;
  }

  /** B / Escape: shuts an open sheet or tip, then from the list returns to the filters (scrolled to the top), then backs out. */
  #onCancel(): void {
    if (this.#st.decksKey !== null) {
      this.#st.decksKey = null;
      this.#rebuild();
      return;
    }
    if (this.#st.tipAspect !== null) {
      this.#st.tipAspect = null;
      this.#rebuild();
      return;
    }
    if (areaOf(this.#route?.focused ?? null, this.#fa.areas) === "list")
      this.#fa.jump(
        this.#route,
        true,
        this.#scroller(),
        () => this.#rebuild(),
        () => this.#renderPage(),
      );
    else if (this.#st.drill.packId !== null) this.#actions.drillOut();
    else this.#back();
  }

  /** LT / RT: pages the shelf row focus is in, as its chevron would, and moves focus to the first card in view. */
  #pageRow(direction: 1 | -1): void {
    const shelfId = this.#roster?.shelfOfKey.get(this.#route?.focused ?? "");
    const first =
      shelfId === undefined
        ? null
        : (this.#section<McSeatsRoster>("mc-seats-roster")?.pageShelf(shelfId, direction) ?? null);
    if (first !== null) this.#route?.focusKey(first);
    this.#refreshLight();
  }

  #onFocusChange(key: string | null): void {
    this.#st.focusDeckId = key === null ? null : deckIdOfStop(key);
    this.#refreshLight();
    // Focus moving off the open tip's own "i" (and its link) shuts it.
    if (
      this.#st.tipAspect !== null &&
      key !== null &&
      key !== `hero-chip-info:${this.#st.tipAspect}` &&
      key !== "aspect-tip-link"
    ) {
      this.#st.tipAspect = null;
      this.#rebuild();
    }
  }

  #setHoverDeck(deckId: string | null): void {
    if (deckId === this.#st.hoverDeckId) return;
    this.#st.hoverDeckId = deckId;
    this.#refreshLight();
  }

  /** The detail panel's insights and the paging glyphs follow the hover and focus: the page's model changes, nothing is composed again. */
  #refreshLight(): void {
    const page = this.#page;
    const mounted = this.#mounted;
    if (!page || !mounted || !this.#alive) return;
    const { book, draft } = this.#st;
    const detail = detailModelOf(
      draft,
      book.deckOptions(),
      book.insightsNow(),
      this.#st.hoverDeckId ?? this.#st.focusDeckId,
    );
    const roster = { ...page.roster, ...this.#pagingOf() };
    this.#page = { ...page, detail, roster, hints: page.wide ? this.#hintsNow() : null };
    mounted.element.model = this.#page;
  }

  /** The heading and key hints: the Y word follows where focus is now. */
  #hintsNow(): SeatsHintsModel {
    return hintsModelOf({
      glyphs: this.#glyphs,
      activeSeat: this.#st.draft.activeSeatIndex,
      focused: this.#route?.focused ?? null,
      areas: this.#fa.areas,
      padMode: this.#fa.pad.padMode,
    });
  }

  /** LT before and RT after the focused shelf's row, on a pad only. */
  #pagingOf(): Pick<SeatsPageModel["roster"], "pagingHintShelf" | "pagingGlyphs"> {
    const shelfId = this.#roster?.shelfOfKey.get(this.#route?.focused ?? "");
    const glyphs = shelfId === undefined ? null : pagingGlyphsOf(this.#glyphs.snapshot);
    return glyphs
      ? { pagingHintShelf: shelfId ?? null, pagingGlyphs: glyphs }
      : { pagingHintShelf: null, pagingGlyphs: null };
  }

  async #renderPage(): Promise<void> {
    const mounted = this.#mounted;
    if (mounted) await renderDeep(mounted.element);
  }

  /** Full redraw: the page's model from the current state (a resize, a pick, a filter, a verdict from the search worker). */
  #rebuild(): void {
    const mounted = this.#mounted;
    if (!this.#alive || !mounted) return;
    const { region, element } = mounted;
    const st = this.#st;
    this.#leases.begin();
    resetHoverCards(this);
    const { width, height } = this.scale.gameSize;
    region.setRect({ x: 0, y: 0, width, height });
    const options = st.book.deckOptions();
    st.draft = pruneSeats(st.draft, new Set(options.map((o) => o.deck.id as string)), options[0]?.deck.id as string);
    st.book.draft = st.draft;
    st.book.ranking = st.search.ranking;
    st.book.folded = st.folded;
    st.search.sync(options, st.draft.heroFilter.text);
    const behindButton = this.#fa.pad.behindButton(width);
    const folded = this.#fa.pad.folded(width);
    this.#fa.folded = folded;
    const built = buildSeatsPage({
      scene: this,
      st,
      leases: this.#leases,
      glyphs: this.#glyphs,
      width,
      height,
      phone: this.#actions.phone(),
      behindButton,
      folded,
      typed: this.#searchField()?.text ?? null,
      paging: this.#pagingOf(),
      hints: () => this.#hintsNow(),
    });
    this.#page = built.page;
    this.#roster = built;
    this.#firstTileKey = built.firstTileKey;
    element.model = built.page;
    const stamp = ++this.#built;
    void renderDeep(element).then(() => {
      if (stamp !== this.#built || !this.#alive) return;
      this.#leases.end();
      // Back from Deck check (or Table setup): the roster is where it was left.
      if (rememberedScroll) {
        this.#section<McSeatsRoster>("mc-seats-roster")?.restoreScroll(rememberedScroll);
        rememberedScroll = null;
      }
      this.#routeStops(built.conflicts > 0, folded, behindButton, built.wide);
      this.#hover?.onDraw();
    });
    installSeatsDebug(this, {
      draft: () => st.draft,
      book: st.book,
      drill: () => st.drill,
      folded: () => st.folded,
      stops: () => this.#stops,
      roster: () => this.#section("mc-seats-roster"),
      insights: () => built.insights,
      hover: (id) => this.#setHoverDeck(id),
      decksOpen: () => st.decksKey !== null,
    });
  }

  /** The route's stops, read from the rendered page (or from the Pick a deck sheet while it is up). */
  #routeStops(hasNotice: boolean, folded: boolean, behindButton: boolean, wide: boolean): void {
    const mounted = this.#mounted;
    const page = this.#page;
    if (!mounted || !page) return;
    const { region, element } = mounted;
    const rectOf = (target: Element) => region.rectOf(target);
    if (this.#st.decksKey !== null) {
      const sheet = this.#section("mc-hero-decks-sheet");
      if (sheet) {
        this.#heldFocus ??= this.#route?.focused ?? null;
        const { order, stops } = sheetRoute(sheet, rectOf);
        this.#stops = stops;
        this.#route?.set(order, stops);
        return;
      }
    }
    // Y on a stop with no Inspect of its own jumps between the filters and the list; a hero tile keeps its Inspect.
    const stops = withInspect(
      focusStopsOf(element, rectOf),
      (key) => this.#actions.onSeats({ type: "hero", key, via: "inspect" }),
      () =>
        this.#fa.jump(
          this.#route,
          false,
          this.#scroller(),
          () => this.#rebuild(),
          () => this.#renderPage(),
        ),
    );
    this.#stops = stops;
    const chips = folded ? [] : page.filters.chips;
    const { order, areas } = focusOrderOf({
      keys: this.#roster!.keys,
      chipIds: chips.map((chip) => chip.id),
      infoChipIds: new Set(chips.filter((chip) => chip.info).map((chip) => chip.id)),
      narrow: !wide,
      filtersToggle: behindButton,
      hasNotice,
      tipAspect: page.filters.tipChipId?.slice("aspect:".length) ?? null,
    });
    this.#fa.areas = areas;
    this.#route?.set(order, stops);
    if (this.#heldFocus !== null) {
      if (order.includes(this.#heldFocus)) this.#route?.focusKey(this.#heldFocus);
      this.#heldFocus = null;
    }
  }

  /** Focus goes to the key once the page has drawn its stops. */
  async #focusAfterRender(key: () => string | null): Promise<void> {
    await this.#renderPage();
    const target = key();
    if (target !== null) this.#route?.focusKey(target);
  }
}

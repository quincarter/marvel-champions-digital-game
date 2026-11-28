/**
 * The Decks & Collection screen (PLAN.md Phase 9 / W9b, docs/phase4-screen-gaps.md section 3, D14): every precon plus every
 * saved or imported deck, each with its legality and playability status; a searchable, filterable list (S8); the *selected*
 * deck own browsable card pool; its stats; the tested community decks; import by paste and by MarvelCDB link; save, delete,
 * duplicate, export, and "Play this deck".
 *
 * **The screen is one custom element**, `mc-decks-page` (`views/decks/mc-decks-page`), composing the sections in
 * `components/decks/`: the ink header, the deck list with its Import / Export box, the card pool and the ink stats rail
 * (three panes side by side, or one at a time behind the tab rail). This scene mounts it, sets its `model` from the engine
 * view models (`scenes/decks/`), handles the `mc-decks` events (`decks-actions.ts`) and keeps what is a decision: the
 * selection, the two text searches (workers), the focus route (its ring drawn in the panel layer), the card hover popover and
 * navigation. Layout is the page CSS. A deck row tap **selects** it rather than navigating away; a pool card tap puts it in
 * the stats pane. Every legality, playability and record fact shown is `@mc/engine` own (`view/deck-list-model.ts`,
 * `view/deck-status.ts`, `view/results-history.ts`): this scene never decides whether a deck is legal.
 */
import "@mc/ui";
import Phaser from "phaser";
import "../views/decks/mc-decks-page/mc-decks-page.js";
import type { McDecksCards } from "../components/decks/mc-decks-cards/McDecksCards.js";
import type { McDecksList } from "../components/decks/mc-decks-list/McDecksList.js";
import { DECKS_EVENT, type DecksEvent } from "../components/decks/decks.types.js";
import { loadDeckInsights } from "../view/player-stats-client.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, collectStops } from "../dom/element-stops.js";
import { artLanguageNow } from "../art/art-source.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { refreshUnlocks } from "../progression/progression.js";
import { appSession, deckStorage } from "../session.js";
import { surface } from "../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn } from "../ui/transitions.js";
import { CardPoolSearch } from "../view/card-pool-search.js";
import { freshDeckVisit, readLastDeckList } from "../view/deck-list-open.js";
import { resultsHistoryOf } from "../view/results-history.js";
import type { DecksTab } from "../view/decks-layout.js";
import { decksRouteOf } from "./decks/decks-route.js";
import { installDecksDebug } from "./decks/decks-debug.js";
import { DecksActions } from "./decks/decks-actions.js";
import { DecksBook } from "./decks/decks-book.js";
import { buildDecksPage, type PageBuild } from "./decks/decks-page-model.js";
import { poolDocuments } from "./decks/decks-pool-model.js";
import { DecksState, type DecksSceneData } from "./decks/decks-state.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export type { DecksSceneData } from "./decks/decks-state.js";

/** How long a finished load waits for the others before the screen redraws. */
const REBUILD_COALESCE_MS = 40;

type CaretElement = HTMLElement & { readonly focused?: boolean; blurInput?: () => void };

export class DecksScene extends Phaser.Scene {
  #st = new DecksState();
  #book!: DecksBook;
  #actions!: DecksActions;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-decks-page"]> | null = null;
  #route: FocusRoute | null = null;
  #glyphs!: ControlGlyphs;
  #hover: HoverPreview | null = null;
  #cards: CardEvents | null = null;
  #stops = new Map<string, FocusStop>();
  #build: PageBuild | null = null;
  #rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  #typing = false;
  #alive = false;
  #built = 0;

  constructor() {
    super(SCENES.decks);
  }

  create(data: DecksSceneData = {}): void {
    // Phaser reuses this scene: nothing from the last visit carries over.
    this.#st = new DecksState();
    const st = this.#st;
    this.#alive = true;
    this.#typing = false;
    this.#build = null;
    this.#stops = new Map();
    st.data = data;
    // Title only sends a message here when a deck could not be seated.
    st.status = data.message ? { text: data.message, tone: "error" } : null;
    st.selectedDeckId = data.focusDeckId ?? null;
    st.poolSearch = new CardPoolSearch({
      alive: () => this.sys.isActive(),
      language: () => artLanguageNow(),
      documents: () => poolDocuments(st),
      onChange: () => {
        st.poolTop += 1;
        this.#rebuild();
      },
    });
    // A deck asked for by id (just saved, or sent here) is looked for in every list, so it is never filtered away.
    const settings = appSession().settings;
    const visit = freshDeckVisit(
      data.focusDeckId,
      settings.deckListOnOpen,
      readLastDeckList(),
      settings.showPreconDecks,
    );
    st.deckList = visit.deckList;
    st.focusPinned = visit.focusPinned;
    st.fallbackSelection = visit.fallbackSelection;
    this.#book = new DecksBook(st, {
      queueRebuild: () => this.#queueRebuild(),
      rebuild: () => this.#rebuild(),
      isActive: () => this.sys.isActive(),
    });
    this.#actions = new DecksActions(this, st, this.#book, {
      rebuild: () => this.#rebuild(),
      focusKey: (key) => void this.#focusAfterRender(key),
      tabsShown: () => this.#build !== null && !this.#build.wide,
      isActive: () => this.sys.isActive(),
    });
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-decks-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    const { region, element } = mounted;
    st.pictures.watch(element);
    element.addEventListener(DECKS_EVENT, (event) => {
      this.#actions.handle((event as CustomEvent<DecksEvent>).detail);
    });
    const typing = (event: Event): void => {
      this.#typing = (event as CustomEvent<{ focused: boolean }>).detail.focused;
    };
    element.addEventListener("mc-search-focus", typing);
    element.addEventListener("mc-field-focus", typing);
    resetHoverCards(this);
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) =>
      this.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? { kind: "hero" } } });
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
    this.scale.on("resize", this.#rebuild, this);
    rebuildOnPackChange(this, () => this.#rebuild());
    const artOff = onArtChange(() => this.sys.isActive() && this.#rebuild());
    const languageOff = onLanguageChange(() => this.sys.isActive() && this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      languageOff();
      if (this.#rebuildTimer !== null) clearTimeout(this.#rebuildTimer);
      this.#rebuildTimer = null;
      this.#mounted = null;
      this.#cards?.destroy();
      this.#hover?.destroy();
      this.#hover = null;
      st.deckSearch.destroy();
      st.poolSearch.destroy();
      st.pictures.dispose();
      this.#glyphs.dispose();
    });
    // A pad that put the caret in a field can take it out again (B, A or Start), bound before the route.
    const covered = (): boolean => this.scene.isActive(SCENES.inspect);
    for (const key of ["deck-search", "pool-search", "paste-field", "marvelcdb-field"]) {
      bindTextFieldEscape(
        this,
        () => {
          const field = this.#field(key);
          return field ? { focused: field.focused ?? false, blur: () => field.blurInput?.() } : null;
        },
        covered,
      );
    }
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // B leaves for Title, as the Back button does (a field being typed in owns the keys, so this is not reached then).
      onCancel: () => {
        // A card in the stats pane goes back to the deck stats first; an open Paste / CDB link box closes first.
        if (st.paneCard && this.#stops.has("card-back")) this.#actions.closePaneCard(true);
        else if (st.importExportOpen !== null) {
          st.importExportOpen = null;
          this.#rebuild();
        } else this.#stops.get("back")?.activate();
      },
      // LB / RB step Decks, Cards and Stats on a narrow screen; on the three-pane layout there is no strip, so they page.
      onTab: (direction) => this.#stepTab(direction),
      // LT / RT: the stats pane two tabs.
      onTrigger: (trigger) => this.#actions.setPaneTab(trigger === "lt" ? "deck" : "games"),
      // X (G / H on the keyboard) opens Your stats.
      onToggle: () => this.#stops.get("player-stats")?.activate(),
      blocked: () => this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.deckActions) || this.#typing,
      onPage: (direction) => {
        const scroller = this.#pageScroller();
        scroller?.scrollBy({ top: direction * scroller.clientHeight * 0.85 });
      },
      onScroll: (_dx, dy) => this.#pageScroller()?.scrollBy({ top: dy }),
      onHomeEnd: (edge) => this.#pageScroller()?.scrollTo({ top: edge === "home" ? 0 : Number.MAX_SAFE_INTEGER }),
    });
    bindStopFocus(element, (key) => this.#route?.focusKey(key));
    this.#rebuild();
    fadeScreenIn(this);
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        st.savedDecks = decks;
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
        st.history = resultsHistoryOf(saves);
        this.#queueRebuild();
        return loadDeckInsights(saves).then((insights) => {
          if (!this.sys.isActive()) return;
          st.insights = insights;
          this.#queueRebuild();
        });
      })
      .catch(() => undefined);
  }

  /** One redraw for the loads that finish together (saved decks, unlocks, saves, a worker statuses): each used to redraw the whole screen on its own (#226). */
  #queueRebuild(): void {
    if (this.#rebuildTimer !== null) return;
    this.#rebuildTimer = setTimeout(() => {
      this.#rebuildTimer = null;
      if (this.sys.isActive()) this.#rebuild();
    }, REBUILD_COALESCE_MS);
  }

  /** A stop element's field (a search or a text field), found through the collected stops, never by a selector. */
  #field(key: string): CaretElement | null {
    const page = this.#mounted?.element;
    return page
      ? ((collectStops(page).find((stop) => stop.key === key)?.element as CaretElement | undefined) ?? null)
      : null;
  }

  /** The list the pad paging and right stick scroll: the pool on the Cards tab, else the deck list. */
  #pageScroller(): HTMLElement | null {
    const page = this.#mounted?.element;
    if (!page) return null;
    return this.#st.activeTab === "cards"
      ? (page.section<McDecksCards>("mc-decks-cards")?.grid ?? null)
      : (page.section<McDecksList>("mc-decks-list")?.scroller ?? null);
  }

  #stepTab(direction: 1 | -1): void {
    if (this.#build?.wide !== false) {
      const scroller = this.#pageScroller();
      scroller?.scrollBy({ top: direction * scroller.clientHeight * 0.85 });
      return;
    }
    const order: readonly DecksTab[] = ["decks", "cards", "stats"];
    const next = order[order.indexOf(this.#st.activeTab) + direction];
    if (next) this.#actions.setTab(next);
  }

  /** Focus goes to the key once the page has drawn its stops. */
  async #focusAfterRender(key: string): Promise<void> {
    const mounted = this.#mounted;
    if (mounted) await renderDeep(mounted.element);
    this.#route?.focusKey(key);
  }

  /** Full redraw: the page model from the current state (a resize, a pick, a filter, a verdict from a worker). */
  #rebuild(): void {
    const mounted = this.#mounted;
    if (!this.#alive || !mounted) return;
    const { region, element } = mounted;
    const st = this.#st;
    st.pictures.begin();
    resetHoverCards(this);
    this.#actions.refreshSheet();
    const { width, height } = this.scale.gameSize;
    region.setRect({ x: 0, y: 0, width, height });
    const built = buildDecksPage({ scene: this, st, book: this.#book, glyphs: this.#glyphs, width, height });
    this.#build = built;
    element.model = built.page;
    const stamp = ++this.#built;
    void renderDeep(element).then(() => {
      if (stamp !== this.#built || !this.#alive) return;
      st.pictures.end();
      this.#routeStops(built);
      this.#hover?.onDraw();
    });
    installDecksDebug({
      stops: () => this.#stops,
      build: () => this.#build,
      status: () => st.status,
      hoverShown: () => this.#hover?.shownKey ?? null,
      selectedId: () => st.selectedDeckId,
    });
  }

  /** The route stops, read from the rendered page, with the pool cards made from the grid geometry. */
  #routeStops(built: PageBuild): void {
    const mounted = this.#mounted;
    if (!mounted) return;
    const { order, stops } = decksRouteOf({
      page: mounted.element,
      region: mounted.region,
      build: built,
      st: this.#st,
      actions: this.#actions,
      tab: this.#st.activeTab,
    });
    this.#stops = stops;
    this.#route?.set(order, stops);
  }
}

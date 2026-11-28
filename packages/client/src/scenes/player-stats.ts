/**
 * Your stats: a tabbed dashboard of what the player's finished games say about how they play. The whole screen is one page
 * element, `mc-player-stats-page` (`views/player-stats/`), made of section elements (`components/player-stats/`), worded by
 * `view/player-stats-page-model.ts`. This scene mounts it, sets its properties, handles its `mc-player-stats` events and
 * keeps the focus route, the card hover popover and what outlives a visit (`player-stats-state.ts`).
 *
 * Opened two ways (`PlayerStatsData`): as a screen from the Title, Decks & Collection or the Trophy Room (Back goes to
 * that screen), or as an overlay over Settings or Pause (Back closes it, and the scene under it takes input again).
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/player-stats/mc-player-stats-page/mc-player-stats-page.js";
import { currentCardsById } from "../content/pool.js";
import { PictureLeases } from "../dom/picture-leases.js";
import { surface } from "../tokens.js";
import type { HoverPreview } from "../ui/card-hover-preview.js";
import { resetHoverCards } from "../ui/card-hover-preview.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import type { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { renderNow } from "../dom/dom-region.js";
import { formFactorFor } from "../view/layout.js";
import { loadPlayerStats } from "../view/player-stats-client.js";
import {
  settleSource,
  switchSource,
  statsTabsFor,
  type SourceState,
  type StatsSource,
} from "../view/global-stats-ui.js";
import { readConsent } from "../global-stats/global-consent.js";
import { statsPageModelOf, SIDE_LIST_MIN_SCREEN } from "../view/player-stats-page-model.js";
import { shownGridOf } from "../view/player-stats-matchup-model.js";
import { heroAt, statsTabsOf, type StatsTab } from "../view/player-stats-tabs.js";
import type { MatchupKind, MatchupView } from "../view/matchup-grid.js";
import type { PlayerStats } from "../view/player-stats-model.js";
import type { StatsEventDetail } from "../components/player-stats/shared/stats-events.types.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { PastGamesSceneData } from "./past-games.js";
import { playerStatsLooks, watchStatsArt } from "./player-stats-looks.js";
export type { PlayerStatsData } from "./player-stats-state.js";
import { StatsBackdrop } from "./player-stats-backdrop.js";
import { StatsEveryone } from "./player-stats-everyone.js";
import { statsInputOf } from "./player-stats-input.js";
import { mountStatsPage, type StatsPage } from "./player-stats-mount.js";
import { installStatsDebug } from "./player-stats-debug.js";
import { listKeysOf, pagedKeyOf, readStops } from "./player-stats-stops.js";
import { cursorOf, mem, nextFilterOf, setCursor, type PlayerStatsData } from "./player-stats-state.js";

export class PlayerStatsScene extends Phaser.Scene {
  /** Counts reads of the saves, so a fold that answers after a newer one began is dropped (`#load`). */
  #loads = 0;
  #data: PlayerStatsData = {};
  #page: StatsPage | null = null;
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #cards: CardEvents | null = null;
  #unbind: (() => void) | null = null;
  #alive = false;
  #glyphs!: ControlGlyphs;
  #stats: PlayerStats | null = null;
  #failed = false;
  /** The leases this screen holds on its mounted card and hero pictures (`dom/picture-leases.ts`). */
  readonly #pictures = new PictureLeases();
  #offArt: (() => void)[] = [];
  #syncQueued = false;
  /** The wallpaper behind the panel. */
  #backdrop!: StatsBackdrop;
  /** Everyone's numbers and sharing. */
  readonly #everyone = new StatsEveryone();

  constructor() {
    super(SCENES.playerStats);
  }

  init(data: PlayerStatsData): void {
    this.#data = data ?? {};
  }

  create(): void {
    this.#alive = true;
    this.#stats = null;
    this.#failed = false;
    this.#everyone.reset();
    this.#page = null;
    const under = this.#data.overlay && this.#data.from ? this.scene.get(this.#data.from) : null;
    if (under) {
      under.input.enabled = false;
      if (under.input.keyboard) under.input.keyboard.enabled = false;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#backdrop = new StatsBackdrop(this);
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#onResize, this);
    resetHoverCards(this);
    // Pictures arrive after the first draw, and older games being filled in (#529) move the Overview's note.
    this.#offArt = watchStatsArt(this, {
      redraw: () => this.#compose(),
      reload: () => void this.#load(),
    });
    const mounted = mountStatsPage(this, {
      overlay: under !== null,
      pictures: this.#pictures,
      heard: (detail) => this.#heard(detail),
      rendered: () => this.#queueStops(),
      focused: (key) => this.#route?.focusKey(key),
    });
    this.#page = mounted.page;
    this.#hover = mounted.hover;
    this.#cards = mounted.cards;
    this.#unbind = mounted.unbind;
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#back(),
      onTab: (direction) => this.#stepTab(direction),
      onTrigger: (trigger) => {
        if (mem.tab === "matchups") this.#setGrid(trigger === "lt" ? "heroes" : "modulars", true);
        else this.#stepHero(trigger === "lt" ? -1 : 1, true);
      },
      onPage: (direction) => this.#pageFocus(direction),
      onHomeEnd: (edge) => this.#focusEdge(edge),
      onScroll: (dx, dy) => {
        const page = this.#page?.element;
        page?.grid?.scroller?.scrollBy({ left: dx, top: dy });
        page?.list?.scroller?.scrollBy({ top: dy });
      },
      // X (G / H): to the filter chips, opening them on a phone (on Everyone, which has none, to the You / Everyone
      // chips); the chip it lands on wears the glyph.
      onToggle: () => this.#focusFilters(),
      // View on a pad (a plain press) and Shift+B / Shift+N on a keyboard: the other side of the You / Everyone switch.
      onLog: () => this.#chooseSource(mem.source === "you" ? "everyone" : "you", true),
      blocked: () => this.scene.isActive(SCENES.inspect),
      // The grid's chips and its cursor can sit far apart across the screen: an arrow still goes from one to the other.
      reachAcross: () => (this.#page?.element.grid ?? null) !== null,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#pictures.dispose();
      for (const off of this.#offArt) off();
      this.#offArt = [];
      this.#glyphs.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.scale.off("resize", this.#onResize, this);
      this.#page = null;
      if (under) {
        under.input.enabled = true;
        if (under.input.keyboard) under.input.keyboard.enabled = true;
      }
    });
    if (import.meta.env.DEV)
      installStatsDebug({ page: () => this.#page, hover: () => this.#hover, backdrop: () => this.#backdrop });
    this.#backdrop.draw(() => this.#alive && this.#onResize());
    this.#compose();
    if (!under) fadeScreenIn(this);
    void this.#load(true);
  }

  #onResize(): void {
    this.#backdrop.draw(() => this.#alive && this.#onResize());
    this.#compose();
  }

  /** Reads the saves and folds them; `first`: the visit's first read, which applies the tab and hero it opened on. */
  async #load(first = false): Promise<void> {
    // Only the latest read may publish: an older fold (an earlier filter) that answers last is dropped.
    const token = ++this.#loads;
    try {
      const stats = await loadPlayerStats(await appSession().store.listSaves(), undefined, mem.filter);
      if (!this.#alive || token !== this.#loads) return;
      this.#stats = stats;
      if (first && this.#data.tab) {
        // Opened on a named tab (Cards by hero): your own numbers.
        mem.tab = this.#data.tab;
        mem.source = "you";
        mem.cameFrom = null;
      }
      const hero =
        first && this.#data.heroId ? stats.heroCards.findIndex((h) => h.identityCardId === this.#data.heroId) : -1;
      if (hero >= 0) mem.hero = hero;
    } catch {
      if (token !== this.#loads) return;
      this.#failed = true;
    }
    if (token === this.#loads) this.#compose();
  }

  #back(): void {
    if (this.#data.overlay) {
      this.scene.stop();
      return;
    }
    this.scale.off("resize", this.#onResize, this);
    goToScreen(this, this.#data.from ?? SCENES.trophyRoom, this.#data.backData ?? {});
  }

  // ---- state ------------------------------------------------------------------------------------------------------

  #sourceState(): SourceState {
    return { source: mem.source, tab: mem.tab, cameFrom: mem.cameFrom };
  }

  #applySource(state: SourceState): void {
    mem.source = state.source;
    mem.tab = state.tab;
    mem.cameFrom = state.cameFrom;
  }

  #tabs(): readonly StatsTab[] {
    return this.#stats ? statsTabsFor(mem.source, statsTabsOf(this.#stats)).map((tab) => tab.id) : [];
  }

  /** Whether the keyboard or a pad (not a finger or a mouse) is the input in use: only then does focus follow a change. */
  #byKeys(): boolean {
    const mode = this.#glyphs.snapshot?.state.mode;
    return mode === "keyboard" || mode === "pad";
  }

  #setTab(tab: StatsTab, focus: boolean): void {
    mem.tab = tab;
    this.#compose();
    if (focus) this.#route?.focusKey(`tab:${tab}`);
  }

  #stepTab(direction: 1 | -1): void {
    const tabs = this.#tabs();
    if (tabs.length === 0) return;
    const at = Math.max(0, tabs.indexOf(mem.tab));
    this.#setTab(tabs[(at + direction + tabs.length) % tabs.length]!, true);
  }

  /** `byKeys`: LT / RT moved focus to the hero's chip; a tapped arrow keeps its own focus. */
  #stepHero(direction: 1 | -1, byKeys: boolean): void {
    const count = this.#stats?.heroCards.length ?? 0;
    if (mem.tab !== "cards" || count < 2) return;
    mem.hero = (((mem.hero + direction) % count) + count) % count;
    this.#compose();
    if (byKeys) this.#route?.focusKey(`hero:${heroAt(this.#stats!, mem.hero)!.identityCardId}`);
  }

  #chooseSource(source: StatsSource, focus: boolean): void {
    if (mem.source === source || !this.#stats) return;
    const own = statsTabsOf(this.#stats).map((tab) => tab.id);
    this.#applySource(switchSource(this.#sourceState(), source, own));
    // A failed read is tried again each time Everyone is chosen.
    if (source === "everyone") this.#everyone.retryIfUnavailable();
    this.#compose();
    if (focus) this.#route?.focusKey(`source:${source}`);
  }

  #setGrid(kind: MatchupKind, focus: boolean): void {
    mem.grid = kind;
    this.#compose();
    if (focus) this.#route?.focusKey(`grid:${kind}`);
  }

  #setView(view: MatchupView): void {
    mem.view = view;
    this.#compose();
  }

  /** The grid on show, flipped if the Flip chip is on. */
  #matchup() {
    return shownGridOf(this.#stats!.matchups![mem.grid], mem.flipped);
  }

  /** Opens the Focus view on `row`; a keyboard or pad lands on its side list (or its stepper where there is none). */
  #openFocus(row: number): void {
    setCursor({ ...cursorOf(), row });
    mem.view = "focus";
    this.#compose();
    if (this.#byKeys()) this.#route?.focusKey(this.scale.width < SIDE_LIST_MIN_SCREEN ? "focus:next" : `side:${row}`);
  }

  /** Picks the row the Focus view shows, by the side list or the stepper. */
  #stepFocus(row: number): void {
    const count = this.#matchup().rows.length;
    setCursor({ ...cursorOf(), row: ((row % count) + count) % count });
    this.#compose();
  }

  /** The filter chips step through what your games hold, from All; a change folds the games again. */
  #filter(which: "hero" | "villain" | "difficulty" | "clear" | "toggle"): void {
    if (which === "toggle") {
      mem.filtersOpen = !mem.filtersOpen;
      this.#compose();
      return;
    }
    const options = this.#stats?.filterOptions;
    if (!options) return;
    // The filter asked for, not the last one folded: a second chip pressed before the first fold answers builds on it.
    const next = nextFilterOf(options, mem.filter, which);
    mem.filter = next;
    mem.hero = 0;
    // The chips show the new choice at once; the stats follow when the fold answers.
    this.#compose();
    void this.#load();
  }

  /** X (G / H): to the filter chips, opening them on a phone (on Everyone, which has none, to the You / Everyone chips). */
  #focusFilters(): void {
    const has = (key: string): boolean => this.#stops.has(key);
    if (has("filter:toggle") && !mem.filtersOpen) {
      mem.filtersOpen = true;
      this.#compose();
      this.#route?.focusKey("filter:hero");
      this.#queueStops();
      return;
    }
    if (has("filter:hero")) this.#route?.focusKey("filter:hero");
    else if (has(`source:${mem.source}`)) this.#route?.focusKey(`source:${mem.source}`);
  }

  /** Reads everyone's numbers (the first time Everyone is shown) and draws again when they arrive. */
  async #fetchGlobal(): Promise<void> {
    await this.#everyone.read(() => {
      if (this.#alive) this.#compose();
    });
  }

  /** One press turns sharing on, as the Settings row does; only games finished from now on are ever shared. */
  async #share(): Promise<void> {
    const saved = await this.#everyone.share();
    if (saved === null || !this.#alive) return;
    this.#compose();
    if (saved && this.#byKeys()) this.#route?.focusKey(`source:${mem.source}`);
  }

  /** Opens a record's game in Game review (Past games); its Back comes back here, to the same tab. */
  #openGame(gameId: string): void {
    this.scale.off("resize", this.#onResize, this);
    goToScreen(this, SCENES.pastGames, {
      gameId,
      from: SCENES.playerStats,
      backData: { ...this.#data, tab: mem.tab },
    } satisfies PastGamesSceneData);
  }

  /** A card the stats name, opened in Inspect (A or Y on its picture or its row): the pad's way to read it large. */
  #inspectCard(cardId: string): void {
    if (!currentCardsById().has(cardId)) return;
    this.scene.launch(SCENES.inspect, { card: { cardId, face: { kind: "front" } } });
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: StatsEventDetail): void {
    switch (detail.type) {
      case "back":
        return this.#back();
      case "source":
        return this.#chooseSource(detail.source, false);
      case "tab":
        return this.#setTab(detail.tab, false);
      case "filter":
        return this.#filter(detail.filter);
      case "share":
        return void this.#share();
      case "hero-step":
        return this.#stepHero(detail.direction, false);
      case "focus-step":
        return this.#stepFocus(cursorOf().row + detail.direction);
      case "focus-row":
        return this.#stepFocus(detail.row);
      case "open-focus":
        return this.#openFocus(detail.row);
      case "view":
        return this.#setView(detail.view);
      case "grid":
        return this.#setGrid(detail.kind, false);
      case "grid-toggle":
        if (detail.toggle === "counts") mem.counts = !mem.counts;
        else if (detail.toggle === "played") mem.played = !mem.played;
        else mem.flipped = !mem.flipped;
        return this.#compose();
      case "grid-cursor":
        setCursor({ row: detail.row, column: detail.column });
        return;
      case "hide-signature":
        mem.hideSignature = !mem.hideSignature;
        return this.#compose();
      case "open-game":
        return this.#openGame(detail.gameId);
      case "card":
        return this.#inspectCard(detail.cardId);
    }
  }

  // ---- the page -----------------------------------------------------------------------------------------------------

  /** Sets the page from the saves and the choices. */
  #compose(): void {
    const mounted = this.#page;
    if (!this.#alive || !mounted) return;
    const { width, height } = this.scale.gameSize;
    const factor = formFactorFor(width, height);
    const phone = factor === "phone" || factor === "phoneLandscape";
    const stats = this.#stats;
    if (stats) {
      // Everyone kept from an earlier visit on a tab it lacks moves to Villains (Overview comes back with You).
      this.#applySource(settleSource(this.#sourceState()));
      const tabs = statsTabsFor(mem.source, statsTabsOf(stats));
      if (!tabs.some((tab) => tab.id === mem.tab)) mem.tab = tabs[0]?.id ?? "overview";
      if (mem.source === "everyone" && this.#everyone.wantsRead) void this.#fetchGlobal();
    }
    const showShare = mem.source === "everyone" && readConsent() !== "on";
    this.#everyone.noteShare(showShare);
    if (stats && mem.tab === "matchups" && stats.matchups) {
      const matchup = this.#matchup();
      const cursor = cursorOf();
      // A flip or a filter changes the grid's shape under the cursor: keep it on the grid.
      setCursor({
        row: Math.min(Math.max(0, matchup.rows.length - 1), cursor.row),
        column: Math.min(Math.max(0, matchup.columns.length - 1), cursor.column),
      });
    }
    this.#pictures.begin();
    this.#glyphs.reset();
    resetHoverCards(this);
    const pictures = playerStatsLooks(this.#pictures);
    const input = statsInputOf({
      stats,
      failed: this.#failed,
      global: this.#everyone.global,
      shareFailed: this.#everyone.shareFailed,
      overlay: this.#data.overlay === true,
      from: this.#data.from,
      phone,
      width,
      glyphs: this.#glyphs,
      looks: pictures,
    });
    const model = statsPageModelOf(input);
    this.#glyphs.settled();
    const { region, element } = mounted;
    region.setRect({ x: 0, y: 0, width, height });
    element.mode = phone ? "phone" : "wide";
    element.model = model;
    renderNow(element);
    this.#pictures.end();
    this.#hover?.onDraw();
    this.#queueStops();
  }

  // ---- the focus route -----------------------------------------------------------------------------------------------

  #stops = new Map<string, FocusStop>();

  /** Reads the page's stops a frame after it drew, once its parts (every child, the lists' rows) have too. */
  #queueStops(): void {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    requestAnimationFrame(() => {
      this.#syncQueued = false;
      if (this.#alive) void this.#syncStops();
    });
  }

  async #syncStops(): Promise<void> {
    const mounted = this.#page;
    if (!mounted || !this.#route) return;
    const stops = await readStops(mounted);
    if (!this.#alive || mounted !== this.#page) return;
    this.#stops = stops;
    this.#route.set([...stops.keys()], stops);
    this.#hover?.onDraw();
  }

  #pageFocus(direction: 1 | -1): void {
    const mounted = this.#page;
    if (!mounted) return;
    if (mounted.element.grid) {
      mounted.element.grid.page(direction);
      this.#route?.focusKey("grid:cell");
      return;
    }
    const key = pagedKeyOf(mounted, this.#route?.focused ?? null, direction);
    if (key) this.#route?.focusKey(key);
  }

  #focusEdge(edge: "home" | "end"): void {
    const grid = this.#page?.element.grid;
    if (grid) {
      grid.edge(edge);
      this.#route?.focusKey("grid:cell");
      return;
    }
    const keys = this.#page ? listKeysOf(this.#page) : [];
    const key = edge === "home" ? keys[0] : keys.at(-1);
    if (key) this.#route?.focusKey(key);
  }
}

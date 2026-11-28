/**
 * Your stats: a tabbed dashboard of what the player's finished games say about how they play
 * (`view/player-stats-model.ts`, worded by `view/player-stats-page-model.ts`).
 *
 * The whole screen is one page element, `mc-player-stats-page` (`views/player-stats/`), made of section elements
 * (`components/player-stats/`): the header (Back, the You / Everyone switch), the tabs, the controls under them (filters,
 * Matchups chips, steppers, Share), and a tab's list or the Matchups grid. This scene only mounts it, sets its properties
 * from the view model, and handles its `mc-player-stats` events. It keeps the focus route (the page's `data-stop` parts,
 * read by `dom/element-stops.ts`), the card hover popover (`dom/card-events.ts`), the wallpaper behind the panel, and the
 * state that outlives a visit (the tab, the hero, the filters, the Matchups choices).
 *
 * Tabs: Overview (tiles: the record, how you lose, per-game figures, the favorite hero and the villains with their art),
 * Heroes, Villains, Matchups (villains against heroes and modular sets, four views: two grids and two lists), Aspects,
 * Encounter, Records, Cards, Decks and Cards by hero. LB / RB switch tabs and LT / RT switch heroes (on Matchups, the two
 * grids); a pad or keyboard walks every tile, row, card and grid cell. Read-only: only the You / Everyone switch (and
 * "Share my games" on Everyone), the tabs, the chips, a Matchups shelf or side row, and Back press anything.
 *
 * Opened two ways (`PlayerStatsData`): as a screen from the Title, Decks & Collection or the Trophy Room (Back goes to
 * that screen), or as an overlay over Settings or Pause (Back closes it, and the scene under it takes input again).
 * The stats are folded in a worker (`view/player-stats-client.ts`) from the saves' rows this scene reads when it opens.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/player-stats/mc-player-stats-page/mc-player-stats-page.js";
import type { ControlGlyph } from "@mc/ui";
import { t, type MessageKey } from "../i18n/translate.js";
import { currentCardsById, currentScenarios } from "../content/pool.js";
import { onArtChange } from "../language-change.js";
import { cardArt } from "../art/card-art.js";
import { cardFaces } from "../art/card-face-baker.js";
import { PictureLeases } from "../dom/picture-leases.js";
import { surface } from "../tokens.js";
import { drawPicture } from "../ui/campaign-chrome.js";
import { TITLE_ART, pickTitleArtFor, titleArtSizeOf, type TitleArt } from "../art/title-art.js";
import { drawnDensity } from "../platform/screen-settings.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { cssOf } from "../ui/theme.js";
import { specsForShortcuts } from "../ui/glyph-hints.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { bindStopFocus, collectStops, focusStopsOf } from "../dom/element-stops.js";
import { settleElements } from "../dom/element-settle.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs, type ControlSpecs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { renderNow } from "../dom/dom-region.js";
import { pageTarget } from "../view/focus-list.js";
import { layerTriggerGlyph } from "../view/input-glyph-model.js";
import { formFactorFor } from "../view/layout.js";
import { scenarioCardIdOf } from "../view/random-villain.js";
import { loadPlayerStats } from "../view/player-stats-client.js";
import { loadGlobalStats } from "../global-stats/global-stats-client.js";
import {
  settleSource,
  switchSource,
  statsTabsFor,
  type GlobalState,
  type SourceState,
  type StatsSource,
} from "../view/global-stats-ui.js";
import { askAnswerAllowed } from "../view/global-ask.js";
import { readConsent } from "../global-stats/global-consent.js";
import { shareFinishedGamesNow } from "../global-stats/share-now.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import { backfillProgress, onBackfillProgress } from "../progression/stats-backfill.js";
import { statsPageModelOf, SIDE_LIST_MIN_SCREEN, type StatsPageInput } from "../view/player-stats-page-model.js";
import { shownGridOf, type MatchupPictures } from "../view/player-stats-matchup-model.js";
import { heroAt, statsTabsOf, type StatsTab } from "../view/player-stats-tabs.js";
import type { MatchupKind, MatchupView } from "../view/matchup-grid.js";
import type { PlayerStats, StatsFilter } from "../view/player-stats-model.js";
import type { StatsEventDetail } from "../components/player-stats/shared/stats-events.types.js";
import { STATS_RENDERED } from "../components/player-stats/shared/stats-events.types.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { PastGamesSceneData } from "./past-games.js";
import { playerStatsLooks } from "./player-stats-looks.js";

/** How the stats were opened: a screen to go back to, or an overlay to close. */
export interface PlayerStatsData {
  /** The scene that opened the stats. Absent: the Trophy Room. */
  readonly from?: string;
  /** Opened over `from` (Settings, Pause): Back closes the stats instead of changing screen. */
  readonly overlay?: boolean;
  /** The tab to open on (a deck's "Open in Your stats" opens Cards by hero). Absent: the last one looked at. */
  readonly tab?: StatsTab;
  /** On Cards by hero, the hero to show (an identity card id). */
  readonly heroId?: string;
  /** What Back hands the screen it returns to (the Decks screen's selected deck). */
  readonly backData?: object;
}

type Page = MountedElement<HTMLElementTagNameMap["mc-player-stats-page"]>;

/** What Back says, by the screen it goes to. */
const BACK_LABELS: Readonly<Record<string, MessageKey>> = {
  [SCENES.title]: "stats.back.title",
  [SCENES.decks]: "stats.back.decks",
  [SCENES.trophyRoom]: "stats.back.trophies",
};

/** The backdrop's wash of the ground: how much of the art it hides at the top of the screen and at the foot. */
const WASH_TOP = 0.76;
const WASH_FOOT = 0.94;
/** The last visit's backdrop, so the next one shows another while there is a choice. */
let lastBackdropKey: string | null = null;

/** The control height the glyphs on the chips and the switch are drawn for. */
const CONTROL_HEIGHT = 44;
const TAB_HINT_HEIGHT = 14;

/** The tab and hero the player last looked at, kept while the app runs. */
let lastTab: StatsTab = "overview";
let lastHero = 0;
/** The filter chips' choice, kept across visits like the tab. */
let lastFilter: StatsFilter = {};
/** Whose numbers the Heroes, Villains and Encounter tabs show, kept across visits like `lastFilter`. */
let lastSource: StatsSource = "you";
/** The You tab Everyone was chosen from, which You returns to. */
let lastCameFrom: StatsTab | null = null;
/** Cards and Cards by hero without each hero's own cards (kept across visits, like the tab). */
let hideSignature = false;
/** On a phone the filter chips fold behind one "Filters" chip, so the tabs and the stats keep the screen. */
let filtersOpen = false;
/** The Matchups tab's choices, kept across visits like the tab: which grid, and how it shows. */
let lastGrid: MatchupKind = "heroes";
let gridCounts = false;
let gridPlayed = true;
let gridFlipped = false;
let lastView: MatchupView = "heat";
/** Each grid keeps its own cursor, a flipped one apart from the other. */
const gridCursors = new Map<string, { row: number; column: number }>();
const gridKey = (): string => `${lastGrid}:${gridFlipped}`;
const cursorOf = (key: string): { row: number; column: number } => gridCursors.get(key) ?? { row: 0, column: 0 };

/** A pad's LT or RT glyph; nothing on a keyboard, which has no triggers. */
const triggerSpecs =
  (trigger: "lt" | "rt"): ControlSpecs =>
  (set, snapshot) => {
    if (set !== "pad") return null;
    const glyph = layerTriggerGlyph(trigger, snapshot.state, snapshot.settings);
    return glyph ? [glyph] : null;
  };

/** The glyph for the You / Everyone switch: a plain press of View on a pad, Shift+B (Shift+N) on a keyboard. */
const sourceSwitchSpecs: ControlSpecs = (set, snapshot) =>
  specsForShortcuts([set === "pad" ? "peek" : "log"], snapshot);

/** The next of `options` after `current`, or the first (undefined: All) after the last. */
function stepOf<T>(options: readonly T[], current: T | undefined): T | undefined {
  const at = current === undefined ? -1 : options.indexOf(current);
  return at + 1 < options.length ? options[at + 1] : undefined;
}

export class PlayerStatsScene extends Phaser.Scene {
  /** Counts reads of the saves, so a fold that answers after a newer one began is dropped (`#load`). */
  #loads = 0;
  #data: PlayerStatsData = {};
  #page: Page | null = null;
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
  #composeQueued = false;
  /** This visit's backdrop (a title wallpaper), picked once per open so a redraw keeps it. */
  #backdrop: TitleArt | null = null;
  #backdropObjects: Phaser.GameObjects.GameObject[] = [];
  /** The backdrop's picture as drawn on the last draw (its texture key), or null while it loads (e2e reads it). */
  #backdropDrawn: string | null = null;
  /** Everyone's numbers: read on first use (Everyone shown), never at launch; once per visit unless it failed. */
  #global: GlobalState = { kind: "idle" };
  /** A press on "Share my games" is being saved (a second press waits), or the last one failed. */
  #shareBusy = false;
  #shareFailed = false;
  /** When "Share my games" first appeared (ms), so a press in its first moments is ignored; null while it is not shown. */
  #shareShownAt: number | null = null;

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
    this.#global = { kind: "idle" };
    this.#shareBusy = false;
    this.#shareFailed = false;
    this.#shareShownAt = null;
    this.#page = null;
    const under = this.#data.overlay && this.#data.from ? this.scene.get(this.#data.from) : null;
    if (under) {
      under.input.enabled = false;
      if (under.input.keyboard) under.input.keyboard.enabled = false;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#backdrop = pickTitleArtFor(
      TITLE_ART,
      titleArtSizeOf,
      { width: this.scale.width, height: this.scale.height },
      drawnDensity(),
      lastBackdropKey,
    );
    lastBackdropKey = this.#backdrop?.key ?? null;
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#onResize, this);
    resetHoverCards(this);
    // Pictures arrive after the first draw: draw again, once per batch.
    const redraw = (): void => {
      if (this.#composeQueued) return;
      this.#composeQueued = true;
      this.time.delayedCall(0, () => {
        this.#composeQueued = false;
        this.#compose();
      });
    };
    this.#offArt = [
      cardArt(this).onArrived(redraw),
      cardFaces(this).onBaked(redraw),
      // A Mod Store hero's or villain's picture is read from its pack a moment after the first ask (#966).
      onArtChange(redraw),
      // Older games being filled in (#529): the Overview says how far it has got, and the stats reload when it ends.
      onBackfillProgress((progress) => {
        if (progress.running) redraw();
        else void this.#load();
      }),
    ];
    this.#mount(under !== null);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#back(),
      onTab: (direction) => this.#stepTab(direction),
      onTrigger: (trigger) => {
        if (lastTab === "matchups") this.#setGrid(trigger === "lt" ? "heroes" : "modulars", true);
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
      onLog: () => this.#chooseSource(lastSource === "you" ? "everyone" : "you", true),
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
    // Dev e2e hook (never referenced by product code): which card the hover popover shows, and where.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcStatsDebug?: unknown }).__mcStatsDebug = {
        hoverShown: () => this.#hover?.shownKey ?? null,
        hoverRect: () => this.#hover?.shownRect ?? null,
        hoverCards: () => this.#hoverCards(),
        grid: () => {
          const grid = this.#page?.element.grid;
          const scroller = grid?.scroller;
          return grid && scroller
            ? {
                pan: { x: scroller.scrollLeft, y: scroller.scrollTop },
                cursor: grid.cursor,
                readout: grid.readout,
                counts: gridCounts,
              }
            : null;
        },
        backdrop: () => this.#backdropDrawn,
      };
    }
    this.#drawBackdrop();
    this.#compose();
    if (!under) fadeScreenIn(this);
    void this.#load(true);
  }

  /** Mounts the page and wires what it says and what hovers over it. */
  #mount(overlay: boolean): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-player-stats-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    element.addEventListener("mc-player-stats", (event) => this.#heard(event.detail));
    element.addEventListener(STATS_RENDERED, () => this.#queueStops());
    // A pack scan that fails to load reads its file again (`mc-image-error` from a picture with a retry key).
    this.#pictures.watch(element);
    this.#unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key));
    // The hover popover is drawn in the canvas, so its box is left out of the panel; the picture raises the events.
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      // Over Pause or Settings, those, and whatever they were open over, run under the stats; none of them is over it.
      area: (pointer) => screenHoverArea(this, pointer, { beneath: overlay ? UNDER_STATS : [] }),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) =>
      this.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? { kind: "front" } } });
  }

  /** The card pictures on screen now, for the e2e hook: each picture that names a card, and where it is. */
  #hoverCards(): { cardId: string; x: number; y: number; width: number; height: number }[] {
    const mounted = this.#page;
    if (!mounted) return [];
    return collectCardPictures(mounted.element).map(({ cardId, element }) => ({
      cardId,
      ...mounted.region.rectOf(element),
    }));
  }

  #onResize(): void {
    this.#drawBackdrop();
    this.#compose();
  }

  /**
   * The art behind every tab: a title wallpaper over the whole screen under a wash of the ground, lightest at the top
   * and nearly solid at the foot, as the landing page fades its art into the page. The panel is clear over it; the tiles
   * and rows are opaque, so it shows around them and under the tabs, and text on the ground stays readable.
   */
  #drawBackdrop(): void {
    for (const object of this.#backdropObjects) object.destroy();
    this.#backdropObjects = [];
    const { width, height } = this.scale.gameSize;
    const ground = this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0).setDepth(-3);
    this.#backdropObjects.push(ground);
    const picture = drawPicture(
      this,
      this.#backdrop,
      { x: 0, y: 0, width, height },
      () => {
        if (this.#alive) this.#drawBackdrop();
      },
      { focusY: 0.3, scaleToSlot: true },
    );
    this.#backdropDrawn = picture?.texture.key ?? null;
    if (!picture) return;
    picture.setDepth(-2);
    this.#backdropObjects.push(picture);
    const wash = this.add.graphics().setDepth(-1);
    this.#backdropObjects.push(wash);
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      wash
        .fillStyle(surface.paper.hex, WASH_TOP + ((WASH_FOOT - WASH_TOP) * i) / (steps - 1))
        // Whole-pixel strips that meet without overlapping: an overlap doubles the wash into a visible line.
        .fillRect(
          0,
          Math.round((height * i) / steps),
          width,
          Math.round((height * (i + 1)) / steps) - Math.round((height * i) / steps),
        );
    }
  }

  /** Reads the saves and folds them; `first`: the visit's first read, which applies the tab and hero it opened on. */
  async #load(first = false): Promise<void> {
    // Only the latest read may publish: an older fold (an earlier filter) that answers last is dropped.
    const token = ++this.#loads;
    try {
      const stats = await loadPlayerStats(await appSession().store.listSaves(), undefined, lastFilter);
      if (!this.#alive || token !== this.#loads) return;
      this.#stats = stats;
      if (first && this.#data.tab) {
        // Opened on a named tab (Cards by hero): your own numbers.
        lastTab = this.#data.tab;
        lastSource = "you";
        lastCameFrom = null;
      }
      const hero =
        first && this.#data.heroId ? stats.heroCards.findIndex((h) => h.identityCardId === this.#data.heroId) : -1;
      if (hero >= 0) lastHero = hero;
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
    return { source: lastSource, tab: lastTab, cameFrom: lastCameFrom };
  }

  #applySource(state: SourceState): void {
    lastSource = state.source;
    lastTab = state.tab;
    lastCameFrom = state.cameFrom;
  }

  #tabs(): readonly StatsTab[] {
    return this.#stats ? statsTabsFor(lastSource, statsTabsOf(this.#stats)).map((tab) => tab.id) : [];
  }

  /** Whether the keyboard or a pad (not a finger or a mouse) is the input in use: only then does focus follow a change. */
  #byKeys(): boolean {
    const mode = this.#glyphs.snapshot?.state.mode;
    return mode === "keyboard" || mode === "pad";
  }

  #setTab(tab: StatsTab, focus: boolean): void {
    lastTab = tab;
    this.#compose();
    if (focus) this.#route?.focusKey(`tab:${tab}`);
  }

  #stepTab(direction: 1 | -1): void {
    const tabs = this.#tabs();
    if (tabs.length === 0) return;
    const at = Math.max(0, tabs.indexOf(lastTab));
    this.#setTab(tabs[(at + direction + tabs.length) % tabs.length]!, true);
  }

  /** `byKeys`: LT / RT moved focus to the hero's chip; a tapped arrow keeps its own focus. */
  #stepHero(direction: 1 | -1, byKeys: boolean): void {
    const count = this.#stats?.heroCards.length ?? 0;
    if (lastTab !== "cards" || count < 2) return;
    lastHero = (((lastHero + direction) % count) + count) % count;
    this.#compose();
    if (byKeys) this.#route?.focusKey(`hero:${heroAt(this.#stats!, lastHero)!.identityCardId}`);
  }

  #chooseSource(source: StatsSource, focus: boolean): void {
    if (lastSource === source || !this.#stats) return;
    const own = statsTabsOf(this.#stats).map((tab) => tab.id);
    this.#applySource(switchSource(this.#sourceState(), source, own));
    // A failed read is tried again each time Everyone is chosen.
    if (source === "everyone" && this.#global.kind === "unavailable") this.#global = { kind: "idle" };
    this.#compose();
    if (focus) this.#route?.focusKey(`source:${source}`);
  }

  #setGrid(kind: MatchupKind, focus: boolean): void {
    lastGrid = kind;
    this.#compose();
    if (focus) this.#route?.focusKey(`grid:${kind}`);
  }

  #setView(view: MatchupView): void {
    lastView = view;
    this.#compose();
  }

  /** The grid on show, flipped if the Flip chip is on. */
  #matchup() {
    return shownGridOf(this.#stats!.matchups![lastGrid], gridFlipped);
  }

  /** Opens the Focus view on `row`; a keyboard or pad lands on its side list (or its stepper where there is none). */
  #openFocus(row: number): void {
    gridCursors.set(gridKey(), { ...cursorOf(gridKey()), row });
    lastView = "focus";
    this.#compose();
    if (this.#byKeys()) this.#route?.focusKey(this.scale.width < SIDE_LIST_MIN_SCREEN ? "focus:next" : `side:${row}`);
  }

  /** Picks the row the Focus view shows, by the side list or the stepper. */
  #stepFocus(row: number): void {
    const count = this.#matchup().rows.length;
    gridCursors.set(gridKey(), { ...cursorOf(gridKey()), row: ((row % count) + count) % count });
    this.#compose();
  }

  /** The filter chips step through what your games hold, from All; a change folds the games again. */
  #filter(which: "hero" | "villain" | "difficulty" | "clear" | "toggle"): void {
    if (which === "toggle") {
      filtersOpen = !filtersOpen;
      this.#compose();
      return;
    }
    const options = this.#stats?.filterOptions;
    if (!options) return;
    // The filter asked for, not the last one folded: a second chip pressed before the first fold answers builds on it.
    const next: StatsFilter =
      which === "clear"
        ? {}
        : which === "hero"
          ? {
              ...lastFilter,
              hero: stepOf(
                options.heroes.map((h) => h.id),
                lastFilter.hero,
              ),
            }
          : which === "villain"
            ? { ...lastFilter, villain: stepOf(options.villains, lastFilter.villain) }
            : { ...lastFilter, difficulty: stepOf(options.difficulties, lastFilter.difficulty) };
    lastFilter = next;
    lastHero = 0;
    // The chips show the new choice at once; the stats follow when the fold answers.
    this.#compose();
    void this.#load();
  }

  /** X (G / H): to the filter chips, opening them on a phone (on Everyone, which has none, to the You / Everyone chips). */
  #focusFilters(): void {
    const has = (key: string): boolean => this.#stops.has(key);
    if (has("filter:toggle") && !filtersOpen) {
      filtersOpen = true;
      this.#compose();
      this.#route?.focusKey("filter:hero");
      this.#queueStops();
      return;
    }
    if (has("filter:hero")) this.#route?.focusKey("filter:hero");
    else if (has(`source:${lastSource}`)) this.#route?.focusKey(`source:${lastSource}`);
  }

  /** Reads everyone's numbers (the first time Everyone is shown) and draws again when they arrive. */
  async #fetchGlobal(): Promise<void> {
    this.#global = { kind: "reading" };
    const answer = await loadGlobalStats();
    if (!this.#alive) return;
    this.#global = answer;
    this.#compose();
  }

  /**
   * One press turns sharing on, as the Settings row does: the games finished so far are marked sent, so only games
   * finished from now on are ever shared. Off stays in Settings.
   */
  async #share(): Promise<void> {
    if (this.#shareBusy || readConsent() === "on") return;
    // A tap meant for a tab that lands as the button appears is not an answer (the same grace as the Title's ask).
    if (this.#shareShownAt === null || !askAnswerAllowed(this.#shareShownAt, performance.now())) return;
    this.#shareBusy = true;
    const saved = await shareFinishedGamesNow();
    this.#shareBusy = false;
    this.#shareFailed = !saved;
    if (!this.#alive) return;
    this.#compose();
    if (saved && this.#byKeys()) this.#route?.focusKey(`source:${lastSource}`);
  }

  /** Opens a record's game in Game review (Past games); its Back comes back here, to the same tab. */
  #openGame(gameId: string): void {
    this.scale.off("resize", this.#onResize, this);
    goToScreen(this, SCENES.pastGames, {
      gameId,
      from: SCENES.playerStats,
      backData: { ...this.#data, tab: lastTab },
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
        return this.#stepFocus(cursorOf(gridKey()).row + detail.direction);
      case "focus-row":
        return this.#stepFocus(detail.row);
      case "open-focus":
        return this.#openFocus(detail.row);
      case "view":
        return this.#setView(detail.view);
      case "grid":
        return this.#setGrid(detail.kind, false);
      case "grid-toggle":
        if (detail.toggle === "counts") gridCounts = !gridCounts;
        else if (detail.toggle === "played") gridPlayed = !gridPlayed;
        else gridFlipped = !gridFlipped;
        return this.#compose();
      case "grid-cursor":
        gridCursors.set(gridKey(), { row: detail.row, column: detail.column });
        return;
      case "hide-signature":
        hideSignature = !hideSignature;
        return this.#compose();
      case "open-game":
        return this.#openGame(detail.gameId);
      case "card":
        return this.#inspectCard(detail.cardId);
    }
  }

  // ---- the page -----------------------------------------------------------------------------------------------------

  /** The key and pad glyphs of the controls: asked for while the model is built, so a new input device redraws them. */
  #glyphsFor() {
    return {
      shortcut: (key: string, ids: Parameters<ControlGlyphs["glyph"]>[1]): ControlGlyph | undefined =>
        this.#glyphs.glyph(`stats:${key}`, ids, "paper", CONTROL_HEIGHT),
      trigger: (key: string, which: "lt" | "rt"): ControlGlyph | undefined =>
        this.#glyphs.glyph(`stats:${key}`, [], "paper", CONTROL_HEIGHT, "inside", triggerSpecs(which)),
    };
  }

  /** The pictures a Matchups axis shows: rows are scenarios unless flipped, and a modular set has none. */
  #matchupPictures(pictures: ReturnType<typeof playerStatsLooks>): MatchupPictures {
    const scenarios = (axis: "row" | "column"): boolean => (axis === "row") !== gridFlipped;
    return {
      picture: (axis, id) =>
        scenarios(axis) ? pictures.villain(id) : lastGrid === "heroes" ? pictures.hero(id) : null,
      cardId: (axis, id) => {
        const scenario = scenarios(axis) ? currentScenarios().find((s) => (s.id as string) === id) : undefined;
        const cardId = scenario ? scenarioCardIdOf(scenario) : !scenarios(axis) && lastGrid === "heroes" ? id : null;
        return cardId && currentCardsById().has(cardId) ? cardId : null;
      },
    };
  }

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
      const tabs = statsTabsFor(lastSource, statsTabsOf(stats));
      if (!tabs.some((tab) => tab.id === lastTab)) lastTab = tabs[0]?.id ?? "overview";
      if (lastSource === "everyone" && this.#global.kind === "idle") void this.#fetchGlobal();
    }
    const showShare = lastSource === "everyone" && readConsent() !== "on";
    if (!showShare) this.#shareShownAt = null;
    else this.#shareShownAt ??= performance.now();
    if (stats && lastTab === "matchups" && stats.matchups) {
      const matchup = this.#matchup();
      const cursor = cursorOf(gridKey());
      // A flip or a filter changes the grid's shape under the cursor: keep it on the grid.
      gridCursors.set(gridKey(), {
        row: Math.min(Math.max(0, matchup.rows.length - 1), cursor.row),
        column: Math.min(Math.max(0, matchup.columns.length - 1), cursor.column),
      });
    }
    this.#pictures.begin();
    this.#glyphs.reset();
    resetHoverCards(this);
    const pictures = playerStatsLooks(this.#pictures);
    const backWord = t(
      this.#data.overlay ? "stats.back.back" : (BACK_LABELS[this.#data.from ?? SCENES.trophyRoom] ?? "stats.back.back"),
    );
    const input: StatsPageInput = {
      stats,
      failed: this.#failed,
      source: lastSource,
      tab: lastTab,
      hero: lastHero,
      hideSignature,
      filter: lastFilter,
      filtersOpen,
      global: this.#global,
      sharing: readConsent() === "on",
      shareFailed: this.#shareFailed,
      backfill: backfillProgress(),
      matchups: {
        kind: lastGrid,
        counts: gridCounts,
        played: gridPlayed,
        flipped: gridFlipped,
        view: lastView,
        cursor: cursorOf(gridKey()),
      },
      names: POOL_STATS_NAMES,
      backLabel: backWord,
      phone,
      width,
      deps: { ...pictures.deps, linkGames: !this.#data.overlay },
      matchupPictures: this.#matchupPictures(pictures),
      glyphs: this.#glyphsFor(),
      backGlyph: this.#glyphs.glyph("stats:back", ["cancel"], "ink", CONTROL_HEIGHT),
      tabsGlyph: this.#glyphs.glyph("stats:tabs", ["zonePrevious", "zoneNext"], "paper", TAB_HINT_HEIGHT),
      sourceGlyph: this.#glyphs.glyph("stats:source", [], "ink", CONTROL_HEIGHT, "inside", sourceSwitchSpecs),
    };
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
    await settleElements(mounted.element);
    if (!this.#alive || mounted !== this.#page) return;
    const { element, region } = mounted;
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    const grid = element.grid;
    // The grid is one stop whose arrows walk its cells; at its edge the arrow leaves it.
    if (grid && stops.has("grid:cell"))
      stops.set("grid:cell", {
        rect: () => region.rectOf(grid.cursorCell ?? grid.scroller ?? grid),
        view: () => region.rectOf(grid.scroller ?? grid),
        activate: () => undefined,
        ensureVisible: () => grid.reveal(),
        steer: (direction) => grid.step(direction),
      });
    this.#stops = stops;
    this.#route.set([...stops.keys()], stops);
    this.#hover?.onDraw();
  }

  /** The keys of the list's stops, in reading order. */
  #listKeys(): string[] {
    const list = this.#page?.element.list;
    return list ? collectStops(list).map((stop) => stop.key) : [];
  }

  #pageFocus(direction: 1 | -1): void {
    const grid = this.#page?.element.grid;
    if (grid) {
      grid.page(direction);
      this.#route?.focusKey("grid:cell");
      return;
    }
    const keys = this.#listKeys();
    const at = keys.indexOf(this.#route?.focused ?? "");
    const view = this.#page?.element.list?.scroller?.clientHeight ?? 300;
    const target = pageTarget(
      keys.map((_, i) => i),
      at === -1 ? null : at,
      direction,
      Math.max(1, Math.floor(view / 80)),
    );
    if (target !== undefined) this.#route?.focusKey(keys[target]!);
  }

  #focusEdge(edge: "home" | "end"): void {
    const grid = this.#page?.element.grid;
    if (grid) {
      grid.edge(edge);
      this.#route?.focusKey("grid:cell");
      return;
    }
    const keys = this.#listKeys();
    const key = edge === "home" ? keys[0] : keys.at(-1);
    if (key) this.#route?.focusKey(key);
  }
}

/** Covering scenes that can be running under the stats overlay, never over it (`screenHoverArea`'s `beneath`). */
const UNDER_STATS: readonly string[] = [
  SCENES.pause,
  SCENES.settings,
  SCENES.choice,
  SCENES.inspect,
  SCENES.villainPhase,
  SCENES.roundDebrief,
  SCENES.rules,
  SCENES.endTurnConfirm,
  SCENES.pileView,
  SCENES.deckLeft,
  SCENES.schemeFan,
  SCENES.evidence,
  SCENES.campaignBeat,
  SCENES.teamUpInfo,
  SCENES.holdOn,
];

/** Every element under `root`, through open shadow roots, that is a card's picture (`data-card-id`), in document order. */
function collectCardPictures(root: ParentNode): { cardId: string; element: HTMLElement }[] {
  const found: { cardId: string; element: HTMLElement }[] = [];
  const visit = (node: ParentNode): void => {
    for (const element of node.querySelectorAll<HTMLElement>("*")) {
      const cardId = element.dataset?.cardId;
      if (cardId) found.push({ cardId, element });
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  if (root instanceof HTMLElement && root.shadowRoot) visit(root.shadowRoot);
  return found;
}

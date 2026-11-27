/**
 * Your stats: a tabbed dashboard of what the player's finished games say about how they play
 * (`view/player-stats-model.ts`, laid out by `view/player-stats-layout.ts`).
 *
 * Tabs: Overview (tiles: the record, how you lose, per-game figures, the favorite hero and the villains with their
 * art), Heroes, Villains, Matchups (villains against heroes and modular sets, four views: two grids,
 * `ui/matchup-grid.ts`, and two lists, `ui/matchup-rows.ts`), Side schemes, Devices (once a synced game says where it
 * was played) and Cards by hero (each hero's most played, most used and rarely played cards as pictures). LB / RB
 * switch tabs and LT / RT switch heroes (on Matchups, the two grids); a pad or keyboard walks every tile, row, card and
 * grid cell, and the list follows the ring. Each card picture, in a strip, leading a row or in a Matchups view, opens
 * the card hover popover under a resting mouse. Read-only: only the You / Everyone switch (and "Share my games" on
 * Everyone), the tabs, the chips, a Matchups shelf or side row, and Back press anything, and none of them sits over the
 * scrolling list.
 *
 * Opened two ways (`PlayerStatsData`): as a screen from the Title, Decks & Collection or the Trophy Room (Back goes to
 * that screen), or as an overlay over Settings or Pause (Back closes it, and the scene under it takes input again).
 * The stats are folded in a worker (`view/player-stats-client.ts`) from the saves' rows this scene reads when it opens.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet, SvgOp } from "@mc/ui";
import { t, type MessageKey } from "../i18n/translate.js";
import { currentCardsById, currentScenarios } from "../content/pool.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { onArtChange } from "../language-change.js";
import { artFor, type ArtSource } from "../art/art-source.js";
import type { AnyCard } from "@mc/content";
import { cardArt } from "../art/card-art.js";
import { cardFaces } from "../art/card-face-baker.js";
import { heroFocusOf, heroPictureOf, villainPictureOf } from "../art/matchup-pictures.js";
import { accent, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { bangers, campaignFrame, drawPicture, drawTopBar } from "../ui/campaign-chrome.js";
import { TITLE_ART, pickTitleArtFor, titleArtSizeOf, type TitleArt } from "../art/title-art.js";
import { drawnDensity } from "../platform/screen-settings.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { addPressShield } from "../ui/press-shield.js";
import { GlyphHints, specsForShortcuts, type CustomSpecs } from "../ui/glyph-hints.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McVirtualList } from "../ui/virtual-list.js";
import { McButton, fitWrapped } from "../ui/widgets.js";
import { McChipRail } from "../ui/chip-rail.js";
import { McMatchupGrid, type MatchupGridState } from "../ui/matchup-grid.js";
import { renderSideRow } from "../ui/matchup-rows.js";
import { drawLegendNodes, drawShelfNodes, drawTileNodes } from "../dom/matchup-sheet.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder, sheetColor } from "../dom/sheet-builder.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { RailScroll } from "../view/rail-scroll.js";
import { aspectStampOf } from "../view/aspect-stamp.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { clipToView, pageTarget } from "../view/focus-list.js";
import { layerTriggerGlyph } from "../view/input-glyph-model.js";
import type { ShortcutId } from "../view/input-shortcuts.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import {
  MATCHUP_VIEWS,
  flipGrid,
  shelfPictureRect,
  shelfRowsOf,
  shelvesOf,
  tilePictureRect,
  tileRowsOf,
  type MatchupGrid,
  type MatchupKind,
  type MatchupView,
} from "../view/matchup-grid.js";
import { scenarioCardIdOf } from "../view/random-villain.js";
import { loadPlayerStats } from "../view/player-stats-client.js";
import { loadGlobalStats } from "../global-stats/global-stats-client.js";
import {
  globalRowFailed,
  globalTabViewOf,
  shareLabel,
  shareLine,
  sharingOnLabel,
  settleSource,
  statsTabsFor,
  switchSource,
  type GlobalState,
  type SourceState,
  type StatsSource,
} from "../view/global-stats-ui.js";
import { sourceBarOf, type SourceBar } from "../view/stats-source-bar.js";
import { askAnswerAllowed } from "../view/global-ask.js";
import { readConsent } from "../global-stats/global-consent.js";
import { shareFinishedGamesNow } from "../global-stats/share-now.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import { backfillProgress, onBackfillProgress } from "../progression/stats-backfill.js";
import {
  dashboardRowsOf,
  globalRowsOf,
  heroAt,
  statRowPicture,
  statsTabsOf,
  type DashRow,
  type PlacedTile,
  type StatsTab,
} from "../view/player-stats-layout.js";
import type { LossCause, LossPart, OverviewTile, PlayerStats, StatsFilter } from "../view/player-stats-model.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { PastGamesSceneData } from "./past-games.js";

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

/** What Back says, by the screen it goes to. */
const BACK_LABELS: Readonly<Record<string, MessageKey>> = {
  [SCENES.title]: "stats.back.title",
  [SCENES.decks]: "stats.back.decks",
  [SCENES.trophyRoom]: "stats.back.trophies",
};

/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;
/** The scrolling list's key in the panel. */
const LIST = "list";
/** A label in the type of `typeRole.label` but written as given (a sentence, not capitals): what Phaser drew it as. */
const AS_WRITTEN_LABEL: TypeSpec = { ...typeRole.label, uppercase: false };

/** What a draw laid out for the panel's list. */
interface PanelList {
  readonly rect: Rect;
  /** Each row's top in the list's content space, and its height. */
  readonly tops: readonly number[];
  readonly heights: readonly number[];
  readonly total: number;
  /** The list's scroll's name: each tab (and each hero, and each Matchups view) keeps its own place. */
  readonly key: string;
  readonly phone: boolean;
}
const CHIP_GAP = 8;
/** A stat row's box inside its list row. */
const statBox = (rect: Rect): Rect => ({
  x: rect.x,
  y: rect.y + 3,
  width: rect.width - GUTTER,
  height: rect.height - 6,
});
/** The backdrop's wash of the ground: how much of the art it hides at the top of the screen and at the foot. */
const BACKDROP_WASH_TOP = 0.76;
const BACKDROP_WASH_FOOT = 0.94;
/** The last visit's backdrop, so the next one shows another while there is a choice. */
let lastBackdropKey: string | null = null;

/** A placed Overview tile's box in its list row: its own top and height in a showcase row, else the row's. */
const tileBox = (placed: PlacedTile, rect: Rect, rowHeight: number): Rect => ({
  x: rect.x + placed.x,
  y: rect.y + (placed.y ?? 0),
  width: placed.width,
  height: placed.height ?? rowHeight - 14,
});
/** The "Other" part of How you lose: a warm grey (the Basic aspect's), with ink text, apart from Wiped's ink. */
const MUTED_PART = 0x9a948a;
/** A loss bar's parts: the same hue for a cause on every row. The legend beside the bar names them in words too. */
const LOSS_COLORS: Readonly<Record<LossCause, number>> = {
  scheme: signal.caution.hex,
  villain: accent.heroRed.hex,
  minions: signal.cost.hex,
  // A purple no other part uses (the aspect and signal tokens have none), so Encounter reads apart from the rest.
  encounter: 0x6b3fa0,
  other: MUTED_PART,
  unknown: surface.paper.hex,
};

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
/** Each grid keeps its own place, a flipped one apart from the other. */
const gridPlaces = new Map<string, MatchupGridState>();
const gridPlaceOf = (key: string): MatchupGridState => {
  let place = gridPlaces.get(key);
  if (!place) {
    place = { pan: { x: 0, y: 0 }, cursor: { row: 0, column: 0 } };
    gridPlaces.set(key, place);
  }
  return place;
};

const DIFFICULTY_CHIP: Readonly<Record<NonNullable<StatsFilter["difficulty"]>, MessageKey>> = {
  standard: "stats.difficulty.standard",
  expert: "stats.difficulty.expert",
  extreme: "stats.difficulty.extreme",
};

/** A shortcut's glyph (LB, RB, or their keys). */
const shortcutSpecs =
  (id: ShortcutId): CustomSpecs =>
  (_set, snapshot) =>
    specsForShortcuts([id], snapshot);

/** The glyph for the You / Everyone switch: a plain press of View on a pad, Shift+B (Shift+N) on a keyboard. */
const sourceSwitchSpecs: CustomSpecs = (set, snapshot) => specsForShortcuts([set === "pad" ? "peek" : "log"], snapshot);

/** The trigger glyph (LT or RT) on a pad; nothing on a keyboard, which has no triggers. */
const triggerSpecs =
  (trigger: "lt" | "rt"): CustomSpecs =>
  (set, snapshot) => {
    if (set !== "pad") return null;
    const glyph = layerTriggerGlyph(trigger, snapshot.state, snapshot.settings);
    return glyph ? [glyph] : null;
  };

interface StatsChip {
  key: string;
  label: string;
  selected: boolean;
  /** `byFocus`: pressed with the pad or keyboard (A on the stop), so the focus may follow; false for a tap or click. */
  onClick: (byFocus: boolean) => void;
  glyph?: CustomSpecs | null;
  /** A fixed width, in place of the label's own. */
  width?: number;
}

/** A scenario by id: the pool's or an installed pack's. A Matchups row's picture hovers as its card (`scenarioCardIdOf`). */
const scenarioById = (id: string) => currentScenarios().find((scenario) => (scenario.id as string) === id);
/**
 * A hero's picture: its artwork, else its card's scan; a Mod Store hero's from its installed pack (#966), the way Past
 * games shows one (`art/matchup-pictures.ts`).
 */
const heroPicture = (identityId: string): string | null => heroPictureOf(identityId, loadedPacks());
/**
 * The picture a stats row draws for a card. A hero identity shows its hero side: a separated identity (SP//dr Suit) has
 * no front scan of its own, only its sides' (#966).
 */
const statCardArt = (card: AnyCard | undefined): ArtSource | null =>
  card?.type === "hero_identity"
    ? (artFor(card, { kind: "hero" }) ?? artFor(card, { kind: "front" }))
    : artFor(card, { kind: "front" });
/** A scenario's villain picture, a custom scenario's from its installed pack (#966). */
function villainPicture(scenarioId: string): string | null {
  const scenario = scenarioById(scenarioId);
  return villainPictureOf(scenarioId, scenario ? scenarioCardIdOf(scenario) : null, loadedPacks());
}
/** The Focus view's list of rows, and the screen width it needs beside the tiles; narrower, a stepper takes its place. */
const SIDE_LIST_WIDTH = 240;
const SIDE_LIST_MIN_SCREEN = 720;
/** The Matchups grid's one focus stop: the arrows move its cursor from cell to cell (`FocusStop.steer`). */
const GRID_STOP = "grid:cell";
/** Where the grid on show keeps its place. */
const gridKey = (): string => `${lastGrid}:${gridFlipped}`;

export class PlayerStatsScene extends Phaser.Scene {
  /** Counts reads of the saves, so a fold that answers after a newer one began is dropped (`#load`). */
  #loads = 0;
  /** Whether the chip being pressed was pressed with the pad or keyboard: only then does the focus (and its ring) follow. */
  #byFocus = false;
  /** The stops the last draw made, for X's jump to the filter chips. */
  #stops = new Map<string, FocusStop>();
  #data: PlayerStatsData = {};
  #buttons: McButton[] = [];
  /** A phone's tabs and the Matchups chips, a swipeable row each; the scrolls outlive each redraw. */
  #rails: McChipRail[] = [];
  #tabScroll = new RailScroll();
  #gridChipScroll = new RailScroll();
  /** The screen's one Lit panel: the dashboard's list (the Matchups grid and the Focus side list stay Phaser). */
  #region: DomRegion<McSheet> | null = null;
  /** What the last draw laid out for the list: its box, each row's top and height, and its scroll's name. */
  #panelList: PanelList | null = null;
  /** The rows built into the panel now: [from, to). */
  #built: { readonly from: number; readonly to: number } | null = null;
  #actions = new Map<string, () => void>();
  #inspects = new Map<string, () => void>();
  /** Each tab's own place in the list, by its scroll name; the panel's scroller is one element. */
  #tops = new Map<string, number>();
  #shownKey: string | null = null;
  #listened = new WeakSet<HTMLElement>();
  #scrollFrame = 0;
  #grid: McMatchupGrid | null = null;
  /** The Focus view's list of villains, beside its tiles. */
  #sideList: McVirtualList | null = null;
  /** On Shelves and Focus, draws the list's rows again in place, for pictures that have arrived. */
  #listRefresh: (() => void) | null = null;
  /** The grid on show as last flipped: the rows ask for it often. */
  #shown: { readonly source: MatchupGrid; readonly grid: MatchupGrid } | null = null;
  #listRect: Rect | null = null;
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #alive = false;
  #hints!: GlyphHints;
  #stats: PlayerStats | null = null;
  #failed = false;
  #rows: readonly DashRow[] = [];
  /** Each tab keeps its own scroll. */
  readonly #scrolls = new Map<string, ListScroll>();
  #offArt: (() => void)[] = [];
  #redrawQueued = false;
  /** This visit's backdrop (a title wallpaper), picked once per open so a redraw keeps it. */
  #backdrop: TitleArt | null = null;
  /** The backdrop's picture as drawn on the last draw (its texture key), or null while it loads (e2e reads it). */
  #backdropDrawn: string | null = null;
  /** Draws again once the backdrop has loaded: one function, so the loader waits for it once. */
  readonly #onBackdrop = (): void => {
    if (this.#alive) this.#draw();
  };
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
    this.#region = null;
    this.#panelList = null;
    this.#built = null;
    this.#shownKey = null;
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
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      // Over Pause or Settings, those, and whatever they were open over (the table's decision sheet, the villain phase),
      // run under the stats; none of them is over it.
      area: (pointer) => screenHoverArea(this, pointer, { beneath: UNDER_STATS }),
    });
    // Pictures arrive after the first draw: draw again, once per batch.
    const redraw = (): void => {
      if (this.#redrawQueued) return;
      this.#redrawQueued = true;
      this.time.delayedCall(0, () => {
        this.#redrawQueued = false;
        // The Matchups views ask again themselves: a whole redraw would drop a drag in progress as each picture lands.
        if (this.#grid) this.#grid.refreshArt();
        else if (this.#listRefresh) this.#listRefresh();
        else this.#draw();
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
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#back(),
      onTab: (direction) => this.#stepTab(direction),
      onTrigger: (trigger) => {
        if (lastTab === "matchups") this.#setGrid(trigger === "lt" ? "heroes" : "modulars", !this.#gridFocused());
        else this.#stepHero(trigger === "lt" ? -1 : 1);
      },
      onPage: (direction) => this.#pageFocus(direction),
      onHomeEnd: (edge) => this.#focusEdge(edge),
      onScroll: (dx, dy) => {
        this.#grid?.panBy(dx, dy);
        this.#scroller()?.scrollBy({ top: dy });
      },
      // X (G / H): to the filter chips, opening them on a phone (on Everyone, which has none, to the You / Everyone
      // chips); the chip it lands on wears the glyph.
      onToggle: () => this.#focusFilters(),
      // View on a pad (a plain press) and Shift+B / Shift+N on a keyboard: the other side of the You / Everyone switch.
      // (Not View's own key R / P, which is LB's on the keyboard.)
      onLog: () => this.#chooseSource(lastSource === "you" ? "everyone" : "you", true),
      blocked: () => this.scene.isActive(SCENES.inspect),
      // The grid's chips and its cursor can sit far apart across the screen: an arrow still goes from one to the other.
      reachAcross: () => this.#grid !== null,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      for (const off of this.#offArt) off();
      this.#offArt = [];
      this.#hints.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
      // The panel goes with the scene (`DomRegion`); the next visit makes a new one.
      this.#region = null;
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
        hoverCards: () => [...this.#hoverCardIds().values()],
        grid: () =>
          this.#grid ? { ...gridPlaceOf(gridKey()), readout: this.#grid.readout, counts: gridCounts } : null,
        backdrop: () => this.#backdropDrawn,
      };
    }
    this.#draw();
    if (!under) fadeScreenIn(this);
    void this.#load(true);
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
    if (token === this.#loads) this.#draw();
  }

  #back(): void {
    if (this.#data.overlay) {
      this.scene.stop();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, this.#data.from ?? SCENES.trophyRoom, this.#data.backData ?? {});
  }

  #tabs(): readonly StatsTab[] {
    return this.#stats ? statsTabsFor(lastSource, statsTabsOf(this.#stats)).map((t) => t.id) : [];
  }

  #setTab(tab: StatsTab, byFocus = true): void {
    lastTab = tab;
    this.#draw();
    if (byFocus) this.#route?.focusKey(`tab:${tab}`);
  }

  #stepTab(direction: 1 | -1): void {
    const tabs = this.#tabs();
    if (tabs.length === 0) return;
    const at = Math.max(0, tabs.indexOf(lastTab));
    this.#setTab(tabs[(at + direction + tabs.length) % tabs.length]!);
  }

  /** `keep`: the arrow that was pressed keeps focus, so A pressed again steps again. */
  #stepHero(direction: 1 | -1, keep?: string): void {
    if (lastTab !== "cards" || !this.#stats || this.#stats.heroCards.length < 2) return;
    this.#setHero(lastHero + direction, keep);
  }

  #setHero(index: number, keep?: string): void {
    const count = this.#stats?.heroCards.length ?? 0;
    if (count === 0) return;
    lastHero = ((index % count) + count) % count;
    this.#draw();
    // A tapped arrow moves no focus (no ring on a touch screen); LT / RT and the pad's A do.
    if (keep === undefined || this.#byFocus)
      this.#route?.focusKey(keep ?? `hero:${heroAt(this.#stats!, lastHero)!.identityCardId}`);
  }

  #scrollOf(tab: string): ListScroll {
    let scroll = this.#scrolls.get(tab);
    if (!scroll) {
      scroll = new ListScroll();
      this.#scrolls.set(tab, scroll);
    }
    return scroll;
  }

  /** The keys of the list's stops, in reading order. */
  #listKeys: string[] = [];

  #pageFocus(direction: 1 | -1): void {
    if (this.#grid) {
      this.#grid.page(direction);
      this.#route?.focusKey(GRID_STOP);
      return;
    }
    const keys = this.#listKeys;
    const at = keys.indexOf(this.#route?.focused ?? "");
    const step = Math.max(1, Math.floor((this.#listRect?.height ?? 300) / 80));
    const target = pageTarget(
      keys.map((_, i) => i),
      at === -1 ? null : at,
      direction,
      step,
    );
    if (target !== undefined) this.#route?.focusKey(keys[target]!);
  }

  #focusEdge(edge: "home" | "end"): void {
    if (this.#grid) {
      this.#grid.edge(edge);
      this.#route?.focusKey(GRID_STOP);
      return;
    }
    const key = edge === "home" ? this.#listKeys[0] : this.#listKeys.at(-1);
    if (key) this.#route?.focusKey(key);
  }

  /** The card pictures on screen now, in strips, leading stat rows and the Matchups views, each clipped to its view. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    // `through`: the list and the grid take input by position, so nothing in them is an interactive object of its own.
    const note = (cardId: string | null, slot: string, rect: Rect, clip: Rect): void => {
      const shown = cardId ? clipHoverRect(rect, clip) : null;
      if (cardId && shown) found.set(hoverSlotOf(cardId, slot), { ...shown, cardId, through: true });
    };
    if (this.#grid) {
      const matchup = this.#matchup();
      for (const { axis, index, rect, band } of this.#grid.pictures) {
        const id = (axis === "row" ? matchup.rows : matchup.columns)[index]!.id;
        note(this.#cardOf(axis, id), `${axis}:${index}`, rect, band);
      }
      return found;
    }
    const view = this.#listRect;
    if (!this.#panelList || !view) return found;
    this.#rows.forEach((row, index) => {
      const r = this.#rowRect(index);
      // The popover is desktop only, so these are never a phone's pictures.
      if (row.kind === "matchup" && row.matchup.kind === "shelf") {
        const id = this.#matchup().rows[row.matchup.shelf.row]!.id;
        note(this.#cardOf("row", id), `${index}`, shelfPictureRect(r, false), view);
      }
      if (row.kind === "matchup" && row.matchup.kind === "tiles") {
        const { tiles, tileWidth, tileHeight } = row.matchup;
        const columns = this.#matchup().columns;
        for (const tile of tiles) {
          const box = { x: r.x + tile.x, y: r.y, width: tileWidth, height: tileHeight };
          const cardId = this.#cardOf("column", columns[tile.column]!.id);
          note(cardId, `${index}:${tile.column}`, tilePictureRect(box, false), view);
        }
      }
      if (row.kind === "stat" && row.row.cardId && currentCardsById().has(row.row.cardId)) {
        const shown = clipHoverRect(statRowPicture(statBox(r)), view);
        if (shown) found.set(hoverSlotOf(row.row.cardId, index), { ...shown, cardId: row.row.cardId, through: true });
      }
      if (row.kind === "cards") {
        row.cards.forEach((card, j) => {
          const shown = clipHoverRect(
            { x: r.x + card.x, y: r.y + 4, width: row.cardWidth, height: row.cardHeight },
            view,
          );
          if (shown)
            found.set(hoverSlotOf(card.cardId, `${index}:${j}`), { ...shown, cardId: card.cardId, through: true });
        });
      }
    });
    return found;
  }

  #destroyWidgets(): void {
    for (const rail of this.#rails) rail.destroy();
    this.#rails = [];
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#listRect = null;
    this.#grid?.destroy();
    this.#grid = null;
    this.#sideList?.destroy();
    this.#sideList = null;
    this.#listRefresh = null;
  }

  /** A row of chip buttons from `top`, wrapping to more rows; returns where they end. */
  /**
   * The filter chips (Bluefiref5ran's "all / per hero / per villain / per difficulty"): each steps through what your
   * games hold, from All, and Clear puts every one back. A change folds the games again with the new filter.
   */
  #focusFilters(): void {
    if (this.#stops.has("filter:toggle") && !filtersOpen) {
      filtersOpen = true;
      this.#draw();
    }
    if (this.#stops.has("filter:hero")) this.#route?.focusKey("filter:hero");
    // Everyone has no filters: X lands on the You / Everyone chips instead.
    else if (this.#stops.has(`source:${lastSource}`)) this.#route?.focusKey(`source:${lastSource}`);
  }

  /** Reads everyone's numbers (the first time Everyone is shown) and draws again when they arrive. */
  async #fetchGlobal(): Promise<void> {
    this.#global = { kind: "reading" };
    const answer = await loadGlobalStats();
    if (!this.#alive) return;
    this.#global = answer;
    this.#draw();
  }

  /** The You / Everyone pair: one source at a time, drawn with the same chips as the filters. */
  /** The You / Everyone pair in the top bar: two segments, the chosen one filled; the other wears the switch glyph. */
  #drawSourceBar(bar: SourceBar, phone: boolean, stops: Map<string, FocusStop>, order: string[]): void {
    (["you", "everyone"] as const).forEach((source, index) => {
      const rect = source === "you" ? bar.you : bar.everyone;
      const selected = lastSource === source;
      const button = new McButton(this, {
        kind: selected ? "primary" : "onInk",
        label: bar.labels[index]!.toUpperCase(),
        type: { ...typeRole.menuButton, size: phone ? 15 : 17 },
        rect,
        onClick: () => {
          this.#byFocus = false;
          this.#chooseSource(source, false);
        },
      });
      this.#buttons.push(button);
      // The one not chosen wears the glyph of the key or button that switches (View, or Shift+B / Shift+N); not on a phone.
      if (!phone && !selected) this.#hints.button(button, [], "ink", { specs: sourceSwitchSpecs });
      stops.set(`source:${source}`, {
        rect,
        activate: () => {
          this.#byFocus = true;
          this.#chooseSource(source, true);
        },
      });
      order.push(`source:${source}`);
    });
  }

  /** The width `text` draws at on a switch segment (the button face, Public Sans 800), measured rather than estimated. */
  #labelWidth(text: string, size: number): number {
    const probe = this.add.text(0, 0, text.toUpperCase(), textStyle({ ...typeRole.menuButton, size }, surface.ink.hex));
    const width = probe.width;
    probe.destroy();
    return width;
  }

  #sourceState(): SourceState {
    return { source: lastSource, tab: lastTab, cameFrom: lastCameFrom };
  }

  #applySource(state: SourceState): void {
    lastSource = state.source;
    lastTab = state.tab;
    lastCameFrom = state.cameFrom;
  }

  /** The tabs the player has of their own, for You's return tab. */
  #ownTabs(): readonly StatsTab[] {
    return this.#stats ? statsTabsOf(this.#stats).map((t) => t.id) : ["overview"];
  }

  #chooseSource(source: StatsSource, byFocus: boolean): void {
    if (lastSource === source) return;
    this.#applySource(switchSource(this.#sourceState(), source, this.#ownTabs()));
    // A failed read is tried again each time Everyone is chosen.
    if (source === "everyone" && this.#global.kind === "unavailable") this.#global = { kind: "idle" };
    this.#draw();
    if (byFocus) this.#route?.focusKey(`source:${source}`);
  }

  /** The one fixed line under Share: what is sent, in two lines at most (and why it failed, when it did). */
  #drawShareLine(x: number, y: number, width: number, phone: boolean): number {
    const line = this.add.text(
      x,
      y,
      this.#shareFailed ? `${globalRowFailed()} ${shareLine()}` : shareLine(),
      textStyle(typeRole.body, surface.ink.hex, ink.secondary),
    );
    fitWrapped(line, width, 2, phone ? 11 : 12);
    return line.y + line.height;
  }

  /** "Share my games", beside the switch while Everyone is on and sharing is not. */
  #shareChip(): StatsChip {
    return {
      key: "share:global",
      label: shareLabel(),
      selected: false,
      onClick: (byFocus: boolean) => {
        this.#byFocus = byFocus;
        void this.#share();
      },
    };
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
    // #draw ignores a scene that has shut down.
    this.#draw();
    if (saved && this.#alive && this.#byFocus) this.#route?.focusKey(`source:${lastSource}`);
  }

  /** Whether a record's "View game" link shows: it names a game, and the screen is a screen (an overlay would leave a game or Settings behind). */
  #gameLinkOf(row: { readonly gameId?: string }): boolean {
    return row.gameId !== undefined && !this.#data.overlay;
  }

  /** Opens a record's game in Game review (Past games); its Back comes back here, to the same tab. */
  #openGame(gameId: string): void {
    this.scale.off("resize", this.#draw, this);
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

  #filterChips(stats: PlayerStats, phone: boolean): readonly StatsChip[] {
    const { heroes, villains, difficulties } = stats.filterOptions;
    // The filter asked for, not the last one folded: a second chip pressed before the first fold answers builds on it.
    const filter = lastFilter;
    const step = <T>(options: readonly T[], current: T | undefined): T | undefined => {
      const at = current === undefined ? -1 : options.indexOf(current);
      return at + 1 < options.length ? options[at + 1] : undefined;
    };
    const apply = (next: StatsFilter, key: string): void => {
      lastFilter = next;
      lastHero = 0;
      // The chips show the new choice at once; the stats follow when the fold answers.
      this.#draw();
      const byFocus = this.#byFocus;
      if (byFocus) this.#route?.focusKey(key);
      void this.#load().then(() => {
        if (byFocus) this.#route?.focusKey(key);
      });
    };
    const heroName = heroes.find((h) => h.id === filter.hero)?.name.replace(/ \(.*\)$/, "");
    const set = filter.hero !== undefined || filter.villain !== undefined || filter.difficulty !== undefined;
    const chips = [
      {
        key: "filter:hero",
        label: heroName ?? t(phone ? "stats.chip.heroes" : "stats.chip.allHeroes"),
        glyph: phone ? null : shortcutSpecs("guide"),
        selected: filter.hero !== undefined,
        onClick: () =>
          apply(
            {
              ...filter,
              hero: step(
                heroes.map((h) => h.id),
                filter.hero,
              ),
            },
            "filter:hero",
          ),
      },
      {
        key: "filter:villain",
        label: filter.villain ?? t(phone ? "stats.chip.villains" : "stats.chip.allVillains"),
        selected: filter.villain !== undefined,
        onClick: () => apply({ ...filter, villain: step(villains, filter.villain) }, "filter:villain"),
      },
      ...(difficulties.length > 1 || filter.difficulty !== undefined
        ? [
            {
              key: "filter:difficulty",
              label: filter.difficulty
                ? t(DIFFICULTY_CHIP[filter.difficulty])
                : t(phone ? "stats.chip.difficulty" : "stats.chip.allDifficulties"),
              selected: filter.difficulty !== undefined,
              onClick: () =>
                apply({ ...filter, difficulty: step(difficulties, filter.difficulty) }, "filter:difficulty"),
            },
          ]
        : []),
      ...(set
        ? [
            {
              key: "filter:clear",
              label: t("stats.chip.clear"),
              selected: false,
              onClick: () => apply({}, "filter:hero"),
            },
          ]
        : []),
    ];
    if (heroes.length <= 1 && villains.length <= 1 && !set) return [];
    if (phone) {
      const count = [filter.hero, filter.villain, filter.difficulty].filter((v) => v !== undefined).length;
      const toggle = {
        key: "filter:toggle",
        label: `${filtersOpen ? "▾" : "▸"} ${t("stats.chip.filters")}${count > 0 ? ` · ${count}` : ""}`,
        glyph: shortcutSpecs("guide"),
        selected: count > 0,
        onClick: () => {
          filtersOpen = !filtersOpen;
          this.#draw();
          if (this.#byFocus) this.#route?.focusKey("filter:toggle");
        },
      };
      return filtersOpen ? [toggle, ...chips] : [toggle];
    }
    return chips;
  }

  #gridFocused(): boolean {
    return this.#route?.focused === GRID_STOP;
  }

  #setGrid(kind: MatchupKind, byFocus: boolean): void {
    lastGrid = kind;
    this.#draw();
    if (byFocus) this.#route?.focusKey(`grid:${kind}`);
  }

  #setView(view: MatchupView, focus: string | null): void {
    lastView = view;
    this.#draw();
    if (focus) this.#route?.focusKey(focus);
  }

  /** The grid on show, flipped if the Flip chip is on. */
  #matchup(): MatchupGrid {
    const source = this.#stats!.matchups![lastGrid];
    if (!gridFlipped) return source;
    if (this.#shown?.source !== source) this.#shown = { source, grid: flipGrid(source) };
    return this.#shown.grid;
  }

  /** A row's or a column's picture: rows are scenarios unless flipped, and a modular set has none. */
  #pictureOf(axis: "row" | "column", id: string): string | null {
    const scenarios = (axis === "row") !== gridFlipped;
    if (scenarios) return villainPicture(id);
    if (lastGrid !== "heroes") return null;
    return heroPicture(id);
  }

  /** The card a row's or a column's picture stands for, for the hover: the axes read as in `#pictureOf`. */
  #cardOf(axis: "row" | "column", id: string): string | null {
    const scenarios = (axis === "row") !== gridFlipped;
    const scenario = scenarios ? scenarioById(id) : undefined;
    const cardId = scenario ? scenarioCardIdOf(scenario) : !scenarios && lastGrid === "heroes" ? id : null;
    return cardId && currentCardsById().has(cardId) ? cardId : null;
  }

  /** Opens the Focus view on `row`. */
  #openFocus(row: number, byFocus: boolean): void {
    const place = gridPlaceOf(gridKey());
    place.cursor = { ...place.cursor, row };
    this.#scrolls.delete(`matchups:focus:${gridKey()}`);
    this.#tops.delete(`matchups:focus:${gridKey()}`);
    this.#shownKey = null;
    // Where the side list has no room, the stepper is what focus can land on.
    const landing = this.scale.width < SIDE_LIST_MIN_SCREEN ? "focus:next" : `side:${row}`;
    this.#setView("focus", byFocus ? landing : null);
    this.#sideList?.scrollIntoView(row);
  }

  /** Picks the row the Focus view shows, by the side list or the stepper; `key`: the stop to stay on. */
  #stepFocus(row: number, key: string, byFocus: boolean): void {
    const place = gridPlaceOf(gridKey());
    const count = this.#matchup().rows.length;
    place.cursor = { ...place.cursor, row: ((row % count) + count) % count };
    this.#scrolls.delete(`matchups:focus:${gridKey()}`);
    this.#tops.delete(`matchups:focus:${gridKey()}`);
    this.#shownKey = null;
    this.#draw();
    this.#sideList?.scrollIntoView(place.cursor.row);
    if (byFocus) this.#route?.focusKey(key);
  }

  /** The Matchups tab's chips: which grid, and how it shows. LT and RT pick the grid too. */
  #gridChips(phone: boolean, wide: boolean): readonly StatsChip[] {
    const toggle = (key: string, label: string, selected: boolean, flip: () => void): StatsChip => ({
      key,
      label,
      selected,
      onClick: (byFocus) => {
        flip();
        this.#draw();
        if (byFocus) this.#route?.focusKey(key);
      },
    });
    const views: readonly StatsChip[] =
      phone || wide
        ? MATCHUP_VIEWS.map((view) => ({
            key: `view:${view}`,
            label: t(`stats.view.${view}` as MessageKey),
            selected: lastView === view,
            onClick: (byFocus) => this.#setView(view, byFocus ? `view:${view}` : null),
          }))
        : [
            {
              // One chip that steps through the views, where four would wrap to another row above the grid.
              key: "view:step",
              label: t("stats.chip.viewStep", { view: t(`stats.view.${lastView}` as MessageKey) }),
              selected: true,
              onClick: (byFocus) => {
                const next = MATCHUP_VIEWS[(MATCHUP_VIEWS.indexOf(lastView) + 1) % MATCHUP_VIEWS.length]!;
                this.#setView(next, byFocus ? "view:step" : null);
              },
            },
          ];
    return [
      ...views,
      {
        key: "grid:heroes",
        label: t("stats.chip.byHero"),
        selected: lastGrid === "heroes",
        onClick: (byFocus) => this.#setGrid("heroes", byFocus),
        glyph: phone ? null : triggerSpecs("lt"),
      },
      {
        key: "grid:modulars",
        label: t("stats.chip.byModular"),
        selected: lastGrid === "modulars",
        onClick: (byFocus) => this.#setGrid("modulars", byFocus),
        glyph: phone ? null : triggerSpecs("rt"),
      },
      ...(lastView === "shelves"
        ? []
        : [toggle("grid:counts", t("stats.chip.counts"), gridCounts, () => (gridCounts = !gridCounts))]),
      toggle(
        "grid:played",
        t(phone ? "stats.chip.notBeatenShort" : "stats.chip.notBeaten"),
        gridPlayed,
        () => (gridPlayed = !gridPlayed),
      ),
      toggle("grid:flip", t("stats.chip.flip"), gridFlipped, () => (gridFlipped = !gridFlipped)),
    ];
  }

  /** The Matchups grid in `rect`, with one stop whose arrows walk its cells. */
  #drawGrid(rect: Rect, phone: boolean, stops: Map<string, FocusStop>, order: string[]): void {
    const matchup = this.#matchup();
    const grid = new McMatchupGrid(this, {
      rect,
      grid: matchup,
      state: gridPlaceOf(gridKey()),
      showPlayed: gridPlayed,
      showCounts: gridCounts,
      phone,
      style: lastView === "stamps" ? "stamps" : "heat",
      rowPicture: (index) => this.#pictureOf("row", matchup.rows[index]!.id),
      columnPicture: (index) => this.#pictureOf("column", matchup.columns[index]!.id),
      onPanned: () => this.#hover?.onDraw(),
    });
    this.#grid = grid;
    stops.set(GRID_STOP, {
      rect: () => grid.cursorRect,
      view: () => grid.bodyRect,
      activate: () => undefined,
      ensureVisible: () => grid.reveal(),
      steer: (direction) => grid.step(direction),
    });
    order.push(GRID_STOP);
  }

  #drawChips(
    top: number,
    left: number,
    width: number,
    chips: readonly StatsChip[],
    stops: Map<string, FocusStop>,
    order: string[],
    phone: boolean,
  ): number {
    const height = phone ? 44 : 46;
    let x = left;
    let y = top;
    for (const chip of chips) {
      const probe = this.add.text(0, 0, chip.label.toUpperCase(), textStyle(bangers(phone ? 17 : 20), surface.ink.hex));
      const chipWidth = Math.min(width, chip.width ?? Math.ceil(probe.width) + (chip.glyph ? 64 : 30));
      probe.destroy();
      if (x > left && x + chipWidth > left + width) {
        x = left;
        y += height + CHIP_GAP;
      }
      const rect: Rect = { x, y, width: chipWidth, height };
      const button = new McButton(this, {
        kind: chip.selected ? "primary" : "secondary",
        label: chip.label.toUpperCase(),
        type: { ...typeRole.menuButton, size: phone ? 15 : 17 },
        rect,
        onClick: () => {
          this.#byFocus = false;
          chip.onClick(false);
        },
      });
      this.#buttons.push(button);
      if (chip.glyph) this.#hints.button(button, [], "paper", { specs: chip.glyph });
      stops.set(chip.key, {
        rect,
        activate: () => {
          this.#byFocus = true;
          chip.onClick(true);
        },
      });
      order.push(chip.key);
      x += chipWidth + CHIP_GAP;
    }
    return y + height;
  }

  /** The tabs as one sideways-scrolling row (`ui/chip-rail.ts`), with the current one brought into view. */
  #drawTabRail(
    top: number,
    left: number,
    width: number,
    chips: readonly StatsChip[],
    /** The chip to bring into view; null leaves the row where the player swiped it. */
    at: number | null,
    stops: Map<string, FocusStop>,
    order: string[],
    scroll = this.#tabScroll,
  ): number {
    const height = 44;
    const rail = new McChipRail(this, {
      rect: { x: left, y: top, width, height },
      chips: chips.map((chip) => ({
        id: chip.key,
        text: chip.label,
        selected: chip.selected,
        onClick: () => {
          this.#byFocus = false;
          chip.onClick(false);
        },
      })),
      scroll,
    });
    this.#rails.push(rail);
    if (at !== null) rail.scrollIntoView(at);
    chips.forEach((chip, index) => {
      stops.set(chip.key, {
        rect: () => rail.rectFor(index),
        activate: () => {
          this.#byFocus = true;
          chip.onClick(true);
        },
        ensureVisible: () => rail.scrollIntoView(index),
      });
      order.push(chip.key);
    });
    return top + height;
  }

  /**
   * The art behind every tab: a title wallpaper over the whole screen under a wash of the ground, lightest at the top
   * and nearly solid at the foot, as the landing page fades its art into the page (`site-nav.css`, `.site-backdrop`).
   * The tiles and rows are opaque, so it shows around them and under the tabs; text on the ground stays readable.
   */
  #drawBackdrop(width: number, height: number): void {
    const picture = drawPicture(this, this.#backdrop, { x: 0, y: 0, width, height }, this.#onBackdrop, {
      focusY: 0.3,
      scaleToSlot: true,
    });
    this.#backdropDrawn = picture?.texture.key ?? null;
    if (!picture) return;
    const wash = this.add.graphics();
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      wash
        .fillStyle(surface.paper.hex, BACKDROP_WASH_TOP + ((BACKDROP_WASH_FOOT - BACKDROP_WASH_TOP) * i) / (steps - 1))
        // Whole-pixel strips that meet without overlapping: an overlap doubles the wash into a visible line.
        .fillRect(
          0,
          Math.round((height * i) / steps),
          width,
          Math.round((height * (i + 1)) / steps) - Math.round((height * i) / steps),
        );
    }
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const stats = this.#stats;
    this.#hints.reset();
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    // A press on empty space here stops here: over Pause or Settings, whose own shields are off while their input is,
    // it would otherwise reach the Board or the Title underneath.
    addPressShield(this, { x: 0, y: 0, width, height });
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    this.#drawBackdrop(width, height);
    const backWord = t(
      this.#data.overlay ? "stats.back.back" : (BACK_LABELS[this.#data.from ?? SCENES.trophyRoom] ?? "stats.back.back"),
    );
    // The You / Everyone switch lives in the bar, to the right of the title (`view/stats-source-bar.ts`), so it costs the
    // content no height. The desktop's "N games played" gives way to it where the two would crowd the dark mode button.
    const playedText = phone || !stats ? undefined : stats.header.played;
    const sourceBar = stats
      ? sourceBarOf({ width, phone, topBar: frame.topBar }, playedText ? playedText.length * 10 + 16 : 0, (text) =>
          this.#labelWidth(text, phone ? 15 : 17),
        )
      : null;
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${backWord}`,
      onBack: () => this.#back(),
      hints: this.#hints,
      title: t("stats.title"),
      ...(playedText && sourceBar?.showRight ? { right: playedText } : {}),
      ...(sourceBar ? { reserveRight: sourceBar.reserveRight } : {}),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) {
      stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
      order.push("back");
    }

    if (!stats) {
      this.#rows = [];
      this.#listKeys = [];
      this.#panelList = null;
      this.#region?.setHidden(true);
      this.add
        .text(
          width / 2,
          bar.height + 80,
          t(this.#failed ? "stats.failed" : "stats.reading"),
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0.5, 0);
      this.#stops = stops;
      this.#route?.set(order, stops);
      return;
    }

    if (sourceBar) this.#drawSourceBar(sourceBar, phone, stops, order);
    // Everyone kept from an earlier visit on a tab it lacks moves to Villains (Overview comes back with You).
    this.#applySource(settleSource(this.#sourceState()));
    const tabs = statsTabsFor(lastSource, statsTabsOf(stats));
    if (!tabs.some((t) => t.id === lastTab)) lastTab = tabs[0]?.id ?? "overview";
    const at = tabs.findIndex((t) => t.id === lastTab);
    const inner = width - gutter * 2;
    // LB on the tab before this one and RB on the tab after it: the glyphs say where the bumpers go.
    // On a phone the Filters chip takes the right end of the tab row, so it costs no row of its own.
    const everyone = lastSource === "everyone";
    // The hero / villain / difficulty filters fold your games only: they are not offered on Everyone.
    const filters = everyone ? [] : this.#filterChips(stats, phone);
    const onMatchups = !everyone && lastTab === "matchups" && stats.matchups !== null;
    const gridChips = onMatchups ? this.#gridChips(phone, width >= 1280) : [];
    const tabChips = tabs.map((tab, index) => ({
      key: `tab:${tab.id}`,
      label: tab.label,
      selected: tab.id === lastTab,
      onClick: (byFocus: boolean) => this.#setTab(tab.id, byFocus),
      glyph:
        tabs.length > 1 && index === (at - 1 + tabs.length) % tabs.length
          ? shortcutSpecs("zonePrevious")
          : tabs.length > 1 && index === (at + 1) % tabs.length
            ? shortcutSpecs("zoneNext")
            : null,
    }));
    // On Everyone, before sharing is on: the share control and a line saying what sharing is, fixed below the tab row
    // (never where the tabs were a moment ago: a tap on a tab from habit must not turn sharing on).
    const sharing = readConsent() === "on";
    const showShare = everyone && !sharing;
    if (!showShare) this.#shareShownAt = null;
    else this.#shareShownAt ??= performance.now();
    let y = bar.height + 12;
    // A phone swipes one row of tabs rather than wrapping them to three, which leaves the stats the room; the Filters
    // chip takes the right end of that same row.
    if (phone) {
      const toggle = filters.find((chip) => chip.key === "filter:toggle");
      const rest = filters.filter((chip) => chip !== toggle);
      const toggleWidth = toggle ? 124 : 0;
      const railWidth = toggle ? inner - toggleWidth - CHIP_GAP : inner;
      const rowTop = y;
      y = this.#drawTabRail(rowTop, gutter, railWidth, tabChips, at, stops, order);
      if (toggle)
        this.#drawChips(
          rowTop,
          gutter + inner - toggleWidth,
          toggleWidth,
          [{ ...toggle, width: toggleWidth }],
          stops,
          order,
          phone,
        );
      if (rest.length > 0) y = this.#drawChips(y + CHIP_GAP, gutter, inner, rest, stops, order, phone);
      if (gridChips.length > 0)
        y = this.#drawTabRail(y + CHIP_GAP, gutter, inner, gridChips, null, stops, order, this.#gridChipScroll);
    } else {
      y = this.#drawChips(y, gutter, inner, tabChips, stops, order, phone);
      if (filters.length > 0) y = this.#drawChips(y + 10, gutter, inner, filters, stops, order, phone);
      if (gridChips.length > 0) y = this.#drawChips(y + 10, gutter, inner, gridChips, stops, order, phone);
    }
    if (showShare) {
      y = this.#drawChips(y + 10, gutter, inner, [this.#shareChip()], stops, order, phone);
      y = this.#drawShareLine(gutter, y + 6, inner, phone);
    } else if (everyone && sharing) {
      const on = this.add.text(
        gutter,
        y + 8,
        sharingOnLabel().toUpperCase(),
        textStyle(typeRole.label, surface.ink.hex, 1),
      );
      y = on.y + on.height;
    }

    if (lastTab === "cards") {
      // One row however many heroes: the previous hero, this one, the next (LT / RT step them too).
      const heroes = stats.heroCards;
      const current = heroAt(stats, lastHero)!;
      const several = heroes.length > 1;
      // The arrows are a fixed width, and the hero's chip takes the rest of the row, so the three never wrap.
      const arrow = 78;
      const middle = several ? inner - (arrow + CHIP_GAP) * 2 : undefined;
      const heroName = current.name.replace(/ \(.*\)$/, "");
      const games = current.games.split(" ")[0];
      y = this.#drawChips(
        y + 10,
        gutter,
        inner,
        [
          ...(several
            ? [
                {
                  key: "hero:previous",
                  label: "◂",
                  selected: false,
                  onClick: () => this.#stepHero(-1, "hero:previous"),
                  glyph: triggerSpecs("lt"),
                  width: arrow,
                },
              ]
            : []),
          {
            key: `hero:${current.identityCardId}`,
            label:
              phone || !several
                ? `${heroName} · ${games}`
                : t("stats.chip.heroOf", {
                    name: heroName,
                    games: current.games,
                    n: heroes.indexOf(current) + 1,
                    total: heroes.length,
                  }),
            selected: true,
            onClick: () => undefined,
            ...(middle !== undefined ? { width: middle } : {}),
          },
          ...(several
            ? [
                {
                  key: "hero:next",
                  label: "▸",
                  selected: false,
                  onClick: () => this.#stepHero(1, "hero:next"),
                  glyph: triggerSpecs("rt"),
                  width: arrow,
                },
              ]
            : []),
        ],
        stops,
        order,
        phone,
      );
    }

    // Where there is no room for the side list, the Focus view steps through its rows as Cards by hero does its heroes.
    const focusStepper = onMatchups && lastView === "focus" && width < SIDE_LIST_MIN_SCREEN;
    if (focusStepper) {
      const rows = this.#matchup().rows;
      const place = gridPlaceOf(gridKey());
      const at = Math.min(place.cursor.row, rows.length - 1);
      const arrow = 64;
      y = this.#drawChips(
        y + 10,
        gutter,
        inner,
        [
          {
            key: "focus:previous",
            label: "◂",
            selected: false,
            onClick: (byFocus) => this.#stepFocus(at - 1, "focus:previous", byFocus),
            width: arrow,
          },
          {
            key: "focus:name",
            label: rows[at]!.name,
            selected: true,
            onClick: () => undefined,
            width: inner - (arrow + CHIP_GAP) * 2,
          },
          {
            key: "focus:next",
            label: "▸",
            selected: false,
            onClick: (byFocus) => this.#stepFocus(at + 1, "focus:next", byFocus),
            width: arrow,
          },
        ],
        stops,
        order,
        phone,
      );
    }

    if (lastTab === "cards" || lastTab === "all-cards" || lastTab === "decks") {
      y = this.#drawChips(
        y + 10,
        gutter,
        inner,
        [
          {
            key: "hide-signature",
            label: t(hideSignature ? "stats.chip.cardsHidden" : "stats.chip.hideCards"),
            selected: hideSignature,
            onClick: (byFocus: boolean) => {
              hideSignature = !hideSignature;
              this.#draw();
              if (byFocus) this.#route?.focusKey("hide-signature");
            },
          },
        ],
        stops,
        order,
        phone,
      );
    }

    const listTop = y + 12;
    const fullRect: Rect = { x: gutter, y: listTop, width: inner, height: Math.max(60, height - listTop - gutter) };
    // The Focus view's side list takes the left of the rect; its tiles keep the rest.
    const sided = onMatchups && lastView === "focus" && !focusStepper;
    const sideRoom = sided ? SIDE_LIST_WIDTH + 12 : 0;
    const listRect: Rect = { ...fullRect, x: fullRect.x + sideRoom, width: fullRect.width - sideRoom };
    if (onMatchups && (lastView === "heat" || lastView === "stamps")) {
      this.#rows = [];
      this.#listKeys = [];
      this.#panelList = null;
      this.#region?.setHidden(true);
      this.#drawGrid(fullRect, phone, stops, order);
      this.#stops = stops;
      this.#route?.set(order, stops);
      this.#hover?.onDraw();
      return;
    }
    const focusRow = Math.min(gridPlaceOf(gridKey()).cursor.row, onMatchups ? this.#matchup().rows.length - 1 : 0);
    if (sided) this.#drawSideList({ ...fullRect, width: SIDE_LIST_WIDTH }, focusRow, stops, order);
    const rowWidth = listRect.width - GUTTER;
    const backfill = backfillProgress();
    if (everyone && this.#global.kind === "idle") void this.#fetchGlobal();
    const filtered =
      lastFilter.hero !== undefined || lastFilter.villain !== undefined || lastFilter.difficulty !== undefined;
    const globalView = everyone ? globalTabViewOf(this.#global, lastTab, POOL_STATS_NAMES, filtered) : null;
    const matchupRows = !onMatchups
      ? null
      : lastView === "shelves"
        ? shelfRowsOf(this.#matchup(), gridPlayed, rowWidth, phone)
        : tileRowsOf(this.#matchup(), focusRow, { showPlayed: gridPlayed, showCounts: gridCounts }, rowWidth, phone);
    const rows: DashRow[] = matchupRows
      ? matchupRows.map(({ id, height, row }) => ({ kind: "matchup", id, height, matchup: row }))
      : globalView
        ? globalRowsOf(globalView.notes, globalView.section, phone)
        : [
            ...(lastTab === "overview" && backfill.running
              ? [
                  {
                    kind: "note" as const,
                    id: "ov:backfill",
                    height: phone ? 52 : 40,
                    text: t("stats.backfill", { done: backfill.done, total: backfill.total }),
                  },
                ]
              : []),
            ...dashboardRowsOf(stats, lastTab, lastHero, rowWidth, phone, hideSignature),
          ];
    this.#rows = rows;
    this.#rows = rows;
    const heights = rows.map((row) => row.height);
    const tops: number[] = [];
    let total = 0;
    for (const h of heights) {
      tops.push(total);
      total += h;
    }
    // Everyone's list keeps its own scroll, apart from You's on the same tab.
    const scrollKey = everyone
      ? `global:${lastTab}`
      : lastTab === "cards"
        ? `cards:${lastHero}`
        : onMatchups
          ? `matchups:${lastView}:${gridKey()}`
          : lastTab;
    this.#panelList = { rect: listRect, tops, heights, total, key: scrollKey, phone };
    this.#listRect = listRect;
    this.#listRefresh = () => this.#paintList();

    // Every tile, stat row and card picture is a stop, so a pad or keyboard can walk the whole tab.
    const listKeys: string[] = [];
    const addStop = (
      key: string,
      index: number,
      part: (r: Rect) => Rect,
      cardId?: string,
      activate?: () => void,
    ): void => {
      listKeys.push(key);
      stops.set(key, {
        rect: () => clipToView(part(this.#rowRect(index)), listRect),
        view: listRect,
        activate: activate ?? (cardId ? () => this.#inspectCard(cardId) : () => undefined),
        ...(cardId ? { inspect: () => this.#inspectCard(cardId) } : {}),
        // The stop's own part of the row: a tile stacked low in the Overview's tall showcase row scrolls to itself.
        ensureVisible: () => {
          const row = this.#rowRect(index);
          const own = part(row);
          this.#showPart(index, { y: own.y - row.y, height: own.height });
        },
      });
    };
    rows.forEach((row, index) => {
      if (row.kind === "tiles") {
        for (const placed of row.tiles) {
          addStop(`tile:${placed.tile.id}`, index, (r) => tileBox(placed, r, row.height));
        }
      } else if (row.kind === "matchup") {
        const { matchup } = row;
        if (matchup.kind === "shelf")
          addStop(
            `row:${row.id}`,
            index,
            (r) => ({ ...r, width: r.width - GUTTER }),
            undefined,
            () => this.#openFocus(matchup.shelf.row, true),
          );
        else if (matchup.kind === "tiles")
          for (const tile of matchup.tiles)
            addStop(`tile:${tile.column}`, index, (r) => ({
              x: r.x + tile.x,
              y: r.y,
              width: matchup.tileWidth,
              height: matchup.tileHeight,
            }));
      } else if (row.kind === "stat") {
        addStop(
          `row:${row.id}`,
          index,
          (r) => ({ ...r, width: r.width - GUTTER }),
          row.row.cardId,
          this.#gameLinkOf(row.row) ? () => this.#openGame(row.row.gameId!) : undefined,
        );
      } else if (row.kind === "cards") {
        for (const card of row.cards) {
          addStop(
            `card:${row.id}:${card.cardId}`,
            index,
            (r) => ({
              x: r.x + card.x,
              y: r.y + 4,
              width: row.cardWidth,
              height: row.cardHeight,
            }),
            card.cardId,
          );
        }
      }
    });
    this.#listKeys = listKeys;
    order.push(...listKeys);
    this.#stops = stops;
    this.#paintList();
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }

  /** The Focus view's side list: every row of the grid, the one shown filled. A press shows another. */
  #drawSideList(rect: Rect, selected: number, stops: Map<string, FocusStop>, order: string[]): void {
    const shelves = shelvesOf(this.#matchup(), gridPlayed);
    const rowHeight = 46;
    const list = new McVirtualList(this, {
      rect,
      rowHeight,
      count: shelves.length,
      scroll: this.#scrollOf(`matchups:side:${gridKey()}`),
      background: false,
      renderRow: (index, rowRect) => ({
        objects: renderSideRow(
          this,
          shelves[index]!.name,
          shelves[index]!.score,
          rowRect,
          index === selected,
          accent.heroRed.hex,
        ),
      }),
      onRowActivate: (index) => this.#stepFocus(index, `side:${index}`, false),
    });
    this.#sideList = list;
    shelves.forEach((_, index) => {
      const key = `side:${index}`;
      stops.set(key, {
        rect: () => clipToView({ ...list.rectFor(index), width: rect.width - 10 }, rect),
        view: rect,
        activate: () => this.#stepFocus(index, key, true),
        ensureVisible: () => list.scrollIntoView(index),
      });
      order.push(key);
    });
  }

  // ---- the list, as the panel's parts ---------------------------------------------------------------------------

  /** The panel's scroller (null before the first paint, or on a tab with no list). */
  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(LIST) ?? null;
  }

  /** What a key does when the panel reports a tap on it, and when a card is held or right-clicked. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  /** A row's box on the screen now, from the list's scroll. */
  #rowRect(index: number): Rect {
    const list = this.#panelList!;
    return {
      x: list.rect.x,
      y: list.rect.y + list.tops[index]! - (this.#scroller()?.scrollTop ?? this.#scrollSaved(list.key)),
      width: list.rect.width,
      height: list.heights[index]!,
    };
  }

  #scrollSaved(key: string): number {
    return this.#tops.get(key) ?? 0;
  }

  /** Brings part of a row (`y` from the row's top) into view: the least scroll that shows all of it. */
  #showPart(index: number, own: { readonly y: number; readonly height: number }): void {
    const list = this.#panelList;
    const scroller = this.#scroller();
    if (!list || !scroller) return;
    const top = list.tops[index]! + own.y;
    const bottom = top + own.height;
    if (top < scroller.scrollTop || own.height > list.rect.height) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + list.rect.height) scroller.scrollTop = bottom - list.rect.height;
  }

  /**
   * Builds the rows near the view as the panel's parts, hands them over and renders now. Also the list's redraw when a
   * scroll nears the edge of the rows built, or a picture's URL arrived.
   */
  #paintList(): void {
    const list = this.#panelList;
    if (!list || !this.#alive) return;
    this.#actions = new Map();
    this.#inspects = new Map();
    // The panel is the list's box (the Focus view's side list, drawn in Phaser, keeps the rest of the row).
    const region: Rect = { x: list.rect.x, y: list.rect.y, width: list.rect.width + 8, height: list.rect.height };
    const b = new SheetBuilder(this.game, { x: region.x, y: region.y }, isDesktopType);
    const scrolled = this.#scroller()?.scrollTop ?? this.#scrollSaved(list.key);
    // Rows from a view above the top to two views below it.
    let from = 0;
    while (from < this.#rows.length && list.tops[from]! + list.heights[from]! < scrolled - list.rect.height) from++;
    let to = from;
    while (to < this.#rows.length && list.tops[to]! < scrolled + list.rect.height * 2) to++;
    this.#built = { from, to };
    b.scroll(LIST, list.rect, list.total, (inner) => {
      for (let index = from; index < to; index++) {
        const rect: Rect = {
          x: list.rect.x,
          y: list.tops[index]!,
          width: list.rect.width,
          height: list.heights[index]!,
        };
        this.#drawDashRow(inner, this.#rows[index]!, rect, list.phone, index);
      }
    });
    this.#mount(region, b, list.key);
  }

  /** Hands the built parts to the panel (made once, so a scroll survives a redraw) and renders them now. */
  #mount(rect: Rect, b: SheetBuilder, key: string): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-inspect", (event) => {
        this.#inspects.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, rect);
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
      this.#region.forwardMouseMoves();
    }
    const region = this.#region;
    region.setHidden(false);
    region.setRect(rect);
    // The hover popover is drawn in the canvas: left out of the panel to be seen through it.
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    region.element.nodes = b.nodes;
    renderNow(region.element);
    const scroller = this.#scroller();
    if (!scroller) return;
    // Each tab keeps its own place: the scroller is one element, so another tab's place is put back on the way in.
    if (this.#shownKey !== key) {
      this.#shownKey = key;
      scroller.scrollTop = this.#scrollSaved(key);
    }
    if (!this.#listened.has(scroller)) {
      this.#listened.add(scroller);
      scroller.addEventListener(
        "scroll",
        () => {
          if (this.#shownKey !== null) this.#tops.set(this.#shownKey, scroller.scrollTop);
          this.#hover?.onDraw();
          this.#onListScroll();
        },
        { passive: true },
      );
    }
  }

  /** The list scrolled: build again once the view nears the edge of the rows built, so what scrolls in is there. */
  #onListScroll(): void {
    if (this.#scrollFrame) return;
    this.#scrollFrame = requestAnimationFrame(() => {
      this.#scrollFrame = 0;
      const built = this.#built;
      const list = this.#panelList;
      if (!built || !list || !this.#alive) return;
      const slack = list.rect.height / 2;
      const top = this.#scrollSaved(list.key);
      const bottom = top + list.rect.height;
      const builtTop = list.tops[built.from] ?? 0;
      const builtBottom = built.to < this.#rows.length ? list.tops[built.to]! : list.total;
      if ((built.from > 0 && top < builtTop + slack) || (built.to < this.#rows.length && bottom > builtBottom - slack))
        this.#paintList();
    });
  }

  /** A caption: small capitals, fitted to its width. */
  #caption(b: SheetBuilder, text: string, x: number, y: number, color: number, width: number): void {
    b.text(x, y, text.toUpperCase(), typeRole.label, { size: 11, color, letterSpacing: 1.2, fitWidth: width });
  }

  /** A body line, wrapped to `lines`. */
  #body(
    b: SheetBuilder,
    text: string,
    x: number,
    y: number,
    width: number,
    lines: number,
    color: number,
  ): { readonly height: number } {
    return b.text(x, y, text, typeRole.body, {
      size: 13,
      color,
      alpha: 0.9,
      wrapWidth: width,
      maxLines: lines,
    });
  }

  /** A picture in a box with a card's hover: noted for the popover when it shows a card. */
  #picture(
    b: SheetBuilder,
    rect: Rect,
    src: string | null,
    options: { readonly cover?: { readonly x: number; readonly y: number }; readonly missing?: string } = {},
  ): void {
    b.image(rect, {
      src,
      fill: surface.parchment.hex,
      cover: options.cover ?? { x: 0.5, y: 0.2 },
      ...(options.missing ? { missing: options.missing } : {}),
    });
  }

  #drawDashRow(b: SheetBuilder, row: DashRow, rect: Rect, phone: boolean, index: number): void {
    const width = rect.width - GUTTER;
    const inkHex = surface.ink.hex;
    switch (row.kind) {
      case "matchup":
        this.#drawMatchupRow(b, row.matchup, rect, phone, index);
        return;
      case "tiles":
        for (const placed of row.tiles) this.#drawTile(b, placed, tileBox(placed, rect, row.height), phone);
        return;
      case "heading":
        b.box({ x: rect.x, y: rect.y + rect.height - 6, width, height: 2 }, { fill: inkHex });
        b.text(rect.x, rect.y + rect.height - 12, row.title.toUpperCase(), bangers(phone ? 18 : 22), {
          color: inkHex,
          origin: [0, 1],
          letterSpacing: 1,
          fitWidth: width,
        });
        return;
      case "note":
        b.text(rect.x + 4, rect.y + 10, row.text, AS_WRITTEN_LABEL, {
          size: 11,
          color: inkHex,
          alpha: ink.secondary,
          wrapWidth: width - 8,
          maxLines: 2,
        });
        return;
      case "donut":
        this.#drawDonut(b, row, rect, phone, width);
        return;
      case "aspects": {
        const label = b.text(rect.x, rect.y + 14, t("stats.aspectsLabel"), typeRole.label, {
          color: inkHex,
          letterSpacing: 1.2,
        });
        let x = rect.x + label.width + 12;
        let y = rect.y;
        for (const entry of row.aspects) {
          const stamp = aspectStampOf(entry.aspect as Parameters<typeof aspectStampOf>[0]);
          const chipLabel = entry.label.toUpperCase();
          const chipWidth = b.measure(chipLabel, typeRole.label).width + 16;
          const chipRect: Rect = { x, y: y + 8, width: chipWidth, height: 26 };
          b.box(chipRect, { fill: stamp.fill, stroke: inkHex, strokeWidth: 2 });
          b.text(chipRect.x + 8, chipRect.y + 6, chipLabel, typeRole.label, { color: stamp.ink });
          const detailX = chipRect.x + chipRect.width + 8;
          const detail = b.text(detailX, chipRect.y + 6, entry.detail, typeRole.body, {
            size: 12,
            color: inkHex,
            alpha: 0.85,
            fitWidth: rect.x + width - detailX,
          });
          if (phone) y += 34;
          else x = detailX + Math.min(detail.width, rect.x + width - detailX) + 18;
          if (x > rect.x + width - 80) break;
        }
        return;
      }
      case "stat":
        this.#drawStat(b, row.row, statBox(rect), phone, row.id);
        return;
      case "cards":
        for (const card of row.cards) {
          const pic: Rect = { x: rect.x + card.x, y: rect.y + 4, width: row.cardWidth, height: row.cardHeight };
          const record = currentCardsById().get(card.cardId);
          this.#picture(b, pic, statCardArt(record)?.url ?? null, { missing: record?.name ?? card.cardId });
          b.box(pic, { stroke: inkHex, strokeWidth: 2 });
          b.text(pic.x, pic.y + pic.height + 6, card.value, typeRole.rowTitle, {
            size: 14,
            color: inkHex,
            fitWidth: pic.width,
          });
          b.text(pic.x, pic.y + pic.height + 24, card.detail, typeRole.body, {
            size: 11,
            color: inkHex,
            alpha: 0.75,
            wrapWidth: pic.width,
            maxLines: 2,
          });
          const key = `card:${row.id}:${card.cardId}`;
          b.tap(key, pic, { inspect: true });
          this.#press(key, () => undefined);
          this.#inspects.set(key, () => this.#inspectCard(card.cardId));
        }
        return;
    }
  }

  /** The Aspects tab's donut: a ring of each aspect's share of your games in its stamp color, and the legend beside it. */
  #drawDonut(
    b: SheetBuilder,
    row: Extract<DashRow, { kind: "donut" }>,
    rect: Rect,
    phone: boolean,
    width: number,
  ): void {
    const inkHex = surface.ink.hex;
    const total = row.shares.reduce((sum, share) => sum + share.games, 0);
    const radius = phone ? 62 : 78;
    const thickness = phone ? 26 : 32;
    const cx = rect.x + radius + 8;
    const cy = rect.y + 12 + radius;
    // The ring is a drawing in the panel (an SVG, in its own units: one per px), arcs in each aspect's stamp color.
    const origin = { x: rect.x, y: rect.y };
    const ops: SvgOp[] = [];
    const mid = radius - thickness / 2;
    const at = (angle: number): string =>
      `${(cx - origin.x + mid * Math.cos(angle)).toFixed(2)} ${(cy - origin.y + mid * Math.sin(angle)).toFixed(2)}`;
    let start = -Math.PI / 2;
    for (const share of row.shares) {
      const sweep = (share.games / Math.max(1, total)) * Math.PI * 2;
      const stamp = aspectStampOf(share.aspect as Parameters<typeof aspectStampOf>[0]);
      const color = sheetColor(stamp.fill, "line");
      if (sweep >= Math.PI * 2 - 1e-6) {
        ops.push({ k: "circle", cx: cx - origin.x, cy: cy - origin.y, r: mid, stroke: color, sw: thickness });
      } else if (sweep > 0) {
        const large = sweep > Math.PI ? 1 : 0;
        ops.push({
          k: "path",
          d: `M ${at(start)} A ${mid} ${mid} 0 ${large} 1 ${at(start + sweep)}`,
          stroke: color,
          sw: thickness,
        });
      }
      start += sweep;
    }
    const line = sheetColor(inkHex, "line");
    ops.push({ k: "circle", cx: cx - origin.x, cy: cy - origin.y, r: radius, stroke: line, sw: 2 });
    ops.push({ k: "circle", cx: cx - origin.x, cy: cy - origin.y, r: radius - thickness, stroke: line, sw: 2 });
    b.svg(
      { x: rect.x, y: rect.y, width: radius * 2 + 16, height: radius * 2 + 24 },
      [radius * 2 + 16, radius * 2 + 24],
      ops,
      `donut:${row.id}`,
    );
    b.text(cx, cy, t("stats.aspectsLabel"), typeRole.label, { color: inkHex, origin: [0.5, 0.5], letterSpacing: 1 });
    let ly = phone ? rect.y + radius * 2 + 30 : rect.y + 18;
    const lx = phone ? rect.x + 4 : cx + radius + 32;
    for (const share of row.shares) {
      const stamp = aspectStampOf(share.aspect as Parameters<typeof aspectStampOf>[0]);
      b.box({ x: lx, y: ly + 2, width: 18, height: 18 }, { fill: stamp.fill, stroke: inkHex, strokeWidth: 2 });
      b.text(lx + 28, ly + 2, share.label.toUpperCase(), typeRole.label, { color: inkHex });
      b.text(
        lx + 150,
        ly + 2,
        t("stats.aspectShare", {
          share: Math.round((share.games / Math.max(1, total)) * 100),
          games: share.games,
          won: Math.round((share.wins / Math.max(1, share.games)) * 100),
        }),
        typeRole.body,
        { size: 12, color: inkHex, alpha: 0.85, fitWidth: rect.x + width - (lx + 150) },
      );
      ly += 26;
    }
  }

  #drawStat(
    b: SheetBuilder,
    row: Extract<DashRow, { kind: "stat" }>["row"],
    box: Rect,
    phone: boolean,
    id: string,
  ): void {
    // A headline fact is solid ink with paper text; every other row is parchment, outlined.
    const filled = row.highlight === true;
    const fg = filled ? surface.paper.hex : surface.ink.hex;
    b.box(box, { fill: filled ? surface.ink.hex : surface.parchment.hex });
    b.box(box, { stroke: surface.ink.hex, strokeWidth: 2 });
    // A row about a card leads with its picture (the hover popover shows it large).
    let left = box.x + 12;
    const card = row.cardId ? currentCardsById().get(row.cardId) : undefined;
    if (card) {
      const pic = statRowPicture(box);
      this.#picture(b, pic, statCardArt(card)?.url ?? null, { missing: card.name });
      left = pic.x + pic.width + 10;
    }
    const linked = this.#gameLinkOf(row);
    const value = b.text(box.x + box.width - 12, box.y + 8, row.value, typeRole.rowTitle, {
      size: 15,
      color: fg,
      origin: [1, 0],
      fitWidth: box.width * 0.45,
    });
    b.text(left, box.y + 8, row.label, typeRole.rowTitle, {
      size: 15,
      color: fg,
      fitWidth: Math.max(20, box.x + box.width - 12 - left - Math.min(value.width, box.width * 0.45) - 12),
    });
    // A record from one game says so, and what a press does: an underlined "View game" with an arrow at the right.
    let detailRight = box.x + box.width - 12;
    if (linked) {
      const label = t("stats.viewGame");
      const link = b.text(box.x + box.width - 12, box.y + box.height - 10, label, AS_WRITTEN_LABEL, {
        size: 12,
        color: fg,
        origin: [1, 1],
      });
      b.box(
        { x: box.x + box.width - 12 - link.width, y: box.y + box.height - 9, width: link.width, height: 2 },
        { fill: fg },
      );
      detailRight = box.x + box.width - 12 - link.width - 12;
    }
    if (row.detail) {
      b.text(left, box.y + 30, row.detail, typeRole.body, {
        size: 12,
        color: fg,
        alpha: filled ? 0.85 : 0.75,
        wrapWidth: Math.max(20, detailRight - left),
        maxLines: phone ? 2 : 1,
      });
    }
    if (row.losses) this.#drawLossBar(b, row.losses, left, box, phone);
    // The whole row takes the press: a record that names a game opens it; a card row also opens Inspect on a hold.
    const key = `row:${id}`;
    b.tap(key, box, row.cardId && card ? { inspect: true } : {});
    this.#press(key, () => {
      if (linked) this.#openGame(row.gameId!);
    });
    if (row.cardId && card) this.#inspects.set(key, () => this.#inspectCard(row.cardId!));
  }

  /** Why a row's games were lost: a stacked bar, and each part in words (beside the bar; under it on a phone). */
  #drawLossBar(b: SheetBuilder, parts: readonly LossPart[], left: number, box: Rect, phone: boolean): void {
    const right = box.x + box.width - 12;
    const full = right - left;
    const bar: Rect = {
      x: left,
      y: box.y + box.height - (phone ? 36 : 22),
      width: phone ? full : Math.round(full * 0.3),
      height: 12,
    };
    const total = parts.reduce((sum, part) => sum + part.count, 0);
    let x = bar.x;
    for (const part of parts) {
      const w = (bar.width * part.count) / total;
      b.box({ x, y: bar.y, width: w, height: bar.height }, { fill: LOSS_COLORS[part.cause] });
      x += w;
    }
    b.box(bar, { stroke: surface.ink.hex, strokeWidth: 2 });
    const legendX = phone ? bar.x : bar.x + bar.width + 10;
    b.text(
      legendX,
      phone ? bar.y + 15 : bar.y - 2,
      parts.map((part) => `${part.label} ${part.count}`).join(" · "),
      typeRole.body,
      {
        size: 12,
        color: surface.ink.hex,
        alpha: 0.85,
        fitWidth: right - legendX,
      },
    );
  }

  /**
   * The wide Overview's favorite hero: the art fills the tall tile, and the name and record sit at its foot over an ink
   * shade that darkens toward the bottom, so the paper text reads on any picture.
   */
  #drawTallHero(b: SheetBuilder, tile: Extract<OverviewTile, { kind: "portrait" }>, box: Rect): void {
    const hero = "hero" in tile.art ? tile.art.hero : null;
    const pictureRect: Rect = { x: box.x + 2, y: box.y + 2, width: box.width - 4, height: box.height - 4 };
    const focus = (hero ? heroFocusOf(hero) : null) ?? undefined;
    this.#picture(b, pictureRect, hero ? heroPicture(hero) : null, {
      cover: { x: focus?.x ?? 0.5, y: focus?.y ?? 0.2 },
    });
    const pad = 18;
    const inner = box.width - pad * 2;
    // Measured from the foot up: the extra line, the detail, the name, the caption.
    const extraY = box.y + box.height - pad - 18;
    const detailY = tile.extra ? extraY - 20 : extraY;
    const nameSize = 40;
    const nameY = detailY - nameSize - 4;
    const captionY = nameY - 18;
    const shadeTop = Math.max(box.y + 2, captionY - 70);
    const steps = 12;
    const span = box.y + box.height - 2 - shadeTop;
    for (let i = 0; i < steps; i++) {
      // Clear at the top of the shade, nearly solid under the text.
      const alpha = Math.min(0.9, 0.12 + (0.9 * (i + 1)) / steps);
      const top = Math.round(shadeTop + (span * i) / steps);
      const bottom = Math.round(shadeTop + (span * (i + 1)) / steps);
      b.box(
        { x: pictureRect.x, y: top, width: pictureRect.width, height: bottom - top },
        { fill: surface.ink.hex, fillAlpha: alpha },
      );
    }
    // The frame again, over the art and its shade, as every other tile has.
    b.box(box, { stroke: surface.ink.hex, strokeWidth: 2 });
    this.#caption(b, tile.label, box.x + pad, captionY, signal.caution.hex, inner);
    b.text(box.x + pad, nameY, tile.name.toUpperCase(), bangers(nameSize), {
      color: surface.paper.hex,
      letterSpacing: 1,
      fitWidth: inner,
    });
    this.#body(b, tile.detail, box.x + pad, detailY, inner, 1, surface.paper.hex);
    if (tile.extra) this.#body(b, tile.extra, box.x + pad, extraY, inner, 1, surface.paper.hex);
  }

  #drawTile(b: SheetBuilder, placed: PlacedTile, box: Rect, phone: boolean): void {
    const tile: OverviewTile = placed.tile;
    const dark = tile.kind === "record" || (tile.kind === "portrait" && tile.wide);
    const fg = dark ? surface.paper.hex : surface.ink.hex;
    const pad = phone ? 10 : 16;
    const inner = box.width - pad * 2;
    const key = `tile:${tile.id}`;
    b.box(box, { fill: dark ? surface.ink.hex : surface.parchment.hex });
    // The frame goes on after the parts that fill the tile (the tall hero's art), so it is drawn at the end.
    const frame = (): void => b.box(box, { stroke: surface.ink.hex, strokeWidth: 2 });
    switch (tile.kind) {
      case "record": {
        this.#caption(b, t("stats.winsLosses"), box.x + pad, box.y + pad, fg, inner);
        b.text(box.x + box.width - pad, box.y + pad, tile.rate.toUpperCase(), typeRole.label, {
          size: 12,
          color: fg,
          origin: [1, 0],
        });
        b.text(box.x + pad, box.y + pad + 18, tile.record.toUpperCase(), bangers(phone ? 40 : 58), {
          color: fg,
          letterSpacing: 1,
          fitWidth: inner * 0.6,
        });
        const trackY = box.y + box.height - pad - 12 - (phone ? 18 : 22);
        b.box({ x: box.x + pad, y: trackY, width: inner, height: 12 }, { stroke: fg, strokeWidth: 2 });
        if (tile.fraction > 0)
          b.box(
            { x: box.x + pad + 3, y: trackY + 3, width: Math.max(2, (inner - 6) * tile.fraction), height: 6 },
            { fill: accent.heroRed.hex },
          );
        this.#body(b, tile.detail, box.x + pad, trackY + 16, inner, 1, fg);
        break;
      }
      case "split": {
        this.#caption(b, tile.label, box.x + pad, box.y + pad, fg, inner);
        const total = tile.parts.reduce((sum, p) => sum + p.count, 0) || 1;
        const barRect: Rect = { x: box.x + pad, y: box.y + pad + 22, width: inner, height: 28 };
        let x = barRect.x;
        for (const part of tile.parts) {
          const w = (barRect.width * part.count) / total;
          if (w <= 0) continue;
          const tone =
            part.tone === "caution" ? signal.caution.hex : part.tone === "muted" ? MUTED_PART : surface.ink.hex;
          b.box({ x, y: barRect.y, width: w, height: barRect.height }, { fill: tone });
          // A paper edge between parts, so two dark parts side by side still read as two.
          if (x > barRect.x)
            b.box({ x: x - 1, y: barRect.y, width: 2, height: barRect.height }, { fill: surface.paper.hex });
          b.text(x + 6, barRect.y + 7, `${part.label.toUpperCase()} ${part.count}`, typeRole.label, {
            size: 11,
            color: part.tone === "ink" ? surface.paper.hex : surface.ink.hex,
            fitWidth: Math.max(10, w - 8),
          });
          x += w;
        }
        b.box(barRect, { stroke: surface.ink.hex, strokeWidth: 2 });
        this.#body(b, tile.detail, box.x + pad, barRect.y + barRect.height + 10, inner, phone ? 1 : 3, fg);
        break;
      }
      case "figures": {
        this.#caption(b, tile.label, box.x + pad, box.y + pad, fg, inner);
        tile.lines.forEach((line, i) => {
          const ly = box.y + pad + 22 + i * (phone ? 20 : 26);
          b.text(box.x + pad, ly, line.label, typeRole.rowTitle, { size: phone ? 13 : 15, color: fg });
          b.text(box.x + box.width - pad, ly, line.value, typeRole.rowTitle, {
            size: phone ? 13 : 15,
            color: fg,
            origin: [1, 0],
          });
        });
        break;
      }
      case "portrait": {
        if (placed.tall) {
          this.#drawTallHero(b, tile, box);
          break;
        }
        const wide = tile.wide;
        const pictureRect: Rect = wide
          ? { x: box.x + 2, y: box.y + 2, width: Math.round(box.width * (phone ? 0.34 : 0.4)), height: box.height - 4 }
          : { x: box.x + 2, y: box.y + 2, width: box.width - 4, height: Math.round(box.height * 0.45) };
        const url = "hero" in tile.art ? heroPicture(tile.art.hero) : villainPicture(tile.art.scenario);
        this.#picture(b, pictureRect, url);
        const tx = wide ? pictureRect.x + pictureRect.width + pad : box.x + pad;
        const ty = wide ? box.y + pad : pictureRect.y + pictureRect.height + 8;
        const tw = wide ? box.x + box.width - pad - tx : inner;
        this.#caption(b, tile.label, tx, ty, wide ? signal.caution.hex : fg, tw);
        const nameSize = phone ? 20 : wide ? 32 : 24;
        const name = b.text(tx, ty + 16, tile.name.toUpperCase(), bangers(nameSize), {
          color: fg,
          letterSpacing: 1,
          fitWidth: tw,
        });
        const detail = this.#body(b, tile.detail, tx, ty + 16 + name.height + 4, tw, 1, fg);
        if (tile.extra) this.#body(b, tile.extra, tx, ty + 16 + name.height + 24, tw, wide ? 2 : 1, fg);
        void detail;
        break;
      }
      case "small": {
        this.#caption(b, tile.label, box.x + pad, box.y + pad, fg, inner);
        b.text(box.x + pad, box.y + pad + 18, tile.value.toUpperCase(), bangers(phone ? 20 : 24), {
          color: fg,
          letterSpacing: 1,
          fitWidth: inner,
        });
        this.#body(b, tile.detail, box.x + pad, box.y + pad + (phone ? 44 : 50), inner, 1, fg);
        break;
      }
    }
    if (!(tile.kind === "portrait" && placed.tall)) frame();
    // A tile is a focus stop with nothing to press: a tap area lets its box be found by key.
    b.box({ x: box.x, y: box.y, width: 1, height: 1 }, { key });
  }

  /** The Matchups tab's Shelves and Focus rows (`view/matchup-grid.ts` lays them out). */
  #drawMatchupRow(
    b: SheetBuilder,
    matchup: Extract<DashRow, { kind: "matchup" }>["matchup"],
    rect: Rect,
    phone: boolean,
    index: number,
  ): void {
    const width = rect.width - GUTTER;
    if (matchup.kind === "legend") {
      drawLegendNodes(b, matchup.layout, rect.x, rect.y + 2);
      return;
    }
    if (matchup.kind === "shelf") {
      const { shelf } = matchup;
      const id = this.#matchup().rows[shelf.row]!.id;
      drawShelfNodes(b, shelf, { ...rect, width }, this.#pictureOf("row", id), phone);
      const key = `row:matchup:${shelf.row}`;
      b.tap(key, { x: rect.x, y: rect.y + 3, width, height: rect.height - 6 });
      this.#press(key, () => this.#openFocus(shelf.row, false));
      return;
    }
    const columns = this.#matchup().columns;
    for (const tile of matchup.tiles) {
      drawTileNodes(
        b,
        tile,
        { x: rect.x + tile.x, y: rect.y, width: matchup.tileWidth, height: matchup.tileHeight },
        this.#pictureOf("column", columns[tile.column]!.id),
        phone,
      );
    }
    void index;
  }
}

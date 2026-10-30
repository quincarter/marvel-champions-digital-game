/**
 * Your stats: a tabbed dashboard of what the player's finished games say about how they play
 * (`view/player-stats-model.ts`, laid out by `view/player-stats-layout.ts`).
 *
 * Tabs: Overview (tiles: the record, how you lose, per-game figures, the favorite hero and the villains with their
 * art), Heroes, Villains, Side schemes, Devices (once a synced game says where it was played) and Cards by hero (each
 * hero's most played, most used and rarely played cards as pictures). LB / RB switch tabs and LT / RT switch heroes; a
 * pad or keyboard walks every tile, row and card, and the list follows the ring. Each card picture, and each row about
 * a card, opens the card hover popover under a resting mouse. Read-only: only the tabs, the hero chips and Back press
 * anything, and none of them sits over the scrolling list.
 *
 * Opened two ways (`PlayerStatsData`): as a screen from the Title, Decks & Collection or the Trophy Room (Back goes to
 * that screen), or as an overlay over Settings or Pause (Back closes it, and the scene under it takes input again).
 * The stats are folded in a worker (`view/player-stats-client.ts`) from the saves' rows this scene reads when it opens.
 */
import Phaser from "phaser";
import { CARDS_BY_ID, POOL_CARDS } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { cardFaces } from "../art/card-face-baker.js";
import { HERO_ART, heroArtForIdentity } from "../art/hero-art.js";
import { ART_CATALOG, villainArtFor } from "../art/scenario-art.js";
import { accent, ink, signal, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { addPressShield } from "../ui/press-shield.js";
import { GlyphHints, specsForShortcuts, type CustomSpecs } from "../ui/glyph-hints.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McButton, fitText, fitWrapped } from "../ui/widgets.js";
import { aspectStampOf } from "../view/aspect-stamp.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { clipToView, pageTarget } from "../view/focus-list.js";
import { layerTriggerGlyph } from "../view/input-glyph-model.js";
import type { ShortcutId } from "../view/input-shortcuts.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { loadPlayerStats } from "../view/player-stats-client.js";
import { backfillProgress, onBackfillProgress } from "../progression/stats-backfill.js";
import {
  dashboardRowsOf,
  heroAt,
  statsTabsOf,
  type DashRow,
  type PlacedTile,
  type StatsTab,
} from "../view/player-stats-layout.js";
import type { OverviewTile, PlayerStats, StatsFilter } from "../view/player-stats-model.js";
import { appSession } from "../session.js";
import { renderArtThumb } from "./roster-panel.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

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
const BACK_LABELS: Readonly<Record<string, string>> = {
  [SCENES.title]: "TITLE",
  [SCENES.decks]: "DECKS",
  [SCENES.trophyRoom]: "TROPHIES",
};

/** Room at each row's right edge for the list's own scrollbar. */
const GUTTER = 14;
const CHIP_GAP = 8;
/** The "Other" part of How you lose: a warm grey (the Basic aspect's), with ink text, apart from Wiped's ink. */
const MUTED_PART = 0x9a948a;

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
/** On a phone the filter chips fold behind one "Filters" chip, so the tabs and the stats keep the screen. */
let filtersOpen = false;

const DIFFICULTY_CHIP: Readonly<Record<NonNullable<StatsFilter["difficulty"]>, string>> = {
  standard: "Standard",
  expert: "Expert",
  extreme: "Extreme",
};

/** A shortcut's glyph (LB, RB, or their keys). */
const shortcutSpecs =
  (id: ShortcutId): CustomSpecs =>
  (_set, snapshot) =>
    specsForShortcuts([id], snapshot);

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
  onClick: () => void;
  glyph?: CustomSpecs | null;
  /** A fixed width, in place of the label's own. */
  width?: number;
}

export class PlayerStatsScene extends Phaser.Scene {
  /** Counts reads of the saves, so a fold that answers after a newer one began is dropped (`#load`). */
  #loads = 0;
  /** The stops the last draw made, for X's jump to the filter chips. */
  #stops = new Map<string, FocusStop>();
  #data: PlayerStatsData = {};
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
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
    const under = this.#data.overlay && this.#data.from ? this.scene.get(this.#data.from) : null;
    if (under) {
      under.input.enabled = false;
      if (under.input.keyboard) under.input.keyboard.enabled = false;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
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
        this.#draw();
      });
    };
    this.#offArt = [
      cardArt(this).onArrived(redraw),
      cardFaces(this).onBaked(redraw),
      // Older games being filled in (#529): the Overview says how far it has got, and the stats reload when it ends.
      onBackfillProgress((progress) => {
        if (progress.running) redraw();
        else void this.#load();
      }),
    ];
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      onTab: (direction) => this.#stepTab(direction),
      onTrigger: (trigger) => this.#stepHero(trigger === "lt" ? -1 : 1),
      onPage: (direction) => this.#pageFocus(direction),
      onHomeEnd: (edge) => this.#focusEdge(edge),
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
      // X (G / H): to the filter chips, opening them on a phone; the chip it lands on wears the glyph. (View is not
      // bound here: its key, R / P, is LB's on the keyboard.)
      onToggle: () => this.#focusFilters(),
      blocked: () => this.scene.isActive(SCENES.inspect),
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
      if (under) {
        under.input.enabled = true;
        if (under.input.keyboard) under.input.keyboard.enabled = true;
      }
    });
    // Dev e2e hook (never referenced by product code): which card the hover popover shows.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcStatsDebug?: unknown }).__mcStatsDebug = {
        hoverShown: () => this.#hover?.shownKey ?? null,
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
      if (first && this.#data.tab) lastTab = this.#data.tab;
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
    return this.#stats ? statsTabsOf(this.#stats).map((t) => t.id) : [];
  }

  #setTab(tab: StatsTab): void {
    lastTab = tab;
    this.#draw();
    this.#route?.focusKey(`tab:${tab}`);
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
    const key = edge === "home" ? this.#listKeys[0] : this.#listKeys.at(-1);
    if (key) this.#route?.focusKey(key);
  }

  /** The card pictures and card rows on screen now, each clipped to the list. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const list = this.#list;
    const view = this.#listRect;
    if (!list || !view) return found;
    this.#rows.forEach((row, index) => {
      const r = list.rectFor(index);
      // `through`: the list takes taps by position, so nothing in a row is an interactive object of its own.
      if (row.kind === "stat" && row.row.cardId) {
        const shown = clipHoverRect({ ...r, width: r.width - GUTTER }, view);
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
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
    this.#listRect = null;
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
  }

  /** A card the stats name, opened in Inspect (A or Y on its picture or its row): the pad's way to read it large. */
  #inspectCard(cardId: string): void {
    if (!CARDS_BY_ID.has(cardId)) return;
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
      this.#route?.focusKey(key);
      void this.#load().then(() => this.#route?.focusKey(key));
    };
    const heroName = heroes.find((h) => h.id === filter.hero)?.name.replace(/ \(.*\)$/, "");
    const set = filter.hero !== undefined || filter.villain !== undefined || filter.difficulty !== undefined;
    const chips = [
      {
        key: "filter:hero",
        label: heroName ?? (phone ? "Heroes" : "All heroes"),
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
        label: filter.villain ?? (phone ? "Villains" : "All villains"),
        selected: filter.villain !== undefined,
        onClick: () => apply({ ...filter, villain: step(villains, filter.villain) }, "filter:villain"),
      },
      ...(difficulties.length > 1 || filter.difficulty !== undefined
        ? [
            {
              key: "filter:difficulty",
              label: filter.difficulty ? DIFFICULTY_CHIP[filter.difficulty] : phone ? "Difficulty" : "All difficulties",
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
              label: "✕ Clear",
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
        label: `${filtersOpen ? "▾" : "▸"} Filters${count > 0 ? ` · ${count}` : ""}`,
        glyph: shortcutSpecs("guide"),
        selected: count > 0,
        onClick: () => {
          filtersOpen = !filtersOpen;
          this.#draw();
          this.#route?.focusKey("filter:toggle");
        },
      };
      return filtersOpen ? [toggle, ...chips] : [toggle];
    }
    return chips;
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
        onClick: chip.onClick,
      });
      this.#buttons.push(button);
      if (chip.glyph) this.#hints.button(button, [], "paper", { specs: chip.glyph });
      stops.set(chip.key, { rect, activate: chip.onClick });
      order.push(chip.key);
      x += chipWidth + CHIP_GAP;
    }
    return y + height;
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
    const backWord = this.#data.overlay ? "BACK" : (BACK_LABELS[this.#data.from ?? SCENES.trophyRoom] ?? "BACK");
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${backWord}`,
      onBack: () => this.#back(),
      hints: this.#hints,
      title: "Your stats",
      ...(phone || !stats ? {} : { right: stats.header.played }),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) {
      stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
      order.push("back");
    }

    if (!stats) {
      this.#rows = [];
      this.#listKeys = [];
      this.add
        .text(
          width / 2,
          bar.height + 80,
          this.#failed ? "Your games could not be read." : "Reading your games…",
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0.5, 0);
      this.#stops = stops;
      this.#route?.set(order, stops);
      return;
    }

    const tabs = statsTabsOf(stats);
    if (!tabs.some((t) => t.id === lastTab)) lastTab = "overview";
    const at = tabs.findIndex((t) => t.id === lastTab);
    const inner = width - gutter * 2;
    // LB on the tab before this one and RB on the tab after it: the glyphs say where the bumpers go.
    // On a phone the Filters chip follows the tabs in their own rows, so it takes no row of its own.
    const filters = this.#filterChips(stats, phone);
    let y = this.#drawChips(
      bar.height + 12,
      gutter,
      inner,
      [
        ...tabs.map((tab, index) => ({
          key: `tab:${tab.id}`,
          label: tab.label,
          selected: tab.id === lastTab,
          onClick: () => this.#setTab(tab.id),
          glyph:
            tabs.length > 1 && index === (at - 1 + tabs.length) % tabs.length
              ? shortcutSpecs("zonePrevious")
              : tabs.length > 1 && index === (at + 1) % tabs.length
                ? shortcutSpecs("zoneNext")
                : null,
        })),
        ...(phone ? filters : []),
      ],
      stops,
      order,
      phone,
    );
    if (!phone && filters.length > 0) y = this.#drawChips(y + 10, gutter, inner, filters, stops, order, phone);

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
                : `${heroName} · ${current.games} · ${heroes.indexOf(current) + 1} of ${heroes.length}`,
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

    const listTop = y + 12;
    const listRect: Rect = { x: gutter, y: listTop, width: inner, height: Math.max(60, height - listTop - gutter) };
    const rowWidth = inner - GUTTER;
    const backfill = backfillProgress();
    const rows: DashRow[] = [
      ...(lastTab === "overview" && backfill.running
        ? [
            {
              kind: "note" as const,
              id: "ov:backfill",
              height: phone ? 52 : 40,
              text: `Filling in your older games from their saved logs: ${backfill.done} of ${backfill.total}. Their card numbers appear here when it is done.`,
            },
          ]
        : []),
      ...dashboardRowsOf(stats, lastTab, lastHero, rowWidth, phone),
    ];
    this.#rows = rows;
    const list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: rows[0]?.height ?? 60,
      rowHeightOf: (index) => rows[index]!.height,
      count: rows.length,
      scroll: this.#scrollOf(lastTab === "cards" ? `cards:${lastHero}` : lastTab),
      background: false,
      renderRow: (index, rect) => this.#renderRow(rows[index]!, rect, phone),
    });
    this.#list = list;
    this.#listRect = listRect;

    // Every tile, stat row and card picture is a stop, so a pad or keyboard can walk the whole tab.
    const listKeys: string[] = [];
    const addStop = (key: string, index: number, part: (r: Rect) => Rect, cardId?: string): void => {
      listKeys.push(key);
      stops.set(key, {
        rect: () => clipToView(part(list.rectFor(index)), listRect),
        view: listRect,
        activate: cardId ? () => this.#inspectCard(cardId) : () => undefined,
        ...(cardId ? { inspect: () => this.#inspectCard(cardId) } : {}),
        ensureVisible: () => list.scrollIntoView(index),
      });
    };
    rows.forEach((row, index) => {
      if (row.kind === "tiles") {
        for (const placed of row.tiles) {
          addStop(`tile:${placed.tile.id}`, index, (r) => ({
            x: r.x + placed.x,
            y: r.y,
            width: placed.width,
            height: row.height - 14,
          }));
        }
      } else if (row.kind === "stat") {
        addStop(`row:${row.id}`, index, (r) => ({ ...r, width: r.width - GUTTER }), row.row.cardId);
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
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }

  #renderRow(row: DashRow, rect: Rect, phone: boolean): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const width = rect.width - GUTTER;
    switch (row.kind) {
      case "tiles":
        for (const placed of row.tiles) {
          objects.push(
            ...this.#renderTile(
              placed,
              { x: rect.x + placed.x, y: rect.y, width: placed.width, height: row.height - 14 },
              phone,
            ),
          );
        }
        break;
      case "heading": {
        const g = this.add.graphics();
        g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y + rect.height - 6, width, 2);
        const title = this.add
          .text(
            rect.x,
            rect.y + rect.height - 12,
            row.title.toUpperCase(),
            textStyle(bangers(phone ? 18 : 22), surface.ink.hex),
          )
          .setOrigin(0, 1)
          .setLetterSpacing(1);
        fitText(title, width, phone ? 18 : 22);
        objects.push(g, title);
        break;
      }
      case "note": {
        const text = this.add.text(
          rect.x + 4,
          rect.y + 10,
          row.text,
          textStyle(typeRole.label, surface.ink.hex, ink.secondary),
        );
        fitWrapped(text, width - 8, 2, 11);
        objects.push(text);
        break;
      }
      case "donut": {
        // A ring of each aspect's share of your games, in its stamp color, and a legend beside it (under it on a phone).
        const total = row.shares.reduce((sum, share) => sum + share.games, 0);
        const radius = phone ? 62 : 78;
        const thickness = phone ? 26 : 32;
        const cx = rect.x + radius + 8;
        const cy = rect.y + 12 + radius;
        const g = this.add.graphics();
        let at = -Math.PI / 2;
        for (const share of row.shares) {
          const sweep = (share.games / Math.max(1, total)) * Math.PI * 2;
          const stamp = aspectStampOf(share.aspect as Parameters<typeof aspectStampOf>[0]);
          g.lineStyle(thickness, stamp.fill, 1)
            .beginPath()
            .arc(cx, cy, radius - thickness / 2, at, at + sweep)
            .strokePath();
          at += sweep;
        }
        g.lineStyle(2, surface.ink.hex, 1)
          .strokeCircle(cx, cy, radius)
          .strokeCircle(cx, cy, radius - thickness);
        const middle = this.add
          .text(cx, cy, "ASPECTS", textStyle(typeRole.label, surface.ink.hex, 1))
          .setOrigin(0.5)
          .setLetterSpacing(1);
        objects.push(g, middle);
        let ly = phone ? rect.y + radius * 2 + 30 : rect.y + 18;
        const lx = phone ? rect.x + 4 : cx + radius + 32;
        for (const share of row.shares) {
          const stamp = aspectStampOf(share.aspect as Parameters<typeof aspectStampOf>[0]);
          const swatch = this.add.graphics();
          swatch.fillStyle(stamp.fill, 1).fillRect(lx, ly + 2, 18, 18);
          swatch.lineStyle(2, surface.ink.hex, 1).strokeRect(lx, ly + 2, 18, 18);
          const name = this.add.text(
            lx + 28,
            ly + 2,
            share.label.toUpperCase(),
            textStyle(typeRole.label, surface.ink.hex, 1),
          );
          const facts = this.add
            .text(
              lx + 150,
              ly + 2,
              `${Math.round((share.games / Math.max(1, total)) * 100)}% · ${share.games} games · ${Math.round((share.wins / Math.max(1, share.games)) * 100)}% won`,
              textStyle(typeRole.body, surface.ink.hex, 0.85),
            )
            .setFontSize(12);
          fitText(facts, rect.x + width - facts.x, 12);
          objects.push(swatch, name, facts);
          ly += 26;
        }
        break;
      }
      case "aspects": {
        let x = rect.x;
        let y = rect.y;
        const label = this.add
          .text(x, rect.y + 14, "ASPECTS", textStyle(typeRole.label, surface.ink.hex, 1))
          .setLetterSpacing(1.2);
        objects.push(label);
        const start = x + label.width + 12;
        x = start;
        for (const entry of row.aspects) {
          const stamp = aspectStampOf(entry.aspect as Parameters<typeof aspectStampOf>[0]);
          const chip = this.add.text(0, 0, entry.label.toUpperCase(), textStyle(typeRole.label, stamp.ink, 1));
          const chipRect: Rect = { x, y: y + 8, width: chip.width + 16, height: 26 };
          const g = this.add.graphics();
          g.fillStyle(stamp.fill, 1).fillRect(chipRect.x, chipRect.y, chipRect.width, chipRect.height);
          g.lineStyle(2, surface.ink.hex, 1).strokeRect(chipRect.x, chipRect.y, chipRect.width, chipRect.height);
          chip.setPosition(chipRect.x + 8, chipRect.y + 6);
          const detail = this.add
            .text(
              chipRect.x + chipRect.width + 8,
              chipRect.y + 6,
              entry.detail,
              textStyle(typeRole.body, surface.ink.hex, 0.85),
            )
            .setFontSize(12);
          fitText(detail, rect.x + width - detail.x, 12);
          objects.push(g, chip, detail);
          if (phone) y += 34;
          else x = detail.x + detail.width + 18;
          if (x > rect.x + width - 80) break;
        }
        break;
      }
      case "stat": {
        objects.push(...this.#renderStat(row.row, { x: rect.x, y: rect.y + 3, width, height: rect.height - 6 }, phone));
        break;
      }
      case "cards":
        for (const card of row.cards) {
          const pic: Rect = { x: rect.x + card.x, y: rect.y + 4, width: row.cardWidth, height: row.cardHeight };
          const frame = this.add.graphics();
          frame.fillStyle(surface.parchment.hex, 1).fillRect(pic.x, pic.y, pic.width, pic.height);
          objects.push(frame);
          const key = cardArt(this).request(this, artFor(CARDS_BY_ID.get(card.cardId), { kind: "front" }));
          const art = drawArt(this, key, pic);
          if (art) objects.push(art);
          else {
            const name = this.add
              .text(
                pic.x + 6,
                pic.y + 6,
                CARDS_BY_ID.get(card.cardId)?.name ?? card.cardId,
                textStyle(typeRole.label, surface.ink.hex, 1),
              )
              .setWordWrapWidth(pic.width - 12);
            objects.push(name);
          }
          frame.lineStyle(2, surface.ink.hex, 1).strokeRect(pic.x, pic.y, pic.width, pic.height);
          const value = this.add
            .text(pic.x, pic.y + pic.height + 6, card.value, textStyle(typeRole.rowTitle, surface.ink.hex, 1))
            .setFontSize(14);
          const detail = this.add
            .text(pic.x, value.y + 18, card.detail, textStyle(typeRole.body, surface.ink.hex, 0.75))
            .setFontSize(11);
          fitWrapped(detail, pic.width, 2, 10);
          objects.push(value, detail);
        }
        break;
    }
    return { objects };
  }

  #renderStat(
    row: Extract<DashRow, { kind: "stat" }>["row"],
    box: Rect,
    phone: boolean,
  ): Phaser.GameObjects.GameObject[] {
    // A headline fact is solid ink with paper text; every other row is parchment, outlined.
    const filled = row.highlight === true;
    const fg = filled ? surface.paper.hex : surface.ink.hex;
    const g = this.add.graphics();
    g.fillStyle(filled ? surface.ink.hex : surface.parchment.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
    const objects: Phaser.GameObjects.GameObject[] = [g];
    // A row about a card leads with its picture (the hover popover shows it large).
    let left = box.x + 12;
    const card = row.cardId ? CARDS_BY_ID.get(row.cardId) : undefined;
    if (card) {
      const height = box.height - 10;
      const pic: Rect = { x: box.x + 6, y: box.y + 5, width: Math.round((height * 63) / 88), height };
      g.fillStyle(surface.parchment.hex, 1).fillRect(pic.x, pic.y, pic.width, pic.height);
      const art = drawArt(this, cardArt(this).request(this, artFor(card, { kind: "front" })), pic);
      if (art) objects.push(art);
      left = pic.x + pic.width + 10;
    }
    const value = this.add
      .text(box.x + box.width - 12, box.y + 8, row.value, textStyle(typeRole.rowTitle, fg, 1))
      .setOrigin(1, 0)
      .setFontSize(15);
    fitText(value, box.width * 0.45, 15);
    const label = this.add.text(left, box.y + 8, row.label, textStyle(typeRole.rowTitle, fg, 1)).setFontSize(15);
    fitText(label, box.x + box.width - 12 - left - value.width - 12, 15);
    objects.push(value, label);
    if (row.detail) {
      const detail = this.add.text(left, box.y + 30, row.detail, textStyle(typeRole.body, fg, filled ? 0.85 : 0.75));
      fitWrapped(detail, box.x + box.width - 12 - left, phone ? 2 : 1, 12);
      objects.push(detail);
    }
    return objects;
  }

  #renderTile(placed: PlacedTile, box: Rect, phone: boolean): Phaser.GameObjects.GameObject[] {
    const tile: OverviewTile = placed.tile;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const dark = tile.kind === "record" || (tile.kind === "portrait" && tile.wide);
    const fg = dark ? surface.paper.hex : surface.ink.hex;
    const g = this.add.graphics();
    g.fillStyle(dark ? surface.ink.hex : surface.parchment.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
    objects.push(g);
    const pad = phone ? 10 : 16;
    const caption = (
      text: string,
      x: number,
      y: number,
      color = fg,
      width = box.width - pad * 2,
    ): Phaser.GameObjects.Text => {
      const t = this.add
        .text(x, y, text.toUpperCase(), textStyle(typeRole.label, color, 1))
        .setLetterSpacing(1.2)
        .setFontSize(11);
      fitText(t, width, 11);
      objects.push(t);
      return t;
    };
    const body = (
      text: string,
      x: number,
      y: number,
      width: number,
      lines = 2,
      color = fg,
    ): Phaser.GameObjects.Text => {
      const t = this.add.text(x, y, text, textStyle(typeRole.body, color, 0.9)).setFontSize(13);
      fitWrapped(t, width, lines, 11);
      objects.push(t);
      return t;
    };
    const big = (
      text: string,
      x: number,
      y: number,
      size: number,
      width: number,
      color = fg,
    ): Phaser.GameObjects.Text => {
      const t = this.add.text(x, y, text.toUpperCase(), textStyle(bangers(size), color)).setLetterSpacing(1);
      fitText(t, width, size);
      objects.push(t);
      return t;
    };
    const inner = box.width - pad * 2;
    switch (tile.kind) {
      case "record": {
        caption("Wins–losses", box.x + pad, box.y + pad);
        const rate = this.add
          .text(box.x + box.width - pad, box.y + pad, tile.rate.toUpperCase(), textStyle(typeRole.label, fg, 1))
          .setOrigin(1, 0)
          .setFontSize(12);
        objects.push(rate);
        big(tile.record, box.x + pad, box.y + pad + 18, phone ? 40 : 58, inner * 0.6);
        const trackY = box.y + box.height - pad - 12 - (phone ? 18 : 22);
        g.lineStyle(2, fg, 1).strokeRect(box.x + pad, trackY, inner, 12);
        if (tile.fraction > 0)
          g.fillStyle(accent.heroRed.hex, 1).fillRect(
            box.x + pad + 3,
            trackY + 3,
            Math.max(2, (inner - 6) * tile.fraction),
            6,
          );
        body(tile.detail, box.x + pad, trackY + 16, inner, 1);
        break;
      }
      case "split": {
        caption(tile.label, box.x + pad, box.y + pad);
        const total = tile.parts.reduce((sum, p) => sum + p.count, 0) || 1;
        const barRect: Rect = { x: box.x + pad, y: box.y + pad + 22, width: inner, height: 28 };
        let x = barRect.x;
        for (const part of tile.parts) {
          const w = (barRect.width * part.count) / total;
          if (w <= 0) continue;
          const tone =
            part.tone === "caution" ? signal.caution.hex : part.tone === "muted" ? MUTED_PART : surface.ink.hex;
          g.fillStyle(tone, 1).fillRect(x, barRect.y, w, barRect.height);
          const label = this.add
            .text(
              x + 6,
              barRect.y + 7,
              `${part.label.toUpperCase()} ${part.count}`,
              textStyle(typeRole.label, part.tone === "ink" ? surface.paper.hex : surface.ink.hex, 1),
            )
            .setFontSize(11);
          fitText(label, Math.max(10, w - 8), 11);
          // A paper edge between parts, so two dark parts side by side still read as two.
          if (x > barRect.x) g.fillStyle(surface.paper.hex, 1).fillRect(x - 1, barRect.y, 2, barRect.height);
          objects.push(label);
          x += w;
        }
        g.lineStyle(2, surface.ink.hex, 1).strokeRect(barRect.x, barRect.y, barRect.width, barRect.height);
        body(tile.detail, box.x + pad, barRect.y + barRect.height + 10, inner, phone ? 1 : 3);
        break;
      }
      case "figures": {
        caption(tile.label, box.x + pad, box.y + pad);
        tile.lines.forEach((line, i) => {
          const ly = box.y + pad + 22 + i * (phone ? 20 : 26);
          const l = this.add
            .text(box.x + pad, ly, line.label, textStyle(typeRole.rowTitle, fg, 1))
            .setFontSize(phone ? 13 : 15);
          const v = this.add
            .text(box.x + box.width - pad, ly, line.value, textStyle(typeRole.rowTitle, fg, 1))
            .setOrigin(1, 0)
            .setFontSize(phone ? 13 : 15);
          objects.push(l, v);
        });
        break;
      }
      case "portrait": {
        const wide = tile.wide;
        const pictureRect: Rect = wide
          ? { x: box.x + 2, y: box.y + 2, width: Math.round(box.width * (phone ? 0.34 : 0.4)), height: box.height - 4 }
          : { x: box.x + 2, y: box.y + 2, width: box.width - 4, height: Math.round(box.height * 0.45) };
        const url =
          "hero" in tile.art
            ? (heroArtForIdentity(HERO_ART, tile.art.hero, POOL_CARDS, () => 0)?.url ?? null)
            : (villainArtFor(ART_CATALOG, tile.art.scenario, () => 0)?.url ?? null);
        objects.push(renderArtThumb(this, pictureRect, url, 0.2));
        const tx = wide ? pictureRect.x + pictureRect.width + pad : box.x + pad;
        const ty = wide ? box.y + pad : pictureRect.y + pictureRect.height + 8;
        const tw = wide ? box.x + box.width - pad - tx : inner;
        caption(tile.label, tx, ty, wide ? signal.caution.hex : fg, tw);
        const name = big(tile.name, tx, ty + 16, phone ? 20 : wide ? 32 : 24, tw);
        body(tile.detail, tx, name.y + name.height + 4, tw, 1);
        if (tile.extra) body(tile.extra, tx, name.y + name.height + 24, tw, wide ? 2 : 1, fg);
        break;
      }
      case "small": {
        caption(tile.label, box.x + pad, box.y + pad);
        big(tile.value, box.x + pad, box.y + pad + 18, phone ? 20 : 24, inner);
        body(tile.detail, box.x + pad, box.y + pad + (phone ? 44 : 50), inner, 1);
        break;
      }
    }
    return objects;
  }
}

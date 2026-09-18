/**
 * Deck check (W1, docs/phase4-screen-gaps.md §3, P04): a deck's resource
 * curve, composition and full card list at a glance, with "Edit deck" back
 * into the builder and "Start game ▸" into the setup flow — reached today
 * from the Decks screen's own "Check" button on every row, precon or saved.
 *
 * **The entry point is deliberately caller-agnostic**: `DeckCheckSceneData`
 * takes a `Deck` plus an optional `returnTo` (defaults to the Decks screen)
 * and an optional `onStartGame`. Nothing here assumes it was opened from
 * Decks — W2's setup flow will open the same scene with its own `returnTo`
 * (a per-seat step) and its own `onStartGame` (hand the finished lineup to
 * the engine) once it lands, with no change needed here. Until then
 * `onStartGame` is absent and "Start game ▸" draws unavailable with its
 * reason, per §0's "dashed = not yet real" rather than being omitted.
 *
 * Every number comes from `view/deck-stats.ts` (`deckStatsOf`,
 * `costCurveBars`, `deckListGroupsOf`) — this scene only draws what that
 * module already computed, the same "client renders, never computes" rule
 * `deck-builder.ts` follows for legality.
 */
import Phaser from "phaser";
import type { Deck } from "@mc/content";
import { POOL_CARDS } from "../content/pool.js";
import { compositionTilesOf, costCurveBars, deckListGroupsOf, deckStatsOf, type DeckListEntry } from "../view/deck-stats.js";
import { deckCheckFocusOrder } from "../view/screen-focus.js";
import { deckCheckLayout } from "../view/deck-check-layout.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTabs, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { compositionTileDefs, drawCompositionTiles, drawCostCurveBars } from "../ui/deck-stats-widgets.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import { SCENES, type SceneKey } from "./keys.js";

export interface DeckCheckSceneData {
  readonly deck: Deck;
  /** Where Back returns — defaults to the Decks screen, so a caller that only has a deck can still open this. */
  readonly returnTo?: { readonly scene: SceneKey; readonly data?: object };
  /**
   * "Start game ▸"'s handler, supplied only once a setup flow exists to hand the finished lineup off to (W2).
   * Absent today: this screen draws Start game unavailable with its reason rather than omitting it.
   */
  readonly onStartGame?: () => void;
}

type DeckCheckTab = "curve" | "cards" | "aspect";

/** One row of the Cards tab's virtualized list: a group header (no quantity, not a focus stop) or a card line. */
type CardsTabRow = { readonly kind: "header"; readonly label: string; readonly count: number } | { readonly kind: "card"; readonly entry: DeckListEntry };

const ROW_HEIGHT = 40;
const CURVE_CHART_HEIGHT = 120;

export class DeckCheckScene extends Phaser.Scene {
  #deck!: Deck;
  #returnTo!: { readonly scene: SceneKey; readonly data?: object };
  #onStartGame: (() => void) | undefined;
  #activeTab: DeckCheckTab = "curve";
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #list: McVirtualList | null = null;
  #listScroll = new ListScroll();
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.deckCheck);
  }

  create(data: DeckCheckSceneData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#deck = data.deck;
    this.#returnTo = data.returnTo ?? { scene: SCENES.decks };
    this.#onStartGame = data.onStartGame;
    this.#activeTab = "curve";
    this.#listScroll = new ListScroll();

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#tabs?.destroy();
      this.#tabs = null;
      this.#list?.destroy();
      this.#list = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
    });
    this.#rebuild();
  }

  #setTab(tab: DeckCheckTab): void {
    if (tab === this.#activeTab) return;
    this.#activeTab = tab;
    this.#listScroll.reset();
    this.#rebuild();
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    this.#tabs?.destroy();
    this.#tabs = null;
    // The list only exists on the Cards tab; recreated fresh every rebuild like every other non-DOM widget
    // (`ui/virtual-list.ts`'s own doc comment) — only its scroll position (`#listScroll`) survives.
    this.#list?.destroy();
    this.#list = null;
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const layout = deckCheckLayout({ width, height });
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", { spacing: 6, radius: 1, alpha: 0.1 });

    const stats = deckStatsOf(this.#deck, POOL_CARDS);
    const groups = deckListGroupsOf(this.#deck, POOL_CARDS);

    // Header: Back, and the deck's own name and count.
    const backRect: Rect = { x: layout.header.x, y: layout.header.y, width: 90, height: layout.header.height };
    const goBack = (): void => {
      this.scene.start(this.#returnTo.scene, this.#returnTo.data);
    };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "◂ Back", type: typeRole.rowTitle, rect: backRect, onClick: goBack }));
    this.#stops.set("back", { rect: backRect, activate: goBack });
    const title = this.add.text(
      backRect.x + backRect.width + 12,
      layout.header.y + layout.header.height / 2,
      `${this.#deck.name} · ${stats.totalCards}`,
      textStyle(typeRole.barTitle, surface.ink.hex),
    );
    title.setOrigin(0, 0.5).setLetterSpacing(typeRole.barTitle.letterSpacing);
    fitText(title, layout.header.width - backRect.width - 24);

    // The Curve / Cards / Aspect tab strip.
    this.#tabs = new McTabs(this, {
      rect: layout.tabs,
      tabs: [
        { id: "curve", label: "Curve" },
        { id: "cards", label: "Cards" },
        { id: "aspect", label: "Aspect" },
      ],
      activeId: this.#activeTab,
      onSelect: (id) => this.#setTab(id as DeckCheckTab),
    });
    this.#stops.set("tab:curve", { rect: { ...layout.tabs, width: layout.tabs.width / 3 }, activate: () => this.#setTab("curve") });
    this.#stops.set("tab:cards", { rect: { ...layout.tabs, x: layout.tabs.x + layout.tabs.width / 3, width: layout.tabs.width / 3 }, activate: () => this.#setTab("cards") });
    this.#stops.set("tab:aspect", { rect: { ...layout.tabs, x: layout.tabs.x + (2 * layout.tabs.width) / 3, width: layout.tabs.width / 3 }, activate: () => this.#setTab("aspect") });

    let cardIds: readonly string[] = [];
    if (this.#activeTab === "curve") this.#drawCurveTab(layout.content, stats);
    else if (this.#activeTab === "aspect") this.#drawAspectTab(layout.content, groups);
    else cardIds = this.#drawCardsTab(layout.content, groups);

    // Footer: Edit deck, Start game.
    const footerBg = this.add.graphics();
    paintPanel(footerBg, layout.footer, "onInk", "rest");
    const openEdit = (): void => {
      this.scene.start(SCENES.deckBuilder, { deck: this.#deck } satisfies DeckBuilderSceneData);
    };
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "Edit deck", type: typeRole.label, rect: layout.editDeck, onClick: openEdit }));
    this.#stops.set("edit-deck", { rect: layout.editDeck, activate: openEdit });

    const canStart = this.#onStartGame !== undefined;
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Start game ▸",
        type: typeRole.barTitle,
        rect: layout.startGame,
        enabled: canStart,
        ...(canStart ? {} : { reason: "Setup flow isn't built yet — coming with the title-menu rework (W2)." }),
        onClick: () => this.#onStartGame?.(),
      }),
    );
    this.#stops.set("start", { rect: layout.startGame, activate: () => this.#onStartGame?.() });

    this.#route?.set(deckCheckFocusOrder({ activeTab: this.#activeTab, cardIds }), this.#stops);
  }

  #drawCurveTab(rect: Rect, stats: ReturnType<typeof deckStatsOf>): void {
    const panel = this.add.graphics();
    const chartRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: CURVE_CHART_HEIGHT };
    paintPanel(panel, chartRect, "card", "rest");

    const avgText = stats.averageCost === null ? "no cost-bearing cards" : `avg ${stats.averageCost.toFixed(1)}`;
    label(this, chartRect.x + 12, chartRect.y + 10, `RESOURCE CURVE · ${avgText}`, typeRole.label, surface.ink.hex, ink.label);

    const bars = costCurveBars(stats);
    drawCostCurveBars(this, { x: chartRect.x + 12, y: chartRect.y + 34, width: chartRect.width - 24, height: chartRect.height - 34 - 6 }, bars);

    // Composition tiles, one per non-empty card type — `ui/deck-stats-widgets.ts`, shared with the builder's own
    // stats panel and W9's Decks & Collection stats pane.
    const tileTop = chartRect.y + chartRect.height + 12;
    drawCompositionTiles(this, { x: rect.x, y: tileTop, width: rect.width, height: rect.y + rect.height - tileTop }, compositionTileDefs(compositionTilesOf(stats)));
  }

  #drawAspectTab(rect: Rect, groups: ReturnType<typeof deckListGroupsOf>): void {
    label(this, rect.x, rect.y, "COMPOSITION BY ASPECT", typeRole.label, surface.ink.hex, ink.label);
    const tileDefs = groups.map((g) => ({ id: g.key, text: `${g.label} ${g.count}` }));
    drawCompositionTiles(this, { x: rect.x, y: rect.y + 16, width: rect.width, height: rect.height - 16 }, tileDefs);
  }

  /** Builds the Cards tab's flat row list (a header per non-empty group, then its cards) and draws it as a virtualized list. Returns the card ids, in row order, for the focus route. */
  #drawCardsTab(rect: Rect, groups: ReturnType<typeof deckListGroupsOf>): readonly string[] {
    const rows: CardsTabRow[] = [];
    for (const group of groups) {
      rows.push({ kind: "header", label: group.label, count: group.count });
      for (const entry of group.entries) rows.push({ kind: "card", entry });
    }

    if (rows.length === 0) {
      this.add.text(rect.x + 10, rect.y + 10, "This deck has no cards yet.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
      return [];
    }

    const renderRow = (index: number, rowRect: Rect): VirtualListRow => this.#renderCardsRow(rowRect, rows[index]!);
    this.#list = new McVirtualList(this, { rect, rowHeight: ROW_HEIGHT, count: rows.length, renderRow, scroll: this.#listScroll });
    const list = this.#list;
    rows.forEach((row, index) => {
      if (row.kind !== "card") return;
      const cardId = row.entry.cardId as string;
      this.#stops.set(`card:${cardId}`, {
        rect: () => list.rectFor(index),
        activate: () => this.#inspect(row.entry),
        inspect: () => this.#inspect(row.entry),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });
    return rows.filter((row): row is Extract<CardsTabRow, { kind: "card" }> => row.kind === "card").map((row) => row.entry.cardId as string);
  }

  #renderCardsRow(rect: Rect, row: CardsTabRow): VirtualListRow {
    const inner: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
    if (row.kind === "header") {
      const text = label(this, inner.x, inner.y + inner.height / 2, `${row.label} · ${row.count}`, typeRole.label, surface.ink.hex, ink.label);
      text.setOrigin(0, 0.5);
      return { objects: [text] };
    }

    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    paintPanel(g, inner, "card", "rest");
    objects.push(g);
    const name = this.add.text(inner.x + 10, inner.y + inner.height / 2, row.entry.name, textStyle(typeRole.body, surface.ink.hex));
    name.setOrigin(0, 0.5);
    fitText(name, inner.width - 60);
    objects.push(name);
    const qty = label(this, inner.x + inner.width - 14, inner.y + inner.height / 2, `×${row.entry.quantity}`, typeRole.rowTitle, surface.ink.hex, ink.secondary);
    qty.setOrigin(1, 0.5);
    objects.push(qty);
    return { objects };
  }

  #inspect(entry: DeckListEntry): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: entry.cardId, face: { kind: "front" } } });
  }
}

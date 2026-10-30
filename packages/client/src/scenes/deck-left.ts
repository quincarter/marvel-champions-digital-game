/**
 * "Cards left": the cards still unseen in your deck or the encounter deck, with a count for each and never in order
 * (`view/deck-left-model.ts`). Opened from a tap on either deck on the Board (`scenes/board/piles.ts`, `zones.ts`) or
 * R3 / the deck key; a hold on the encounter deck still opens Inspect. Each setting hides what it feeds.
 *
 * Read only: it sends no command. A deck card is facedown to the table's own hover and Inspect, so both go by printed
 * card here, the way a modular set's sheet does. Escape, B and Close all close it.
 */
import Phaser from "phaser";
import type { CardId } from "@mc/content";
import type { PlayerId } from "@mc/engine";
import { cardArt, drawArt } from "../art/card-art.js";
import { POOL_DEPS } from "../content/pool.js";
import { appSession } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import { ink, surface, typeRole } from "../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { bindHoldTarget } from "../ui/hold-target.js";
import { addPressShield } from "../ui/press-shield.js";
import { onTap } from "../ui/tap.js";
import { textStyle } from "../ui/theme.js";
import { OverlayMotion } from "../ui/transitions.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McButton, fitText, paintPanel } from "../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { blindRevealOf } from "../view/civil-war-blind.js";
import { deckLeftLayout, type DeckLeftLayout } from "../view/deck-left-layout.js";
import {
  DECK_LEFT_TAB_LABELS,
  deckLeftTabsOf,
  deckLeftViewOf,
  type DeckLeftRow,
  type DeckLeftTab,
  type DeckLeftView,
} from "../view/deck-left-model.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { pileCell, pileTitle } from "../view/pile-view-layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { InspectData } from "./inspect.js";
import { SCENES } from "./keys.js";

export interface DeckLeftData {
  /** The scene that asked: its pointer and keys are off while this is up. */
  readonly from?: string;
  readonly tab: DeckLeftTab;
  /** Whose deck the hero tab reads: the seat the table is showing. */
  readonly perspectiveId: PlayerId;
}

export class DeckLeftOverlay extends Phaser.Scene {
  #data!: DeckLeftData;
  #tab: DeckLeftTab = "hero";
  #view: DeckLeftView | null = null;
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #scroll = new ListScroll();
  #motion = new OverlayMotion();
  #hover: HoverPreview | null = null;
  #artOff: (() => void) | null = null;
  #layout: DeckLeftLayout | null = null;
  #hints!: GlyphHints;
  #stops: ReadonlyMap<string, FocusStop> = new Map();
  #focusKey: string | null = null;
  #legendRect: Rect | null = null;

  constructor() {
    super(SCENES.deckLeft);
  }

  /** The legend follows the ring as the list scrolls (right stick, LB / RB, drag). */
  override update(): void {
    if (this.#focusKey === null) return;
    const stop = this.#stops.get(this.#focusKey);
    if (!stop) return;
    const rect = typeof stop.rect === "function" ? stop.rect() : stop.rect;
    const last = this.#legendRect;
    if (!last || last.x !== rect.x || last.y !== rect.y) this.#legend();
  }

  create(data: DeckLeftData): void {
    this.#data = data;
    this.#tab = data.tab;
    this.#view = null;
    this.#scroll = new ListScroll();
    this.#motion = new OverlayMotion();
    const from = this.scene.get(data.from ?? SCENES.board);
    if (from) {
      from.input.enabled = false;
      if (from.input.keyboard) from.input.keyboard.enabled = false;
    }
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#focusKey = null;
    this.#hints = new GlyphHints(this, () => [...this.#visibleCards().values()]);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#close(),
      reachAcross: true,
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#list?.scrollToStart() : this.#list?.scrollToEnd()),
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
      onExpand: () => this.#stepTab(),
      onFocusChange: (key) => {
        this.#focusKey = key;
        this.#legend();
      },
    });
    this.#artOff = cardArt(this).onArrived(() => this.#draw());
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#visibleCards(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#artOff?.();
      this.#artOff = null;
      this.#hints.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.#list?.destroy();
      this.#list = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) {
        from.input.enabled = true;
        if (from.input.keyboard) from.input.keyboard.enabled = true;
      }
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #tabs(): readonly DeckLeftTab[] {
    return deckLeftTabsOf(appSession().settings);
  }

  /** A teammate's deck, while the table is peeking at their seat, is not "Your deck". */
  #tabLabel(tab: DeckLeftTab): string {
    const peeking = tab === "hero" && appSession().store.state.perspectiveId !== this.#data.perspectiveId;
    return peeking ? "Teammate's deck" : DECK_LEFT_TAB_LABELS[tab];
  }

  #show(tab: DeckLeftTab): void {
    if (tab === this.#tab) return;
    this.#tab = tab;
    this.#scroll = new ListScroll();
    this.#draw();
  }

  /** R3 / the expand key: the other deck. */
  #stepTab(): void {
    const tabs = this.#tabs();
    if (tabs.length < 2) return;
    this.#show(tabs[(tabs.indexOf(this.#tab) + 1) % tabs.length]!);
  }

  #cell(index: number, list: McVirtualList, layout: DeckLeftLayout): Rect {
    const { columns } = layout.geometry;
    return pileCell(layout.geometry, list.rectFor(Math.floor(index / columns)), index % columns).art;
  }

  /** The printed cards on screen now, scroll applied and clipped to the list's window; a hidden card has no hover. */
  #visibleCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const list = this.#list;
    const layout = this.#layout;
    if (!list || !layout) return found;
    this.#view?.rows.forEach((row, index) => {
      if (!row.face) return;
      const shown = clipHoverRect(this.#cell(index, list, layout), layout.list);
      if (shown)
        found.set(hoverSlotOf(row.face.cardId, `left${index}`), {
          ...shown,
          cardId: row.face.cardId,
          face: row.face.face,
          through: true,
        });
    });
    return found;
  }

  /** The Select / Inspect / Back strip over the card in focus (pad and keyboard only); gone with focus off a card. */
  #legend(): void {
    const stop = this.#focusKey?.startsWith("card:") ? this.#stops.get(this.#focusKey) : undefined;
    const { width, height } = this.scale.gameSize;
    const rect = stop ? (typeof stop.rect === "function" ? stop.rect() : stop.rect) : null;
    const view = this.#layout?.list;
    const shown = rect && view && rect.y + rect.height > view.y && rect.y < view.y + view.height ? rect : null;
    this.#legendRect = rect;
    this.#hints.legend(shown, { x: 0, y: 0, width, height }, "back", "Inspect");
  }

  #inspect(row: DeckLeftRow): void {
    if (!row.face) return;
    this.scene.launch(SCENES.inspect, {
      card: { cardId: row.face.cardId as CardId, face: row.face.face },
    } satisfies InspectData);
    this.scene.bringToTop(SCENES.inspect);
  }

  #viewNow(): DeckLeftView | null {
    const { store, settings } = appSession();
    const { game, config } = store.state;
    if (!game) return null;
    return deckLeftViewOf(
      game,
      POOL_DEPS,
      this.#tab,
      this.#data.perspectiveId,
      {
        list: this.#tab === "hero" ? settings.deckCountsHero : settings.deckCountsEncounter,
        boost: settings.deckBoostAverage,
      },
      blindRevealOf(config, game),
    );
  }

  #draw(): void {
    this.#list?.destroy();
    this.#list = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    this.#hints.reset();
    // A redraw for arriving art or a resize reads the same cards: only a change of tab reads the game again.
    const view = this.#view?.tab === this.#tab ? this.#view : this.#viewNow();
    this.#view = view;
    const { width, height } = this.scale.gameSize;
    const rows = view?.rows ?? [];
    const tabs = this.#tabs();
    const scale = cardSizeFactor(appSession().settings.cardSize);
    const summaryText = (view?.summary ?? []).join("\n");
    const summaryWidth = deckLeftLayout(width, height, rows.length, tabs.length, 0, scale).summary.width;
    const summaryStyle = {
      ...textStyle(typeRole.body, surface.ink.hex, ink.body),
      wordWrap: { width: summaryWidth, useAdvancedWrap: true },
    };
    const probe = this.add.text(0, 0, summaryText, summaryStyle);
    const summaryHeight = summaryText === "" ? 0 : Math.ceil(probe.height);
    probe.destroy();
    const layout = deckLeftLayout(width, height, rows.length, tabs.length, summaryHeight, scale);
    this.#layout = layout;
    const { panel, bar, close, title, list: listRect, geometry, summary } = layout;

    const shield = addPressShield(this, { x: 0, y: 0, width, height });
    onTap(shield, () => this.#close(), "deck-left:scrim");
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.82).fillRect(0, 0, width, height);

    const ground = this.add.graphics();
    ground.fillStyle(surface.paper.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    ground.fillStyle(surface.ink.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(panel.x, panel.y, panel.width, panel.height);
    // The panel takes a press that lands on it, so only the scrim around it closes.
    this.add.zone(panel.x, panel.y, panel.width, panel.height).setOrigin(0, 0).setInteractive();
    const heading = this.add
      .text(
        title.x,
        title.y + title.height / 2,
        pileTitle(this.#tabLabel(this.#tab), view?.inDeck ?? 0),
        textStyle(typeRole.barTitle, surface.paper.hex),
      )
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    fitText(heading, title.width, 12);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Close",
        type: { ...typeRole.label, size: 13 },
        rect: close,
        onClick: () => this.#close(),
      }),
    );
    this.#hints.button(this.#buttons.at(-1)!, ["cancel"], "paper");
    stops.set("close", { rect: close, activate: () => this.#close() });
    order.push("close");

    layout.tabs.forEach((rect, index) => {
      const tab = tabs[index]!;
      const open = (): void => this.#show(tab);
      const button = new McButton(this, {
        kind: tab === this.#tab ? "primary" : "secondary",
        label: this.#tabLabel(tab),
        type: { ...typeRole.label, size: 13 },
        rect,
        onClick: open,
      });
      this.#buttons.push(button);
      if (tab !== this.#tab) this.#hints.button(button, ["expand"], "paper");
      stops.set(`tab:${tab}`, { rect, activate: open });
      order.push(`tab:${tab}`);
    });

    if (summaryText !== "") this.add.text(summary.x, summary.y, summaryText, summaryStyle);
    if (view && view.rows.length === 0 && view.boost === null) {
      const empty = textStyle(typeRole.body, surface.ink.hex, ink.body);
      this.add.text(listRect.x, listRect.y, "No cards left in this deck.", empty);
    }

    const list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: geometry.cellHeight,
      count: geometry.rows,
      renderRow: (rowIndex, rowRect) => this.#renderRow(rowRect, rowIndex, layout),
      scroll: this.#scroll,
      background: false,
    });
    this.#list = list;
    rows.forEach((row, index) => {
      if (!row.face) return;
      const rowIndex = Math.floor(index / geometry.columns);
      const key = `card:${index}`;
      stops.set(key, {
        rect: () => this.#cell(index, list, layout),
        activate: () => this.#inspect(row),
        inspect: () => this.#inspect(row),
        ensureVisible: () => list.scrollIntoView(rowIndex),
      });
      order.push(key);
    });
    this.#stops = stops;
    this.#route?.set(order, stops);
    this.#legend();
    this.#hover?.onDraw();
    this.#motion.enter(this, { scrim: [scrim], panels: [ground, heading] });

    if (import.meta.env.DEV) {
      (window as unknown as { __mcDeckLeftDebug?: unknown }).__mcDeckLeftDebug = {
        tab: () => this.#tab,
        close: () => close,
        tabRects: () => layout.tabs,
        list: () => listRect,
        summary: () => this.#view?.summary ?? [],
        rows: () => this.#view?.rows.map((row) => ({ name: row.name, count: row.count })) ?? [],
        cards: () => [...this.#visibleCards().values()],
      };
    }
  }

  #renderRow(rowRect: Rect, rowIndex: number, layout: DeckLeftLayout): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const rows = this.#view?.rows ?? [];
    const { geometry } = layout;
    const first = rowIndex * geometry.columns;
    const inRow = Math.min(geometry.columns, rows.length - first);
    for (let column = 0; column < inRow; column++) {
      const row = rows[first + column]!;
      const { art, caption } = pileCell(geometry, rowRect, column);
      const g = this.add.graphics();
      const frame: Rect = { x: art.x - 2, y: art.y - 2, width: art.width + 4, height: art.height + caption.height };
      paintPanel(g, frame, "card", "rest");
      g.fillStyle(surface.parchment.hex, 1).fillRect(art.x, art.y, art.width, art.height);
      objects.push(g);
      const shown = drawArt(this, cardArt(this).request(this, row.art), art);
      if (shown) objects.push(shown);

      // The count rides on an ink chip over the art's corner, where a small cell still reads it.
      const count = this.add.text(0, 0, `×${row.count}`, textStyle(typeRole.stat, surface.paper.hex)).setOrigin(1);
      const chipWidth = Math.ceil(count.width) + 12;
      const chipHeight = Math.ceil(count.height) + 4;
      const chip = this.add.graphics();
      chip
        .fillStyle(surface.ink.hex, 0.88)
        .fillRect(art.x + art.width - chipWidth, art.y + art.height - chipHeight, chipWidth, chipHeight);
      count.setPosition(art.x + art.width - 6, art.y + art.height - 2);
      count.setDepth(1);
      objects.push(chip, count);

      const name = this.add
        .text(caption.x + caption.width / 2, caption.y + 4, row.name, {
          ...textStyle(typeRole.label, surface.ink.hex, ink.body),
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setWordWrapWidth(caption.width - 8, true);
      objects.push(name);
      const zone = this.add
        .zone(art.x, art.y, art.width, art.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: row.face !== null });
      bindHoldTarget(this, zone, {
        key: `deck-left:${row.key}`,
        onTap: () => this.#inspect(row),
        onInspect: () => this.#inspect(row),
      });
      objects.push(zone);
    }
    return { objects };
  }
}

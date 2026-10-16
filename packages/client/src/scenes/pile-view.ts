/**
 * A pile fanned out: every card in your discard pile (or the encounter discard) at once, most recent first, so a
 * player can see what has gone down without stepping through Inspect one card at a time. Opened from a tap on the
 * pile on the Board (`scenes/board/piles.ts`, `zones.ts`); a hold or right-click on the pile still opens Inspect.
 *
 * Read only: it sends no command. The card scans scroll when the pile is taller than the screen
 * (`view/pile-view-layout.ts` holds the geometry, which is the card pool's grid, so the Card size setting applies).
 * A tap on a card opens Inspect on it with the whole pile as its siblings, so the arrows step through the rest.
 * Escape, B and Close all close it.
 */
import Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import { cardOf } from "@mc/engine";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { appSession } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import { ink, surface, typeRole } from "../tokens.js";
import { HoverPreview, isMousePointer, resetHoverCards } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { bindHoldTarget } from "../ui/hold-target.js";
import { addPressShield } from "../ui/press-shield.js";
import { textStyle } from "../ui/theme.js";
import { OverlayMotion } from "../ui/transitions.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McButton, fitText, paintPanel } from "../ui/widgets.js";
import { faceOf } from "../view/board-model.js";
import { villainHoverArea } from "../view/card-hover.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import { pileCell, pileTitle, pileViewLayout, type PileViewLayout } from "../view/pile-view-layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { CHROME_SCENES, SCENES } from "./keys.js";

export interface PileViewData {
  /** The scene that asked: its pointer and keys are off while this is up. */
  readonly from?: string;
  /** "Discard pile", "Encounter discard". */
  readonly name: string;
  /** The pile's cards, most recent first. */
  readonly ids: readonly InstanceId[];
}

export class PileViewOverlay extends Phaser.Scene {
  #data: PileViewData = { name: "Discard pile", ids: [] };
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #scroll = new ListScroll();
  #motion = new OverlayMotion();
  #hover: HoverPreview | null = null;
  #artOff: (() => void) | null = null;
  #layout: PileViewLayout | null = null;

  constructor() {
    super(SCENES.pileView);
  }

  create(data: PileViewData): void {
    this.#data = data;
    this.#scroll = new ListScroll();
    this.#motion = new OverlayMotion();
    const from = this.scene.get(data.from ?? SCENES.board);
    if (from) {
      from.input.enabled = false;
      if (from.input.keyboard) from.input.keyboard.enabled = false;
    }
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#close(),
    });
    this.#artOff = cardArt(this).onArrived(() => this.#draw());
    // The desktop hover popover over the pile's own cards, as on the table; their rects follow the scroll.
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cards: () => this.#visibleCards(),
      area: (pointer) => {
        const { width, height } = this.scale.gameSize;
        const overlays = Object.values(SCENES).filter(
          (key) =>
            key !== SCENES.board &&
            key !== SCENES.music &&
            !CHROME_SCENES.has(key) &&
            key !== SCENES.pileView &&
            key !== SCENES.choice &&
            this.scene.isActive(key),
        );
        return villainHoverArea({
          formFactor: formFactorFor(width, height),
          mouse: isMousePointer(pointer),
          scale: appSession().settings.cardHoverScale,
          overlays,
          viewport: { x: 0, y: 0, width, height },
        });
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#artOff?.();
      this.#artOff = null;
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

  /** The cards on screen right now, scroll applied; one scrolled out of the list's window has no hover. */
  #visibleCards(): ReadonlyMap<InstanceId, Rect> {
    const shown = new Map<InstanceId, Rect>();
    const list = this.#list;
    const layout = this.#layout;
    if (!list || !layout) return shown;
    const view = layout.list;
    this.#data.ids.forEach((id, index) => {
      const row = Math.floor(index / layout.geometry.columns);
      const rect = pileCell(layout.geometry, list.rectFor(row), index % layout.geometry.columns).art;
      if (rect.y + rect.height > view.y && rect.y < view.y + view.height) shown.set(id, rect);
    });
    return shown;
  }

  #inspect(id: InstanceId): void {
    this.scene.launch(SCENES.inspect, { instanceId: id, siblings: this.#data.ids });
    this.scene.bringToTop(SCENES.inspect);
  }

  #draw(): void {
    this.#list?.destroy();
    this.#list = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height } = this.scale.gameSize;
    const { ids, name } = this.#data;
    const layout = pileViewLayout(width, height, ids.length, cardSizeFactor(appSession().settings.cardSize));
    this.#layout = layout;
    const { panel, bar, close, title, list: listRect, geometry } = layout;

    const shield = addPressShield(this, { x: 0, y: 0, width, height });
    shield.on("pointerup", () => this.#close());
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
        pileTitle(name, ids.length),
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
    stops.set("close", { rect: close, activate: () => this.#close() });
    order.push("close");

    const list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: geometry.cellHeight,
      count: geometry.rows,
      renderRow: (rowIndex, rowRect) => this.#renderRow(rowRect, rowIndex, layout),
      scroll: this.#scroll,
      background: false,
    });
    this.#list = list;
    ids.forEach((id, index) => {
      const row = Math.floor(index / geometry.columns);
      const column = index % geometry.columns;
      const key = `card:${index}`;
      stops.set(key, {
        rect: () => pileCell(geometry, list.rectFor(row), column).art,
        activate: () => this.#inspect(id),
        inspect: () => this.#inspect(id),
        ensureVisible: () => list.scrollIntoView(row),
      });
      order.push(key);
    });
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
    this.#motion.enter(this, { scrim: [scrim], panels: [ground, heading] });

    if (import.meta.env.DEV) {
      (window as unknown as { __mcPileViewDebug?: unknown }).__mcPileViewDebug = {
        panel: () => panel,
        close: () => close,
        list: () => listRect,
        count: () => ids.length,
        cards: () => [...this.#visibleCards()].map(([id, rect]) => ({ id, rect })),
        scrollY: () => this.#scroll.offsetPx,
      };
    }
  }

  #renderRow(rowRect: Rect, rowIndex: number, layout: PileViewLayout): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const game = appSession().store.state.game;
    const { geometry } = layout;
    const first = rowIndex * geometry.columns;
    const inRow = Math.min(geometry.columns, this.#data.ids.length - first);
    for (let column = 0; column < inRow; column++) {
      const id = this.#data.ids[first + column]!;
      const { art, caption } = pileCell(geometry, rowRect, column);
      const record = game ? cardOf(game, id) : null;
      const g = this.add.graphics();
      const frame: Rect = { x: art.x - 2, y: art.y - 2, width: art.width + 4, height: art.height + caption.height };
      paintPanel(g, frame, "card", "rest");
      g.fillStyle(surface.parchment.hex, 1).fillRect(art.x, art.y, art.width, art.height);
      objects.push(g);
      const shown =
        record && game ? drawArt(this, cardArt(this).request(this, artFor(record, faceOf(game, id))), art) : null;
      if (shown) objects.push(shown);
      const name = this.add
        .text(caption.x + caption.width / 2, caption.y + 4, record?.name ?? "", {
          ...textStyle(typeRole.label, surface.ink.hex, ink.body),
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setWordWrapWidth(caption.width - 8, true);
      objects.push(name);
      const zone = this.add
        .zone(art.x, art.y, art.width, art.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      bindHoldTarget(this, zone, {
        key: `pile:${id as string}`,
        onTap: () => this.#inspect(id),
        onInspect: () => this.#inspect(id),
      });
      objects.push(zone);
    }
    return { objects };
  }
}

/**
 * The pack-shelf roster (docs/phase4-screen-gaps.md §3 W2b, the owner's
 * 2026-09-18 decision superseding this workstream's own flat-grid brief):
 * one vertically-scrolling column of shelves — a header plus one
 * horizontally-scrolling row of entity cards per pack — used identically by
 * Scenario select and Take your seats. Modeled on `ui/virtual-list.ts`
 * (recycle-by-index, a caller-owned `ListScroll` so position survives a
 * scene rebuild, scene-level pointer listeners rather than a `Zone` over the
 * cards so a card's own button still gets its click) but virtualized on
 * *two* axes: only the shelves whose vertical span is on screen are live,
 * and within a live shelf only the cards whose horizontal span is on screen
 * are live.
 *
 * **Vertical scroll** is one `ListScroll` over "rows" that are whole shelves
 * (`shelfStep` tall each) — the same abstraction `ListScroll` already uses
 * for uniform-height rows, just applied to a bigger uniform unit.
 * **Horizontal scroll** is one `ListScroll` per shelf, keyed by shelf id and
 * owned by the caller (`view/shelf-scroll-cache.ts`'s module-level cache,
 * not a scene field — a scene is destroyed and recreated by
 * `scene.start`/`scene.stop` on every trip to Deck check and back, and the
 * brief asks for shelf scroll position to survive that).
 *
 * **Drag axis-locking** uses `view/drag-gesture.ts`'s `AxisDragGesture`: a
 * gesture starting inside the roster locks to whichever axis its first few
 * pixels favour, so a slightly diagonal swipe scrolls one axis, not both.
 * Momentum coasts along whichever axis was locked.
 *
 * **Chevrons** are ordinary `McButton`s at each end of a shelf's card row,
 * drawn only when that shelf's content overflows its own width — a mouse
 * user has no drag affordance to discover otherwise. They share this
 * widget's own `clip`/`suppressClick` wiring so a drag release over a
 * chevron doesn't also fire it.
 */
import Phaser from "phaser";
import { surface } from "../tokens.js";
import type { Shelf } from "../view/roster-shelves.js";
import { AxisDragGesture, Momentum, pointInRect } from "../view/drag-gesture.js";
import { ListScroll } from "../view/list-scroll.js";
import type { Rect } from "../view/layout.js";
import { McButton, paintPanel } from "./widgets.js";
import { setMask, clearMask } from "./rex.js";
import type { VirtualListRow } from "./virtual-list.js";

export interface ShelfRosterMetrics {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly cardGap: number;
  readonly headerHeight: number;
  readonly headerToCardsGap: number;
  readonly shelfGap: number;
}

export interface ShelfRosterOptions<T> {
  readonly rect: Rect;
  readonly shelves: readonly Shelf<T>[];
  readonly metrics: ShelfRosterMetrics;
  /** Draws shelf `shelf`'s header (title, rule, count) at `rect` — no chevrons, those are this widget's own. */
  readonly renderHeader: (shelf: Shelf<T>, rect: Rect) => VirtualListRow;
  /** Draws one card at `rect`. */
  readonly renderCard: (item: T, shelfIndex: number, itemIndex: number, rect: Rect) => VirtualListRow;
  readonly onCardActivate: (item: T, shelfIndex: number, itemIndex: number) => void;
  readonly verticalScroll: ListScroll;
  /** Persistent per-shelf horizontal scroll, owned by the caller (`view/shelf-scroll-cache.ts`) so it survives this widget being destroyed and recreated. */
  readonly horizontalScrollFor: (shelfId: string) => ListScroll;
}

interface LiveShelf {
  readonly index: number;
  readonly shelf: Shelf<unknown>;
  readonly headerRow: VirtualListRow;
  readonly cardRows: Map<number, VirtualListRow>;
  readonly chevronLeft: McButton | null;
  readonly chevronRight: McButton | null;
}

const CHEVRON_WIDTH = 28;

export class McShelfRoster<T> {
  readonly #scene: Phaser.Scene;
  readonly #root: Phaser.GameObjects.Container;
  readonly #background: Phaser.GameObjects.Graphics;
  readonly #layer: Phaser.GameObjects.Container;
  readonly #maskShape: Phaser.GameObjects.Graphics;
  readonly #drag = new AxisDragGesture();
  readonly #momentum = new Momentum();
  #dragShelfId: string | null = null;
  #rect: Rect;
  #shelves: readonly Shelf<T>[];
  readonly #metrics: ShelfRosterMetrics;
  readonly #renderHeader: (shelf: Shelf<T>, rect: Rect) => VirtualListRow;
  readonly #renderCard: (item: T, shelfIndex: number, itemIndex: number, rect: Rect) => VirtualListRow;
  readonly #onCardActivate: (item: T, shelfIndex: number, itemIndex: number) => void;
  readonly #verticalScroll: ListScroll;
  readonly #horizontalScrollFor: (shelfId: string) => ListScroll;
  readonly #live = new Map<number, LiveShelf>();

  constructor(scene: Phaser.Scene, options: ShelfRosterOptions<T>) {
    this.#scene = scene;
    this.#rect = options.rect;
    this.#shelves = options.shelves;
    this.#metrics = options.metrics;
    this.#renderHeader = options.renderHeader;
    this.#renderCard = options.renderCard;
    this.#onCardActivate = options.onCardActivate;
    this.#verticalScroll = options.verticalScroll;
    this.#horizontalScrollFor = options.horizontalScrollFor;

    this.#background = scene.add.graphics();
    this.#layer = scene.add.container(0, 0);
    this.#maskShape = scene.make.graphics({}, false);
    setMask(this.#layer, this.#maskShape, "world");
    this.#root = scene.add.container(0, 0, [this.#background, this.#layer]);

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());

    this.#layoutMask();
    this.#redraw();
  }

  get rect(): Rect {
    return this.#rect;
  }

  /** True while a drag on this roster has moved past the tap threshold and hasn't been released — what a chevron (or any future card-own button) should pass as `suppressClick`. */
  get isDragSuppressingClick(): boolean {
    return this.#drag.isDragging && this.#drag.axis !== null;
  }

  #shelfStep(): number {
    const m = this.#metrics;
    return m.headerHeight + m.headerToCardsGap + m.cardHeight + m.shelfGap;
  }

  layout(rect: Rect): void {
    this.#rect = rect;
    this.#layoutMask();
    this.#verticalScroll.clamp(this.#shelves.length, this.#shelfStep(), rect.height);
    this.#redraw();
  }

  update(shelves: readonly Shelf<T>[]): void {
    this.#shelves = shelves;
    this.#verticalScroll.clamp(shelves.length, this.#shelfStep(), this.#rect.height);
    for (const shelf of shelves) {
      const hs = this.#horizontalScrollFor(shelf.id);
      hs.clamp(shelf.items.length, this.#metrics.cardWidth + this.#metrics.cardGap, this.#innerWidth());
    }
    this.#redraw();
  }

  /** Forces every currently-visible shelf/card to redraw via the caller's own render functions — used when art or other async content arrives, so the widget doesn't need its own art-loading knowledge. */
  refreshVisible(): void {
    this.#redraw();
  }

  /** Where shelf `shelfIndex`, card `itemIndex` sits right now — used for focus rings and `ensureVisible`. */
  rectFor(shelfIndex: number, itemIndex: number): Rect {
    const m = this.#metrics;
    const shelfTop = this.#rect.y + shelfIndex * this.#shelfStep() - this.#verticalScroll.offsetPx;
    const shelf = this.#shelves[shelfIndex];
    const hOffset = shelf ? this.#horizontalScrollFor(shelf.id).offsetPx : 0;
    const x = this.#rect.x + itemIndex * (m.cardWidth + m.cardGap) - hOffset;
    const y = shelfTop + m.headerHeight + m.headerToCardsGap;
    return { x, y, width: m.cardWidth, height: m.cardHeight };
  }

  /** Page Up/Down over the shelves themselves (a "page" is a shelf, matching `moveShelfFocus`'s own `pageUp`/`pageDown` — one shelf is already this widget's uniform scroll unit). Parity with `McVirtualList.scrollByPage`, for `FocusRoute.onPage`. */
  scrollByPage(direction: 1 | -1): void {
    if (this.#verticalScroll.scrollByPage(direction, this.#shelves.length, this.#shelfStep(), this.#rect.height)) this.#redraw();
  }

  /** Parity with `McVirtualList.scrollToStart`, for `FocusRoute.onHomeEnd`. */
  scrollToStart(): void {
    if (this.#verticalScroll.scrollToStart(this.#shelves.length, this.#shelfStep(), this.#rect.height)) this.#redraw();
  }

  /** Parity with `McVirtualList.scrollToEnd`, for `FocusRoute.onHomeEnd`. */
  scrollToEnd(): void {
    if (this.#verticalScroll.scrollToEnd(this.#shelves.length, this.#shelfStep(), this.#rect.height)) this.#redraw();
  }

  /** Scrolls both axes the minimum distance so the given card is fully on screen. */
  scrollIntoView(shelfIndex: number, itemIndex: number): void {
    const step = this.#shelfStep();
    if (this.#verticalScroll.scrollIntoView(shelfIndex, this.#shelves.length, step, this.#rect.height)) this.#redraw();
    const shelf = this.#shelves[shelfIndex];
    if (!shelf) return;
    const hs = this.#horizontalScrollFor(shelf.id);
    const cardStep = this.#metrics.cardWidth + this.#metrics.cardGap;
    if (hs.scrollIntoView(itemIndex, shelf.items.length, cardStep, this.#innerWidth())) this.#redraw();
  }

  destroy(): void {
    this.#scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    this.#scene.events.off(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    this.#destroyLive();
    clearMask(this.#layer);
    this.#maskShape.destroy();
    this.#root.destroy(true);
  }

  #innerWidth(): number {
    return this.#rect.width - CHEVRON_WIDTH * 2;
  }

  #layoutMask(): void {
    this.#maskShape.clear().fillStyle(0xffffff).fillRect(this.#rect.x, this.#rect.y, this.#rect.width, this.#rect.height);
    this.#background.clear();
    paintPanel(this.#background, this.#rect, "rail", "rest");
  }

  #destroyLive(): void {
    for (const live of this.#live.values()) {
      for (const o of live.headerRow.objects) o.destroy();
      for (const row of live.cardRows.values()) for (const o of row.objects) o.destroy();
      live.chevronLeft?.destroy();
      live.chevronRight?.destroy();
    }
    this.#live.clear();
  }

  #redraw(): void {
    this.#destroyLive();
    if (this.#shelves.length === 0) return;
    const step = this.#shelfStep();
    const window = this.#verticalScroll.windowFor(this.#shelves.length, step, this.#rect.height);
    const m = this.#metrics;
    const innerWidth = this.#innerWidth();

    for (let shelfIndex = window.start; shelfIndex < window.end; shelfIndex++) {
      const shelf = this.#shelves[shelfIndex]!;
      const shelfTop = this.#rect.y + shelfIndex * step - this.#verticalScroll.offsetPx;
      const headerRect: Rect = { x: this.#rect.x, y: shelfTop, width: this.#rect.width, height: m.headerHeight };
      const headerRow = this.#renderHeader(shelf, headerRect);
      this.#layer.add(headerRow.objects as Phaser.GameObjects.GameObject[]);

      const hs = this.#horizontalScrollFor(shelf.id);
      hs.clamp(shelf.items.length, m.cardWidth + m.cardGap, innerWidth);
      const hWindow = hs.windowFor(shelf.items.length, m.cardWidth + m.cardGap, innerWidth);
      const rowY = shelfTop + m.headerHeight + m.headerToCardsGap;
      const cardRows = new Map<number, VirtualListRow>();
      for (let itemIndex = hWindow.start; itemIndex < hWindow.end; itemIndex++) {
        const x = this.#rect.x + CHEVRON_WIDTH + itemIndex * (m.cardWidth + m.cardGap) - hs.offsetPx;
        const cardRect: Rect = { x, y: rowY, width: m.cardWidth, height: m.cardHeight };
        const row = this.#renderCard(shelf.items[itemIndex]!, shelfIndex, itemIndex, cardRect);
        this.#layer.add(row.objects as Phaser.GameObjects.GameObject[]);
        cardRows.set(itemIndex, row);
      }

      const contentWidth = shelf.items.length * (m.cardWidth + m.cardGap) - m.cardGap;
      const overflow = contentWidth > innerWidth;
      const clip = (): Rect => this.#rect;
      const suppressClick = (): boolean => this.isDragSuppressingClick;
      // Reparented into `#layer` (the masked container every card/header row already lives in), not left on the
      // scene root the way a bare `new McButton(this.#scene, ...)` defaults to: a shelf only partly inside the
      // vertical scroll window (`windowFor` includes a partially-visible row so scrolling reads smoothly) still
      // built a chevron at its own true, un-clipped position, which drew straight through whatever sits below the
      // roster's own rect — a "quiet"/`unavailable` chevron is the system's *dashed*-border state, so a
      // half-visible shelf's own disabled left chevron rendered as a stray dashed box bleeding into the panel
      // underneath (2026-09-18 fidelity pass: read at first as the roster overlapping the stat strip below it,
      // but no *card* ever left its clip — only this un-masked control did).
      const chevronLeft = overflow
        ? new McButton(this.#scene, {
            kind: "quiet",
            label: "‹",
            type: { family: "Public Sans", size: 16, weight: 800, lineHeight: 1, letterSpacing: 0, uppercase: false },
            rect: { x: this.#rect.x, y: rowY, width: CHEVRON_WIDTH, height: m.cardHeight },
            enabled: hs.offsetPx > 0,
            onClick: () => this.#scrollShelfBy(shelf.id, -1),
            clip,
            suppressClick,
          })
        : null;
      if (chevronLeft) this.#layer.add(chevronLeft.container);
      const chevronRight = overflow
        ? new McButton(this.#scene, {
            kind: "quiet",
            label: "›",
            type: { family: "Public Sans", size: 16, weight: 800, lineHeight: 1, letterSpacing: 0, uppercase: false },
            rect: { x: this.#rect.x + this.#rect.width - CHEVRON_WIDTH, y: rowY, width: CHEVRON_WIDTH, height: m.cardHeight },
            enabled: hs.offsetPx < contentWidth - innerWidth - 0.5,
            onClick: () => this.#scrollShelfBy(shelf.id, 1),
            clip,
            suppressClick,
          })
        : null;
      if (chevronRight) this.#layer.add(chevronRight.container);

      this.#live.set(shelfIndex, { index: shelfIndex, shelf: shelf as Shelf<unknown>, headerRow, cardRows, chevronLeft, chevronRight });
    }
  }

  #scrollShelfBy(shelfId: string, direction: 1 | -1): void {
    const shelf = this.#shelves.find((s) => s.id === shelfId);
    if (!shelf) return;
    const hs = this.#horizontalScrollFor(shelfId);
    const step = this.#metrics.cardWidth + this.#metrics.cardGap;
    const cardsPerPage = Math.max(1, Math.floor(this.#innerWidth() / step));
    hs.scrollByRows(direction * cardsPerPage, shelf.items.length, step, this.#innerWidth());
    this.#redraw();
  }

  #shelfIndexAtY(y: number): number | null {
    const step = this.#shelfStep();
    const relative = y - this.#rect.y + this.#verticalScroll.offsetPx;
    const index = Math.floor(relative / step);
    if (index < 0 || index >= this.#shelves.length) return null;
    // Past the card row (in the shelf's own trailing gap) doesn't count as "on" that shelf for drag targeting.
    const withinShelf = relative - index * step;
    const m = this.#metrics;
    if (withinShelf > m.headerHeight + m.headerToCardsGap + m.cardHeight) return null;
    return index;
  }

  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, dx: number, dy: number): void {
    if (!pointInRect(pointer.x, pointer.y, this.#rect)) return;
    const event = pointer.event as WheelEvent | undefined;
    const horizontalIntent = (event?.shiftKey ?? false) || Math.abs(dx) > Math.abs(dy);
    if (horizontalIntent) {
      const shelfIndex = this.#shelfIndexAtY(pointer.y);
      const shelf = shelfIndex === null ? null : this.#shelves[shelfIndex];
      if (!shelf) return;
      const hs = this.#horizontalScrollFor(shelf.id);
      const amount = event?.shiftKey && Math.abs(dx) < 1 ? dy : dx;
      if (hs.scrollByPx(amount, shelf.items.length, this.#metrics.cardWidth + this.#metrics.cardGap, this.#innerWidth())) this.#redraw();
      return;
    }
    if (this.#verticalScroll.scrollByPx(dy, this.#shelves.length, this.#shelfStep(), this.#rect.height)) this.#redraw();
  }

  #onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointInRect(pointer.x, pointer.y, this.#rect)) return;
    this.#momentum.stop();
    this.#dragShelfId = null;
    const shelfIndex = this.#shelfIndexAtY(pointer.y);
    if (shelfIndex !== null) this.#dragShelfId = this.#shelves[shelfIndex]?.id ?? null;
    this.#drag.start(pointer.id, pointer.x, pointer.y, pointer.downTime);
  }

  #onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    const move = this.#drag.move(pointer.id, pointer.x, pointer.y, this.#scene.time.now);
    if (!move) return;
    if (move.axis === "vertical") {
      if (this.#verticalScroll.scrollByPx(move.delta, this.#shelves.length, this.#shelfStep(), this.#rect.height)) this.#redraw();
    } else if (this.#dragShelfId) {
      const shelf = this.#shelves.find((s) => s.id === this.#dragShelfId);
      if (shelf) {
        const hs = this.#horizontalScrollFor(shelf.id);
        if (hs.scrollByPx(move.delta, shelf.items.length, this.#metrics.cardWidth + this.#metrics.cardGap, this.#innerWidth())) this.#redraw();
      }
    }
  }

  #onPointerUp(pointer: Phaser.Input.Pointer): void {
    const result = this.#drag.end(pointer.id, this.#scene.time.now);
    if (!result) return;
    if (result.wasTap) {
      if (!pointInRect(pointer.x, pointer.y, this.#rect)) return;
      const shelfIndex = this.#shelfIndexAtY(pointer.y);
      if (shelfIndex === null) return;
      const shelf = this.#shelves[shelfIndex]!;
      const hs = this.#horizontalScrollFor(shelf.id);
      const m = this.#metrics;
      const relativeX = pointer.x - (this.#rect.x + CHEVRON_WIDTH) + hs.offsetPx;
      const itemIndex = Math.floor(relativeX / (m.cardWidth + m.cardGap));
      const withinCard = relativeX - itemIndex * (m.cardWidth + m.cardGap);
      if (itemIndex < 0 || itemIndex >= shelf.items.length || withinCard > m.cardWidth) return;
      this.#onCardActivate(shelf.items[itemIndex]!, shelfIndex, itemIndex);
      return;
    }
    if (result.axis === "vertical") {
      this.#momentum.start(result.velocityPxPerMs);
    }
    // Horizontal momentum is deliberately not carried past release: each shelf has its own scroll and its own
    // clamp, and the common case (bringing the next couple of cards into view) is already well served by the
    // drag itself plus the chevrons; adding a second momentum tracker per shelf id was more state than this
    // pass's time budget could verify was correct in every combination with the vertical one.
    this.#dragShelfId = null;
  }

  #onUpdate(_time: number, deltaMs: number): void {
    if (!this.#momentum.active) return;
    const delta = this.#momentum.tick(deltaMs);
    if (delta === 0) return;
    const moved = this.#verticalScroll.scrollByPx(delta, this.#shelves.length, this.#shelfStep(), this.#rect.height);
    if (!moved) {
      this.#momentum.stop();
      return;
    }
    this.#redraw();
  }
}

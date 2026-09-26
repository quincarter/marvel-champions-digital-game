/**
 * A virtualized, pixel-scrolling list of uniform-height rows — the Decks
 * screen's deck list, the deck builder's pool browser, and Title's scenario
 * and hero rosters (PLAN.md Phase 7 wave 1 client wiring; docs/phase4-screen-gaps.md
 * §2 "S8. Searchable, scrollable roster").
 *
 * **Recreated every scene rebuild, like every other non-DOM widget on these
 * screens** (buttons, labels, panels) — not persisted across
 * `destroyChildren(scene)` the way `McTextInput` is. An earlier version
 * tried to persist it (detach its root before the sweep, reattach after, the
 * `McTextInput` pattern), and that was the wrong pattern here: a DOM input
 * has to persist to keep browser focus and keystrokes, but this widget has
 * no such state, and reattaching its container put it at the *front* of the
 * new display list — ahead of everything the scene draws afterward in the
 * same rebuild (a "rail" background, a header, the next control) — so those
 * later elements rendered on top of the list instead of beside or behind it.
 * Recreating it fresh each rebuild, in the normal draw order, puts it back
 * where every other element on the screen already is: exactly where the
 * scene's own layout code placed it.
 *
 * **What does persist is the scroll position**, in a `ListScroll` the caller
 * owns and passes in (`ScrollOwner.scroll`) — a scene keeps one field across
 * rebuilds, unaffected by this widget being destroyed and recreated around
 * it. Within one widget's lifetime (between rebuilds), scrolling — wheel, the
 * scrollbar thumb, keyboard/pad paging — only recycles rows and moves one
 * transform; it never asks the scene to rebuild, which is what keeps it
 * smooth at any list size. The scene calls `update(count, renderRow)` when
 * the *data* changes (a filter, an import, a card added/removed).
 *
 * **Rows are recycled by index**, not rebuilt every frame: a row already
 * drawn for the current window (plus one row of overscan each side, so a row
 * scrolling in is already drawn before the mask exposes it — `ListScroll`'s
 * own `windowFor`) is left alone; only the shared row layer's `y` moves. A
 * row leaving the window is destroyed and one entering is drawn fresh via
 * `renderRow`.
 *
 * **Owns its own background panel**, painted first inside its own container,
 * so it is always behind its own rows regardless of what the scene draws
 * before or after it — the fix for the same "wrong element on top" family of
 * bug a scene-drawn background panel was exposed to.
 *
 * **Touch/mouse drag-to-scroll on the list body itself** (not just the
 * scrollbar thumb) is handled by scene-level pointer listeners — never a
 * `Zone` laid over the rows, which would swallow every row's own button —
 * filtered to this list's rect, and driven by the pure `DragGesture`/
 * `Momentum` classes (`view/drag-gesture.ts`) so the tap-vs-drag threshold
 * and momentum decay are unit-testable without a canvas. A pointer that
 * never moved past the threshold is a tap: `onRowActivate` fires for a row
 * with no button of its own to click (Title's rosters); a pointer that moved
 * is a drag, and its release seeds `Momentum`, decayed every frame until it's
 * negligible or a scroll at an end reports no movement (`Momentum.stop`).
 *
 * **A row's own buttons still need two things this file doesn't own but
 * makes possible**: `McButton`'s `clip` (a row reparented into the masked
 * layer is still fully hit-testable outside the mask — Phaser's masks are
 * visual only — so a row scrolled out of view, or the overscan row, must not
 * respond to a stray click) and `suppressClick` (the drag that just ended
 * must not also fire the button's own `pointerup`). `isDragSuppressingClick`
 * and `rect` below are what a caller wires a row's `McButton`s to.
 */

import Phaser from "phaser";
import { ListScroll, thumbOf } from "../view/list-scroll.js";
import { DragGesture, Momentum, pointInRect } from "../view/drag-gesture.js";
import type { Rect } from "../view/layout.js";
import { surface } from "../tokens.js";
import { paintPanel } from "./widgets.js";
import { setMask, clearMask } from "./rex.js";

export interface VirtualListRow {
  /** Every game object this row drew, at the row's own rect (`McVirtualList` reparents them into its masked layer). */
  readonly objects: readonly Phaser.GameObjects.GameObject[];
}

export interface McVirtualListOptions {
  readonly rect: Rect;
  readonly rowHeight: number;
  readonly count: number;
  /** Draws row `index` at the given rect (the row's position at zero scroll — the widget itself handles the offset) and returns its objects. */
  readonly renderRow: (index: number, rect: Rect) => VirtualListRow;
  /**
   * Scroll position, owned by the caller (a scene field created once and kept
   * across rebuilds — this widget itself is recreated every rebuild, so it
   * cannot hold this itself without losing the player's place every time).
   */
  readonly scroll: ListScroll;
  /** Paints the design's recessed "rail" panel behind the rows. Default true; a caller that wants no background (rare — every current caller wants one) can turn it off. */
  readonly background?: boolean;
  /**
   * A row with no `McButton` of its own (a plain roster row — Title's
   * scenario/hero pickers) is activated by a tap: called with the row index
   * under the pointer once a gesture on the list body ends without having
   * moved past the drag threshold. Rows that draw their own buttons (Decks'
   * Edit/Delete, the builder's +/−) don't need this — their buttons already
   * claim their own clicks — but should still pass this list's `clip` and
   * `isDragSuppressingClick` to those buttons (see the module doc comment).
   */
  readonly onRowActivate?: (index: number, pointer: Phaser.Input.Pointer) => void;
}

const SCROLLBAR_WIDTH = 4;
/** Touch-friendly hit width for starting a scrollbar-thumb drag vs. a list-body drag — wider than the thumb's own thin visual. */
const SCROLLBAR_HIT_WIDTH = 20;
/** A traditional (non-pixel-mode) mouse wheel reports a handful of "lines"; this is how tall one line scrolls. */
const WHEEL_LINE_PX = 24;

export class McVirtualList {
  readonly #scene: Phaser.Scene;
  readonly #scroll: ListScroll;
  readonly #root: Phaser.GameObjects.Container;
  readonly #background: Phaser.GameObjects.Graphics | null;
  readonly #rowLayer: Phaser.GameObjects.Container;
  readonly #maskShape: Phaser.GameObjects.Graphics;
  readonly #track: Phaser.GameObjects.Rectangle;
  readonly #thumb: Phaser.GameObjects.Rectangle;
  readonly #rows = new Map<number, VirtualListRow>();
  readonly #onDestroy: (() => void)[] = [];
  readonly #drag = new DragGesture();
  readonly #momentum = new Momentum();
  #rect: Rect;
  #rowHeight: number;
  #count: number;
  #renderRow: (index: number, rect: Rect) => VirtualListRow;
  #onRowActivate: ((index: number, pointer: Phaser.Input.Pointer) => void) | undefined;
  #thumbDragStartY = 0;
  #thumbDragStartOffset = 0;

  constructor(scene: Phaser.Scene, options: McVirtualListOptions) {
    this.#scene = scene;
    this.#rect = options.rect;
    this.#rowHeight = options.rowHeight;
    this.#count = options.count;
    this.#renderRow = options.renderRow;
    this.#onRowActivate = options.onRowActivate;
    this.#scroll = options.scroll;

    this.#background = options.background === false ? null : scene.add.graphics();
    this.#rowLayer = scene.add.container(0, 0);
    // Not added to the display list (`scene.make.graphics({}, false)`) — it
    // exists only to feed the mask; a shape that's *also* a normal display
    // object would double-render under the WebGL filter mask path (`setMask`,
    // `ui/rex.ts` — see its doc comment for why this isn't `createGeometryMask`).
    this.#maskShape = scene.make.graphics({}, false);
    setMask(this.#rowLayer, this.#maskShape, "world");

    this.#track = scene.add.rectangle(0, 0, SCROLLBAR_WIDTH, 10, surface.ink.hex, 0.12).setOrigin(0, 0);
    this.#thumb = scene.add
      .rectangle(0, 0, SCROLLBAR_WIDTH, 10, surface.ink.hex, 0.6)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    scene.input.setDraggable(this.#thumb);
    this.#thumb.on("dragstart", (pointer: Phaser.Input.Pointer) => {
      this.#thumbDragStartY = pointer.y;
      this.#thumbDragStartOffset = this.#scroll.offsetPx;
    });
    this.#thumb.on("drag", (pointer: Phaser.Input.Pointer) => this.#onThumbDrag(pointer));

    // Background first, so it is always *behind* the rows — painted inside
    // this same container rather than by the scene, so their relative order
    // can never be disturbed by what the scene draws around this widget.
    this.#root = scene.add.container(0, 0, [
      ...(this.#background ? [this.#background] : []),
      this.#rowLayer,
      this.#track,
      this.#thumb,
    ]);

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());

    this.#layoutTrack();
    this.#redrawWindow(true);
  }

  /** Repositions and resizes in place, preserving scroll position (clamped). */
  layout(rect: Rect): void {
    this.#rect = rect;
    this.#layoutTrack();
    this.#scroll.clamp(this.#count, this.#rowHeight, this.#rect.height);
    this.#redrawWindow(true);
  }

  /** The data changed (a filter, an import, an edit): redraws every row currently in the visible window with the new renderer. Scroll position is preserved (clamped to the new count). */
  update(count: number, renderRow: (index: number, rect: Rect) => VirtualListRow): void {
    this.#count = count;
    this.#renderRow = renderRow;
    this.#scroll.clamp(this.#count, this.#rowHeight, this.#rect.height);
    this.#redrawWindow(true);
  }

  get count(): number {
    return this.#count;
  }

  /**
   * True while a drag on this list's body has moved past the tap threshold
   * and hasn't been released yet — what a row's own `McButton` should pass as
   * `suppressClick` so the pointerup that ends a drag doesn't also fire a
   * click on whatever it lands on.
   */
  get isDragSuppressingClick(): boolean {
    return this.#drag.isDragging && this.#drag.movedPastThreshold;
  }

  /** The rect row `index` sits at right now (may be partly or wholly outside the list's own rect if it isn't on screen). */
  rectFor(index: number): Rect {
    return {
      x: this.#rect.x,
      y: this.#rect.y + this.#scroll.rowTop(index, this.#rowHeight),
      width: this.#rect.width,
      height: this.#rowHeight,
    };
  }

  /** Scrolls the minimum distance to bring row `index` fully on screen. */
  scrollIntoView(index: number): void {
    if (this.#scroll.scrollIntoView(index, this.#count, this.#rowHeight, this.#rect.height)) this.#redrawWindow(false);
  }

  scrollByPage(direction: 1 | -1): void {
    if (this.#scroll.scrollByPage(direction, this.#count, this.#rowHeight, this.#rect.height))
      this.#redrawWindow(false);
  }

  scrollToStart(): void {
    if (this.#scroll.scrollToStart(this.#count, this.#rowHeight, this.#rect.height)) this.#redrawWindow(false);
  }

  scrollToEnd(): void {
    if (this.#scroll.scrollToEnd(this.#count, this.#rowHeight, this.#rect.height)) this.#redrawWindow(false);
  }

  /** Runs `fn` once, when this list is destroyed — for a subscription whose life is the list's. */
  onDestroy(fn: () => void): void {
    this.#onDestroy.push(fn);
  }

  /** Torn down at the start of every scene rebuild (not just on shutdown), so its listeners never double up across the fresh instance the scene creates next. */
  destroy(): void {
    for (const fn of this.#onDestroy.splice(0)) fn();
    this.#scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    this.#scene.events.off(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    for (const row of this.#rows.values()) for (const object of row.objects) object.destroy();
    this.#rows.clear();
    clearMask(this.#rowLayer);
    this.#maskShape.destroy();
    this.#root.destroy(true);
  }

  #layoutTrack(): void {
    const { rect } = this;
    this.#track.setPosition(rect.x + rect.width - SCROLLBAR_WIDTH, rect.y).setSize(SCROLLBAR_WIDTH, rect.height);
    this.#maskShape.clear().fillStyle(0xffffff).fillRect(rect.x, rect.y, rect.width, rect.height);
    if (this.#background) {
      this.#background.clear();
      paintPanel(this.#background, rect, "rail", "rest");
    }
  }

  get rect(): Rect {
    return this.#rect;
  }

  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void {
    const { rect } = this;
    if (pointer.x < rect.x || pointer.x > rect.x + rect.width || pointer.y < rect.y || pointer.y > rect.y + rect.height)
      return;
    // A pixel-mode wheel (most trackpads) reports `dy` already in pixels, and
    // scrolling by exactly that amount is what "smooth" means; a line-mode
    // wheel (most mice) reports a handful of lines (deltaY like ±1 or ±3),
    // which needs scaling up to feel like anything moved. `deltaMode` on the
    // underlying `WheelEvent` (0 = pixel, 1 = line, 2 = page) tells them
    // apart; forcing every event to a fixed-size jump (the previous shape of
    // this method) made a pixel-mode device feel like it was scrolling in
    // jumps rather than smoothly.
    const deltaMode = (pointer.event as WheelEvent | undefined)?.deltaMode ?? 1;
    const amount = deltaMode === 0 ? dy : dy * WHEEL_LINE_PX;
    if (amount === 0) return;
    if (this.#scroll.scrollByPx(amount, this.#count, this.#rowHeight, this.#rect.height)) this.#redrawWindow(false);
  }

  #onThumbDrag(pointer: Phaser.Input.Pointer): void {
    const contentHeight = this.#count * this.#rowHeight;
    if (contentHeight <= this.#rect.height) return;
    const trackHeight = this.#rect.height;
    const deltaPx = ((pointer.y - this.#thumbDragStartY) / trackHeight) * contentHeight;
    const target = this.#thumbDragStartOffset + deltaPx;
    if (this.#scroll.scrollByPx(target - this.#scroll.offsetPx, this.#count, this.#rowHeight, this.#rect.height))
      this.#redrawWindow(false);
  }

  /** The scrollbar's own column — excluded from starting a body drag, so pressing the thumb doesn't also start a competing list-body drag. */
  #inScrollbarColumn(x: number): boolean {
    return x >= this.#rect.x + this.#rect.width - SCROLLBAR_HIT_WIDTH;
  }

  #rowIndexAt(pointerY: number): number {
    return Math.floor((pointerY - this.#rect.y + this.#scroll.offsetPx) / this.#rowHeight);
  }

  #onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointInRect(pointer.x, pointer.y, this.#rect) || this.#inScrollbarColumn(pointer.x)) return;
    this.#momentum.stop();
    this.#drag.start(pointer.id, pointer.y, pointer.downTime);
  }

  #onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    const delta = this.#drag.move(pointer.id, pointer.y, this.#scene.time.now);
    if (delta === null) return;
    if (this.#scroll.scrollByPx(delta, this.#count, this.#rowHeight, this.#rect.height)) this.#redrawWindow(false);
  }

  #onPointerUp(pointer: Phaser.Input.Pointer): void {
    const result = this.#drag.end(pointer.id, this.#scene.time.now);
    if (!result) return;
    if (result.wasTap) {
      if (!this.#onRowActivate || !pointInRect(pointer.x, pointer.y, this.#rect) || this.#inScrollbarColumn(pointer.x))
        return;
      const index = this.#rowIndexAt(pointer.y);
      if (index >= 0 && index < this.#count) this.#onRowActivate(index, pointer);
      return;
    }
    this.#momentum.start(result.velocityPxPerMs);
  }

  #onUpdate(_time: number, deltaMs: number): void {
    if (!this.#momentum.active) return;
    const delta = this.#momentum.tick(deltaMs);
    if (delta === 0) return;
    const moved = this.#scroll.scrollByPx(delta, this.#count, this.#rowHeight, this.#rect.height);
    if (!moved) {
      // Hit an end: momentum doesn't keep "pushing on the wall" for the rest of its decay.
      this.#momentum.stop();
      return;
    }
    this.#redrawWindow(false);
  }

  /**
   * Recycles rows by index against the current scroll offset, then moves the
   * row layer by one transform — the operation every scroll change (wheel,
   * thumb drag, keyboard paging) reduces to, and the reason none of them
   * touch the owning scene.
   */
  #redrawWindow(forceRedrawVisible: boolean): void {
    const window = this.#scroll.windowFor(this.#count, this.#rowHeight, this.#rect.height);
    const wanted = new Set<number>();
    for (let i = window.start; i < window.end; i++) wanted.add(i);

    for (const [index, row] of this.#rows) {
      if (!wanted.has(index) || forceRedrawVisible) {
        for (const object of row.objects) object.destroy();
        this.#rows.delete(index);
      }
    }
    for (const index of wanted) {
      if (this.#rows.has(index)) continue;
      const zeroScrollRect: Rect = {
        x: this.#rect.x,
        y: this.#rect.y + index * this.#rowHeight,
        width: this.#rect.width,
        height: this.#rowHeight,
      };
      const row = this.#renderRow(index, zeroScrollRect);
      this.#rowLayer.add(row.objects as Phaser.GameObjects.GameObject[]);
      this.#rows.set(index, row);
    }

    this.#rowLayer.setPosition(0, -this.#scroll.offsetPx);

    const thumb = thumbOf(this.#scroll.offsetPx, this.#count, this.#rowHeight, this.#rect.height);
    this.#thumb.setVisible(thumb !== null);
    this.#track.setVisible(thumb !== null);
    if (thumb) {
      this.#thumb.setPosition(
        this.#rect.x + this.#rect.width - SCROLLBAR_WIDTH,
        this.#rect.y + thumb.top * this.#rect.height,
      );
      this.#thumb.setSize(SCROLLBAR_WIDTH, Math.max(16, thumb.size * this.#rect.height));
    }
  }
}

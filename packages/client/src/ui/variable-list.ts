/**
 * A virtualized, pixel-scrolling list of *variable*-height rows — `ui/virtual-list.ts`'s
 * `McVirtualList` generalized from one fixed `rowHeight` to a `heights` array. Built for the
 * Rules overlay's Card list tab (docs/phase4-screen-gaps.md §3 "W4"), whose rows are either a
 * short encounter-set header slot or a taller card-grid-row slot — two heights that can't share
 * one `McVirtualList`, which draws every row at the same height.
 *
 * Everything else about it is deliberately identical to `McVirtualList`: recreated fresh every
 * scene rebuild (not persisted across `children.removeAll(true)`); the caller owns scroll
 * position across rebuilds (`VariableListScroll`, this list's `ListScroll`); rows are recycled by
 * index against the current window; it owns its own background panel, painted first inside its
 * own container; and touch/mouse drag-to-scroll is handled the same way. See that file's own doc
 * comment for the reasoning behind each of those — it isn't repeated here.
 */

import Phaser from "phaser";
import { DragGesture, Momentum, pointInRect } from "../view/drag-gesture.js";
import type { Rect } from "../view/layout.js";
import { VariableListScroll, variableThumbOf } from "../view/variable-list-scroll.js";
import { surface } from "../tokens.js";
import { paintPanel } from "./widgets.js";
import { setMask, clearMask } from "./rex.js";
import type { VirtualListRow } from "./virtual-list.js";

export interface McVariableListOptions {
  readonly rect: Rect;
  /** One height per row, in order — the whole reason this exists instead of `McVirtualList`. */
  readonly heights: readonly number[];
  readonly renderRow: (index: number, rect: Rect) => VirtualListRow;
  readonly scroll: VariableListScroll;
  readonly background?: boolean;
  readonly onRowActivate?: (index: number, pointer: Phaser.Input.Pointer) => void;
}

const SCROLLBAR_WIDTH = 4;
const SCROLLBAR_HIT_WIDTH = 20;
const WHEEL_LINE_PX = 24;

export class McVariableList {
  readonly #scene: Phaser.Scene;
  readonly #scroll: VariableListScroll;
  readonly #root: Phaser.GameObjects.Container;
  readonly #background: Phaser.GameObjects.Graphics | null;
  readonly #rowLayer: Phaser.GameObjects.Container;
  readonly #maskShape: Phaser.GameObjects.Graphics;
  readonly #track: Phaser.GameObjects.Rectangle;
  readonly #thumb: Phaser.GameObjects.Rectangle;
  readonly #rows = new Map<number, VirtualListRow>();
  readonly #drag = new DragGesture();
  readonly #momentum = new Momentum();
  #rect: Rect;
  #heights: readonly number[];
  #renderRow: (index: number, rect: Rect) => VirtualListRow;
  #onRowActivate: ((index: number, pointer: Phaser.Input.Pointer) => void) | undefined;
  #thumbDragStartY = 0;
  #thumbDragStartOffset = 0;

  constructor(scene: Phaser.Scene, options: McVariableListOptions) {
    this.#scene = scene;
    this.#rect = options.rect;
    this.#heights = options.heights;
    this.#renderRow = options.renderRow;
    this.#onRowActivate = options.onRowActivate;
    this.#scroll = options.scroll;

    this.#background = options.background === false ? null : scene.add.graphics();
    this.#rowLayer = scene.add.container(0, 0);
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

    this.#root = scene.add.container(0, 0, [...(this.#background ? [this.#background] : []), this.#rowLayer, this.#track, this.#thumb]);

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

  layout(rect: Rect): void {
    this.#rect = rect;
    this.#layoutTrack();
    this.#scroll.clamp(this.#heights, this.#rect.height);
    this.#redrawWindow(true);
  }

  /** The data (or the row heights, e.g. a resize that changes the card grid's own column count) changed. */
  update(heights: readonly number[], renderRow: (index: number, rect: Rect) => VirtualListRow): void {
    this.#heights = heights;
    this.#renderRow = renderRow;
    this.#scroll.clamp(this.#heights, this.#rect.height);
    this.#redrawWindow(true);
  }

  get count(): number {
    return this.#heights.length;
  }

  get isDragSuppressingClick(): boolean {
    return this.#drag.isDragging && this.#drag.movedPastThreshold;
  }

  rectFor(index: number): Rect {
    return { x: this.#rect.x, y: this.#rect.y + this.#scroll.rowTop(this.#heights, index), width: this.#rect.width, height: this.#heights[index] ?? 0 };
  }

  scrollIntoView(index: number): void {
    if (this.#scroll.scrollIntoView(index, this.#heights, this.#rect.height)) this.#redrawWindow(false);
  }

  scrollByPage(direction: 1 | -1): void {
    if (this.#scroll.scrollByPage(direction, this.#heights, this.#rect.height)) this.#redrawWindow(false);
  }

  scrollToStart(): void {
    if (this.#scroll.scrollToStart(this.#heights, this.#rect.height)) this.#redrawWindow(false);
  }

  scrollToEnd(): void {
    if (this.#scroll.scrollToEnd(this.#heights, this.#rect.height)) this.#redrawWindow(false);
  }

  destroy(): void {
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
    if (pointer.x < rect.x || pointer.x > rect.x + rect.width || pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    const deltaMode = (pointer.event as WheelEvent | undefined)?.deltaMode ?? 1;
    const amount = deltaMode === 0 ? dy : dy * WHEEL_LINE_PX;
    if (amount === 0) return;
    if (this.#scroll.scrollByPx(amount, this.#heights, this.#rect.height)) this.#redrawWindow(false);
  }

  #onThumbDrag(pointer: Phaser.Input.Pointer): void {
    const contentHeight = this.#heights.reduce((sum, h) => sum + h, 0);
    if (contentHeight <= this.#rect.height) return;
    const trackHeight = this.#rect.height;
    const deltaPx = ((pointer.y - this.#thumbDragStartY) / trackHeight) * contentHeight;
    const target = this.#thumbDragStartOffset + deltaPx;
    if (this.#scroll.scrollByPx(target - this.#scroll.offsetPx, this.#heights, this.#rect.height)) this.#redrawWindow(false);
  }

  #inScrollbarColumn(x: number): boolean {
    return x >= this.#rect.x + this.#rect.width - SCROLLBAR_HIT_WIDTH;
  }

  #rowIndexAt(pointerY: number): number | null {
    let cursor = this.#rect.y - this.#scroll.offsetPx;
    for (let i = 0; i < this.#heights.length; i++) {
      const height = this.#heights[i]!;
      if (pointerY >= cursor && pointerY < cursor + height) return i;
      cursor += height;
    }
    return null;
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
    if (this.#scroll.scrollByPx(delta, this.#heights, this.#rect.height)) this.#redrawWindow(false);
  }

  #onPointerUp(pointer: Phaser.Input.Pointer): void {
    const result = this.#drag.end(pointer.id, this.#scene.time.now);
    if (!result) return;
    if (result.wasTap) {
      if (!this.#onRowActivate || !pointInRect(pointer.x, pointer.y, this.#rect) || this.#inScrollbarColumn(pointer.x)) return;
      const index = this.#rowIndexAt(pointer.y);
      if (index !== null) this.#onRowActivate(index, pointer);
      return;
    }
    this.#momentum.start(result.velocityPxPerMs);
  }

  #onUpdate(_time: number, deltaMs: number): void {
    if (!this.#momentum.active) return;
    const delta = this.#momentum.tick(deltaMs);
    if (delta === 0) return;
    const moved = this.#scroll.scrollByPx(delta, this.#heights, this.#rect.height);
    if (!moved) {
      this.#momentum.stop();
      return;
    }
    this.#redrawWindow(false);
  }

  #redrawWindow(forceRedrawVisible: boolean): void {
    const window = this.#scroll.windowFor(this.#heights, this.#rect.height);
    const wanted = new Set<number>();
    for (let i = window.start; i < window.end; i++) wanted.add(i);

    for (const [index, row] of this.#rows) {
      if (!wanted.has(index) || forceRedrawVisible) {
        for (const object of row.objects) object.destroy();
        this.#rows.delete(index);
      }
    }
    let top = 0;
    for (let i = 0; i < window.start; i++) top += this.#heights[i]!;
    for (const index of wanted) {
      if (this.#rows.has(index)) continue;
      let rowTop = 0;
      for (let i = 0; i < index; i++) rowTop += this.#heights[i]!;
      const zeroScrollRect: Rect = { x: this.#rect.x, y: this.#rect.y + rowTop, width: this.#rect.width, height: this.#heights[index]! };
      const row = this.#renderRow(index, zeroScrollRect);
      this.#rowLayer.add(row.objects as Phaser.GameObjects.GameObject[]);
      this.#rows.set(index, row);
    }

    this.#rowLayer.setPosition(0, -this.#scroll.offsetPx);

    const thumb = variableThumbOf(this.#scroll.offsetPx, this.#heights, this.#rect.height);
    this.#thumb.setVisible(thumb !== null);
    this.#track.setVisible(thumb !== null);
    if (thumb) {
      this.#thumb.setPosition(this.#rect.x + this.#rect.width - SCROLLBAR_WIDTH, this.#rect.y + thumb.top * this.#rect.height);
      this.#thumb.setSize(SCROLLBAR_WIDTH, Math.max(16, thumb.size * this.#rect.height));
    }
  }
}

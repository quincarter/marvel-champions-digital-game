/**
 * A masked, translatable content container with wheel + touch-drag + momentum scrolling — the "draw everything
 * eagerly, mask, translate" sibling of `McVirtualList`/`McVariableList` (`ui/virtual-list.ts`, `ui/variable-list.ts`)
 * for a screen whose scrollable content is small and heterogeneous enough (Table setup's phone layout, W2: a
 * couple dozen draw calls across section headers, checkbox rows, chips and a bordered panel) that virtualized row
 * recycling buys nothing and actively gets in the way of one row holding a persistent DOM element (the seed field,
 * `McTextInput`) that can't safely be destroyed and recreated every time it scrolls in and out of a recycled
 * window without losing focus and in-progress keystrokes.
 *
 * Reuses exactly the same scroll math and gesture primitives `McVariableList` does — `VariableListScroll` for
 * offset/clamp/scrollIntoView, `DragGesture`/`Momentum` for touch-drag and flick — just without the row-recycling
 * layer on top, since every row here is drawn once per scene rebuild anyway (the same lifecycle every other
 * widget on these screens already follows: recreated fresh each rebuild, scroll position persisted by the caller).
 *
 * The caller adds its own content objects to `content` (a container) at content-space coordinates — `x` absolute
 * (screen space), `y` measured from the content's own top (0), never touching the scroll offset itself; this
 * class only ever moves `content`'s own `y` by `-scroll.offsetPx`. `heights` is the same one-entry-per-logical-row
 * array `VariableListScroll` already takes everywhere else, used only for the scroll math (clamp, `scrollIntoView`
 * by row index) — never for drawing, since every row here is already drawn at its own real, fixed position.
 */
import Phaser from "phaser";
import { DragGesture, Momentum, pointInRect } from "../view/drag-gesture.js";
import type { Rect } from "../view/layout.js";
import { VariableListScroll, variableThumbOf } from "../view/variable-list-scroll.js";
import { surface } from "../tokens.js";
import { setMask, clearMask } from "./rex.js";

export interface McScrollRegionOptions {
  readonly rect: Rect;
  /** One entry per logical content row, in the order the caller drew them — only ever read for scroll math. */
  readonly heights: readonly number[];
  /** Caller-owned, persists across scene rebuilds — the same convention `ListScroll`/`VariableListScroll` use everywhere else. */
  readonly scroll: VariableListScroll;
  /** Fired after every offset change (wheel, drag, momentum, `scrollIntoView`) — e.g. to reposition a DOM overlay that this container's own Phaser mask can't clip. */
  readonly onScroll?: (offsetPx: number) => void;
}

const SCROLLBAR_WIDTH = 4;
const SCROLLBAR_HIT_WIDTH = 20;
const WHEEL_LINE_PX = 24;

export class McScrollRegion {
  readonly content: Phaser.GameObjects.Container;
  readonly #scene: Phaser.Scene;
  readonly #scroll: VariableListScroll;
  readonly #heights: readonly number[];
  readonly #onScroll: ((offsetPx: number) => void) | undefined;
  readonly #root: Phaser.GameObjects.Container;
  readonly #maskShape: Phaser.GameObjects.Graphics;
  readonly #track: Phaser.GameObjects.Rectangle;
  readonly #thumb: Phaser.GameObjects.Rectangle;
  readonly #drag = new DragGesture();
  readonly #momentum = new Momentum();
  #rect: Rect;

  constructor(scene: Phaser.Scene, options: McScrollRegionOptions) {
    this.#scene = scene;
    this.#rect = options.rect;
    this.#heights = options.heights;
    this.#scroll = options.scroll;
    this.#onScroll = options.onScroll;

    this.content = scene.add.container(0, 0);
    this.#maskShape = scene.make.graphics({}, false);
    setMask(this.content, this.#maskShape, "world");

    this.#track = scene.add.rectangle(0, 0, SCROLLBAR_WIDTH, 10, surface.ink.hex, 0.12).setOrigin(0, 0);
    this.#thumb = scene.add.rectangle(0, 0, SCROLLBAR_WIDTH, 10, surface.ink.hex, 0.6).setOrigin(0, 0);

    this.#root = scene.add.container(0, 0, [this.content, this.#track, this.#thumb]);

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());

    this.#layoutMask();
    this.#applyOffset();
  }

  get rect(): Rect {
    return this.#rect;
  }

  get isDragSuppressingClick(): boolean {
    return this.#drag.isDragging && this.#drag.movedPastThreshold;
  }

  scrollIntoView(index: number): void {
    if (this.#scroll.scrollIntoView(index, this.#heights, this.#rect.height)) this.#applyOffset();
  }

  /** Scrolls by `amount` pixels (positive is down), clamped — a keyboard or pad's page step. */
  scrollByPx(amount: number): void {
    if (this.#scroll.scrollByPx(amount, this.#heights, this.#rect.height)) this.#applyOffset();
  }

  destroy(): void {
    this.#scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    this.#scene.events.off(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    clearMask(this.content);
    this.#maskShape.destroy();
    this.#root.destroy(true);
  }

  #layoutMask(): void {
    const { rect } = this;
    this.#maskShape.clear().fillStyle(0xffffff).fillRect(rect.x, rect.y, rect.width, rect.height);
    this.#track.setPosition(rect.x + rect.width - SCROLLBAR_WIDTH, rect.y).setSize(SCROLLBAR_WIDTH, rect.height);
  }

  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void {
    if (!pointInRect(pointer.x, pointer.y, this.#rect)) return;
    const deltaMode = (pointer.event as WheelEvent | undefined)?.deltaMode ?? 1;
    const amount = deltaMode === 0 ? dy : dy * WHEEL_LINE_PX;
    if (amount === 0) return;
    if (this.#scroll.scrollByPx(amount, this.#heights, this.#rect.height)) this.#applyOffset();
  }

  #inScrollbarColumn(x: number): boolean {
    return x >= this.#rect.x + this.#rect.width - SCROLLBAR_HIT_WIDTH;
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
    if (this.#scroll.scrollByPx(delta, this.#heights, this.#rect.height)) this.#applyOffset();
  }

  #onPointerUp(pointer: Phaser.Input.Pointer): void {
    const result = this.#drag.end(pointer.id, this.#scene.time.now);
    if (!result || result.wasTap) return;
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
    this.#applyOffset();
  }

  #applyOffset(): void {
    this.#scroll.clamp(this.#heights, this.#rect.height);
    const offset = this.#scroll.offsetPx;
    this.content.setPosition(0, -offset);
    const thumb = variableThumbOf(offset, this.#heights, this.#rect.height);
    this.#thumb.setVisible(thumb !== null);
    this.#track.setVisible(thumb !== null);
    if (thumb) {
      this.#thumb.setPosition(
        this.#rect.x + this.#rect.width - SCROLLBAR_WIDTH,
        this.#rect.y + thumb.top * this.#rect.height,
      );
      this.#thumb.setSize(SCROLLBAR_WIDTH, Math.max(16, thumb.size * this.#rect.height));
    }
    this.#onScroll?.(offset);
  }
}

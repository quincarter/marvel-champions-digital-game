/**
 * A single row of quick-filter chips that scrolls sideways — the narrow
 * layouts' answer to a chip strip that would otherwise wrap to three 44px
 * rows on a phone (Take your seats, docs/phase4-screen-gaps.md §3 W2b; the
 * owner's 2026-09-19 phone screenshot, where the third chip row ran straight
 * into the shelves). Each chip keeps its own compact width
 * (`view/chip-layout.ts`'s `compactChipWidth`, the same sizing
 * `drawCompactChipStrip` uses on wide), the row is clipped to its rect, and
 * a touch drag, a horizontal wheel notch or Shift+wheel move it.
 *
 * Built the same way `ui/shelf-roster.ts` and `ui/virtual-list.ts` are: the
 * offset lives in a caller-owned `RailScroll` so it survives a scene rebuild;
 * every chip is redrawn at its on-screen position on each offset change
 * rather than living inside a translated container, so `McButton`'s own hit
 * zone is always exactly where the chip is drawn; and a chip's own click is
 * swallowed while a drag over the rail is in flight (`suppressClick`) or when
 * the release lands outside the rail's own rect (`clip`), which is what stops
 * a flick from also toggling whatever chip the finger lifted over.
 *
 * Small edge fades (paper over the clipped ends) show there is more to scroll
 * to on whichever side still has content, in place of a scrollbar.
 */
import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { CHIP_GAP, compactChipWidth } from "../view/chip-layout.js";
import { DragGesture, Momentum, pointInRect } from "../view/drag-gesture.js";
import type { Rect } from "../view/layout.js";
import { RailScroll, railContentWidth, railItemOffsets } from "../view/rail-scroll.js";
import { McButton } from "./widgets.js";
import { clearMask, setMask } from "./rex.js";

export interface ChipRailChip {
  readonly id: string;
  readonly text: string;
  readonly selected: boolean;
  readonly onClick: () => void;
  /** An aspect chip's own colour (`McButtonOptions.tint`, `view/aspect-stamp.ts`). */
  readonly tint?: { readonly fill: number; readonly ink: number };
}

export interface McChipRailOptions {
  readonly rect: Rect;
  readonly chips: readonly ChipRailChip[];
  /** Caller-owned, persists across scene rebuilds. */
  readonly scroll: RailScroll;
  /** The ground colour the edge fades blend into — the paper the roster sits on. */
  readonly ground?: number;
}

const FADE_WIDTH = 18;
const FADE_STEPS = 6;
const WHEEL_LINE_PX = 24;

export class McChipRail {
  readonly #scene: Phaser.Scene;
  readonly #root: Phaser.GameObjects.Container;
  readonly #layer: Phaser.GameObjects.Container;
  readonly #maskShape: Phaser.GameObjects.Graphics;
  readonly #fades: Phaser.GameObjects.Graphics;
  readonly #drag = new DragGesture();
  readonly #momentum = new Momentum();
  readonly #scroll: RailScroll;
  readonly #chips: readonly ChipRailChip[];
  readonly #widths: readonly number[];
  readonly #offsets: readonly number[];
  readonly #contentWidth: number;
  readonly #ground: number;
  #rect: Rect;
  #buttons: McButton[] = [];

  constructor(scene: Phaser.Scene, options: McChipRailOptions) {
    this.#scene = scene;
    this.#rect = options.rect;
    this.#chips = options.chips;
    this.#scroll = options.scroll;
    this.#ground = options.ground ?? surface.paper.hex;
    this.#widths = this.#chips.map((chip) => compactChipWidth(chip.text));
    const items = this.#widths.map((width) => ({ width }));
    this.#offsets = railItemOffsets(items, CHIP_GAP);
    this.#contentWidth = railContentWidth(items, CHIP_GAP);

    this.#layer = scene.add.container(0, 0);
    this.#maskShape = scene.make.graphics({}, false);
    setMask(this.#layer, this.#maskShape, "world");
    this.#fades = scene.add.graphics();
    this.#root = scene.add.container(0, 0, [this.#layer, this.#fades]);

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());

    this.#scroll.clamp(this.#contentWidth, this.#rect.width);
    this.#layoutMask();
    this.#redraw();
  }

  get rect(): Rect {
    return this.#rect;
  }

  /** True while a drag on this rail has moved past the tap threshold and hasn't been released. */
  get isDragSuppressingClick(): boolean {
    return this.#drag.isDragging && this.#drag.movedPastThreshold;
  }

  /** Where chip `index` sits on screen right now — for focus rings. */
  rectFor(index: number): Rect {
    return {
      x: this.#rect.x + (this.#offsets[index] ?? 0) - this.#scroll.offsetPx,
      y: this.#rect.y,
      width: this.#widths[index] ?? 0,
      height: this.#rect.height,
    };
  }

  /** Scrolls the minimum distance so chip `index` is fully visible — `FocusStop.ensureVisible`. */
  scrollIntoView(index: number): void {
    const x = this.#offsets[index];
    const width = this.#widths[index];
    if (x === undefined || width === undefined) return;
    if (this.#scroll.scrollIntoView(x, width, this.#contentWidth, this.#rect.width)) this.#redraw();
  }

  destroy(): void {
    this.#scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.#onWheel, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    this.#scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);
    this.#scene.events.off(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    clearMask(this.#layer);
    this.#maskShape.destroy();
    this.#root.destroy(true);
  }

  #layoutMask(): void {
    this.#maskShape
      .clear()
      .fillStyle(0xffffff)
      .fillRect(this.#rect.x, this.#rect.y, this.#rect.width, this.#rect.height);
  }

  #redraw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    const offset = this.#scroll.offsetPx;
    const clip = (): Rect => this.#rect;
    const suppressClick = (): boolean => this.isDragSuppressingClick;
    this.#chips.forEach((chip, index) => {
      const x = this.#rect.x + this.#offsets[index]! - offset;
      const width = this.#widths[index]!;
      // Off-screen chips aren't built at all — the mask would hide them, but their hit zones would still be live.
      if (x + width < this.#rect.x || x > this.#rect.x + this.#rect.width) return;
      const button = new McButton(this.#scene, {
        kind: "secondary",
        label: chip.text,
        type: typeRole.rowTitle,
        rect: { x, y: this.#rect.y, width, height: this.#rect.height },
        selected: chip.selected,
        onClick: chip.onClick,
        clip,
        suppressClick,
        ...(chip.tint ? { tint: chip.tint } : {}),
      });
      this.#layer.add(button.container);
      this.#buttons.push(button);
    });

    // Edge fades: a short run of the ground colour, solid at the rail's edge and clear a little way in, on
    // whichever side still has chips to scroll to. Stepped strips rather than `fillGradientStyle`, which Phaser 4's
    // WebGL Graphics path drew as nothing at all in the browser check (2026-09-19).
    this.#fades.clear();
    const edges = this.#scroll.edges(this.#contentWidth, this.#rect.width);
    const { x, y, width, height } = this.#rect;
    const stripWidth = FADE_WIDTH / FADE_STEPS;
    for (let step = 0; step < FADE_STEPS; step++) {
      const alpha = 0.9 * (1 - step / FADE_STEPS);
      this.#fades.fillStyle(this.#ground, alpha);
      if (edges.left) this.#fades.fillRect(x + step * stripWidth, y, stripWidth + 0.5, height);
      if (edges.right) this.#fades.fillRect(x + width - (step + 1) * stripWidth, y, stripWidth + 0.5, height);
    }
  }

  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, dx: number, dy: number): void {
    if (!pointInRect(pointer.x, pointer.y, this.#rect)) return;
    const event = pointer.event as WheelEvent | undefined;
    // A vertical notch over a sideways-only rail scrolls it sideways too: there is nothing else it could mean here,
    // and a mouse user on a tablet-portrait window has no horizontal notch to reach for.
    const raw = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    const deltaMode = event?.deltaMode ?? 1;
    const amount = deltaMode === 0 ? raw : raw * WHEEL_LINE_PX;
    if (amount === 0) return;
    if (this.#scroll.scrollByPx(amount, this.#contentWidth, this.#rect.width)) this.#redraw();
  }

  #onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointInRect(pointer.x, pointer.y, this.#rect)) return;
    this.#momentum.stop();
    // `DragGesture` tracks one coordinate; here it's x.
    this.#drag.start(pointer.id, pointer.x, pointer.downTime);
  }

  #onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    const delta = this.#drag.move(pointer.id, pointer.x, this.#scene.time.now);
    if (delta === null) return;
    if (this.#scroll.scrollByPx(delta, this.#contentWidth, this.#rect.width)) this.#redraw();
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
    if (!this.#scroll.scrollByPx(delta, this.#contentWidth, this.#rect.width)) {
      this.#momentum.stop();
      return;
    }
    this.#redraw();
  }
}

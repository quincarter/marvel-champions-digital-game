/**
 * The `Mc*` widget layer.
 *
 * Scenes never draw a rectangle or reach for rexUI directly (PLAN.md Phase 4):
 * they build widgets, and these widgets implement the design system's state
 * matrix through `skin`. Keeping scenes on the wrappers is what leaves the
 * toolkit swappable — PhaserJSX was set aside as a later candidate precisely
 * because this seam exists.
 *
 * Depth here is border weight and ground swaps only: there is no shadow in the
 * system except the red selection ring, which `McSelectionRing` owns.
 */

import Phaser from "phaser";
import { border, hit, ink, selectionRing, surface, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { caseOf, cssOf, skin, textStyle, type WidgetKind, type WidgetState } from "./theme.js";

/** Draws a rect with the design's border model into an existing Graphics. */
export function paintPanel(g: Phaser.GameObjects.Graphics, rect: Rect, kind: WidgetKind, state: WidgetState): void {
  const s = skin(kind, state);
  g.fillStyle(s.fill, s.fillAlpha);
  g.fillRect(rect.x, rect.y, rect.width, rect.height);
  g.lineStyle(s.strokeWidth, s.stroke, s.fillAlpha);
  if (s.dashed) dashedRect(g, rect, s.strokeWidth);
  else g.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

/** A dashed outline: the system's mark for a slot that isn't filled yet. */
export function dashedRect(g: Phaser.GameObjects.Graphics, rect: Rect, width: number): void {
  const step = border.dashSegment + border.dashGap;
  const line = (x1: number, y1: number, x2: number, y2: number): void => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / length;
    const dy = (y2 - y1) / length;
    for (let at = 0; at < length; at += step) {
      const end = Math.min(at + border.dashSegment, length);
      g.lineBetween(x1 + dx * at, y1 + dy * at, x1 + dx * end, y1 + dy * end);
    }
  };
  g.lineStyle(width, skin("quiet", "rest").stroke, 1);
  line(rect.x, rect.y, rect.x + rect.width, rect.y);
  line(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height);
  line(rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height);
  line(rect.x, rect.y + rect.height, rect.x, rect.y);
}

export interface McButtonOptions {
  readonly kind: WidgetKind;
  readonly label: string;
  readonly type: TypeSpec;
  readonly rect: Rect;
  readonly onClick: () => void;
  /** Shown as the "Why illegal?" line when the button is unavailable. */
  readonly reason?: string;
  readonly enabled?: boolean;
  readonly selected?: boolean;
  /** Drawn beside the label, e.g. the "2" on the Attack button. */
  readonly value?: string;
}

/**
 * A button. Hover swaps ground and ink; it never moves or scales, per the
 * design system. An unavailable button stays exactly where it is and drops to
 * 40% ink rather than disappearing.
 */
export class McButton {
  readonly container: Phaser.GameObjects.Container;
  readonly #graphics: Phaser.GameObjects.Graphics;
  readonly #label: Phaser.GameObjects.Text;
  readonly #value: Phaser.GameObjects.Text | null;
  readonly #zone: Phaser.GameObjects.Zone;
  #options: McButtonOptions;
  #hovered = false;

  constructor(scene: Phaser.Scene, options: McButtonOptions) {
    this.#options = options;
    const { rect } = options;
    this.#graphics = scene.add.graphics();
    this.#label = scene.add
      .text(0, 0, caseOf(options.type, options.label), textStyle(options.type, 0))
      .setOrigin(0.5, 0.5);
    if (options.type.letterSpacing) this.#label.setLetterSpacing(options.type.letterSpacing);
    this.#value = options.value
      ? scene.add.text(0, 0, options.value, textStyle(options.type, 0)).setOrigin(0.5, 0.5)
      : null;

    this.#zone = scene.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      // Every control is at least the design's 44px touch target.
      .setInteractive({ useHandCursor: true });
    this.#zone.on("pointerover", () => {
      this.#hovered = true;
      this.redraw();
    });
    this.#zone.on("pointerout", () => {
      this.#hovered = false;
      this.redraw();
    });
    this.#zone.on("pointerup", () => {
      if (this.#options.enabled !== false) this.#options.onClick();
    });

    this.container = scene.add.container(0, 0, [this.#graphics, this.#label, ...(this.#value ? [this.#value] : []), this.#zone]);
    this.redraw();
  }

  /** The minimum height a control of this kind may be drawn at. */
  static minHeight(kind: WidgetKind): number {
    return kind === "primary" ? hit.primary : hit.target;
  }

  update(options: Partial<McButtonOptions>): void {
    this.#options = { ...this.#options, ...options };
    const { rect } = this.#options;
    this.#zone.setPosition(rect.x, rect.y).setSize(rect.width, rect.height);
    this.#zone.input?.hitArea.setSize(rect.width, rect.height);
    this.redraw();
  }

  get state(): WidgetState {
    if (this.#options.enabled === false) return "unavailable";
    if (this.#options.selected) return "selected";
    return this.#hovered ? "hover" : "rest";
  }

  get reason(): string | null {
    return this.#options.enabled === false ? (this.#options.reason ?? null) : null;
  }

  redraw(): void {
    const { rect, type } = this.#options;
    const state = this.state;
    const s = skin(this.#options.kind, state);
    this.#graphics.clear();
    paintPanel(this.#graphics, rect, this.#options.kind, state);

    const hasValue = this.#value !== null;
    this.#label
      .setText(caseOf(type, this.#options.label))
      .setColor(cssOf(s.text, s.textAlpha))
      .setPosition(rect.x + rect.width / 2 - (hasValue ? 10 : 0), rect.y + rect.height / 2);
    this.#value?.setColor(cssOf(s.text, s.textAlpha)).setPosition(rect.x + rect.width - 16, rect.y + rect.height / 2);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

/**
 * The red selection ring — the only shadow in the system. Static means a
 * committed choice; pulsing means the board is awaiting a tap.
 */
export class McSelectionRing {
  readonly graphics: Phaser.GameObjects.Graphics;
  #tween: Phaser.Tweens.Tween | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  show(rect: Rect, mode: "static" | "pulse", reducedMotion: boolean): void {
    const { offset, width, color, glowWidth, glowAlpha } = selectionRing;
    const outer: Rect = {
      x: rect.x - offset,
      y: rect.y - offset,
      width: rect.width + offset * 2,
      height: rect.height + offset * 2,
    };
    this.graphics.clear().setVisible(true).setAlpha(1);
    this.graphics.lineStyle(glowWidth, color.hex, glowAlpha);
    this.graphics.strokeRect(outer.x - 2, outer.y - 2, outer.width + 4, outer.height + 4);
    this.graphics.lineStyle(width, color.hex, 1);
    this.graphics.strokeRect(outer.x, outer.y, outer.width, outer.height);

    this.#tween?.remove();
    this.#tween = null;
    if (mode === "pulse" && !reducedMotion) {
      this.#tween = this.scene.tweens.add({
        targets: this.graphics,
        alpha: { from: 1, to: 0.45 },
        duration: selectionRing.pulseMs,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  hide(): void {
    this.#tween?.remove();
    this.#tween = null;
    this.graphics.clear().setVisible(false);
  }

  destroy(): void {
    this.#tween?.remove();
    this.graphics.destroy();
  }
}

/**
 * A dot grid, which marks the table felt and nothing else.
 *
 * Drawn as one `spacing`-sized texture and tiled. Filling a 1280×800 table at
 * the design's 6px spacing means ~28,000 dots; as individual `fillCircle`
 * calls in a Graphics object that overwhelms the renderer and the table draws
 * at the wrong size. One tiled texture is a single draw call at any size.
 */
export function paintDotGrid(
  scene: Phaser.Scene,
  rect: Rect,
  on: "paper" | "ink",
  spec: { readonly spacing: number; readonly radius: number; readonly alpha: number },
): Phaser.GameObjects.TileSprite {
  const key = `mc-dots-${on}-${spec.spacing}-${spec.radius}-${spec.alpha}`;
  if (!scene.textures.exists(key)) {
    // `addToScene: false` keeps the stencil out of the display list.
    const stencil = scene.make.graphics(undefined, false);
    stencil.fillStyle(on === "paper" ? surface.ink.hex : surface.paper.hex, spec.alpha);
    stencil.fillCircle(spec.spacing / 2, spec.spacing / 2, spec.radius);
    stencil.generateTexture(key, spec.spacing, spec.spacing);
    stencil.destroy();
  }
  return scene.add.tileSprite(rect.x, rect.y, rect.width, rect.height, key).setOrigin(0, 0);
}

/** A label in the design's 9/800 uppercase style, at the ink ladder's label step. */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  spec: TypeSpec,
  color: number,
  alpha: number = ink.label,
): Phaser.GameObjects.Text {
  const object = scene.add.text(x, y, caseOf(spec, text), textStyle(spec, color, alpha));
  if (spec.letterSpacing) object.setLetterSpacing(spec.letterSpacing);
  return object;
}

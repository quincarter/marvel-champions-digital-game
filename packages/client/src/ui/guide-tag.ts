/**
 * `McGuideTag` (guided mode G4c, `docs/guided-mode.md` §4): the small Bangers stamp with an ink border a lesson
 * step drops on its own target — `TRY THIS` on the control the step wants tapped (D01's Thwart button, P04's
 * Energy card), `GUIDE PICK` on a recommended choice (D02/P05's defend option). Both variants are caution yellow
 * (`guideTag`, `tokens.ts`) — neither is a rules warning nor the screen's one forward action.
 *
 * `update()` repositions in place rather than tearing down and rebuilding, because a tag's whole reason to exist
 * is staying attached while its target moves — a hand reflow, a tab switch, the choice sheet opening — and a
 * redraw-per-frame teardown would flash the stamp out and back on every one of those. Call `update()` again
 * whenever the target's rect changes; `hide()` when the step (or its anchor) goes away.
 */
import Phaser from "phaser";
import { border, guideTag, surface, typeRole, type TypeSpec } from "../tokens.js";
import { textStyle } from "./theme.js";
import type { Rect } from "../view/layout.js";

export type McGuideTagVariant = "tryThis" | "guidePick";

const LABEL: Readonly<Record<McGuideTagVariant, string>> = {
  tryThis: "TRY THIS",
  guidePick: "GUIDE PICK",
};

const STAMP_TYPE: TypeSpec = { ...typeRole.label, size: 10 };

export class McGuideTag {
  readonly #box: Phaser.GameObjects.Graphics;
  readonly #label: Phaser.GameObjects.Text;
  readonly #scene: Phaser.Scene;
  #variant: McGuideTagVariant;

  constructor(scene: Phaser.Scene, variant: McGuideTagVariant = "tryThis") {
    this.#scene = scene;
    this.#variant = variant;
    this.#box = scene.add.graphics();
    this.#label = scene.add
      .text(0, 0, LABEL[variant], textStyle(STAMP_TYPE, surface.ink.hex))
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.#box.setVisible(false);
  }

  setVariant(variant: McGuideTagVariant): void {
    if (this.#variant === variant) return;
    this.#variant = variant;
    this.#label.setText(LABEL[variant]);
  }

  get variant(): McGuideTagVariant {
    return this.#variant;
  }

  /** Repositions the stamp centered on `targetRect`'s top edge — straddling it, the way a real stamp sits on a
   * card's corner. Safe to call every draw: it only ever moves existing objects, never rebuilds them. */
  update(targetRect: Rect): void {
    const { fill, height, pad } = guideTag;
    const width = this.#label.width + pad * 2;
    const x = targetRect.x + targetRect.width / 2 - width / 2;
    const y = targetRect.y - height / 2;

    this.#box
      .clear()
      .setVisible(true)
      .fillStyle(fill.hex, 1)
      .fillRect(x, y, width, height)
      .lineStyle(border.object, surface.ink.hex, 1)
      .strokeRect(x, y, width, height);
    this.#label.setPosition(x + width / 2, y + height / 2).setVisible(true);

    this.#scene.children.bringToTop(this.#box);
    this.#scene.children.bringToTop(this.#label);
  }

  hide(): void {
    this.#box.clear().setVisible(false);
    this.#label.setVisible(false);
  }

  destroy(): void {
    this.#box.destroy();
    this.#label.destroy();
  }
}

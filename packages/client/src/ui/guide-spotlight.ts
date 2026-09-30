/**
 * `McGuideSpotlight` (guided mode G4c, `docs/guided-mode.md` §4): a dim layer over the board with a rectangular
 * cut-out around the current step's anchor, plus a thick yellow ring on the cut-out's own edge — "look here",
 * matching the design tiles' ring on the scheme panel (D01/P03) and the villain-phase defend sheet (D02/P05).
 *
 * The dim is four plain `fillRect`s around the cutout rather than a real stencil mask: the cutout is always an
 * axis-aligned rect (`view/guide-anchor.ts` never returns anything else), so a mask is machinery this widget
 * doesn't need — four bands stay trivial to reason about and cheap to redraw on every anchor change.
 *
 * No board wiring, no gating, and no lesson-model knowledge here — this widget only draws whatever rect it's
 * given. G5c (the guide controller) owns calling `show`/`hide` as the store updates and the anchor moves (a hand
 * reflow, a tab switch, the choice sheet opening); `scenes/guide-spotlight-demo.ts` exercises it standalone ahead
 * of that box existing.
 */
import Phaser from "phaser";
import { guideSpotlight } from "../tokens.js";
import type { Rect } from "../view/layout.js";

export class McGuideSpotlight {
  readonly #scene: Phaser.Scene;
  readonly #dim: Phaser.GameObjects.Graphics;
  readonly #ring: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    this.#dim = scene.add.graphics();
    this.#ring = scene.add.graphics();
    this.hide();
  }

  /**
   * Dims `viewport` outside `cutout`, and rings `cutout`'s edge. Brought to the top of the display list on every
   * call, so a redraw elsewhere on the board (a hand reflow, a status stamp) never buries this back under the
   * table.
   */
  show(viewport: Rect, cutout: Rect): void {
    const { dimAlpha, dimColor, ringWidth, ringOffset, ringColor } = guideSpotlight;

    this.#dim.clear().setVisible(true);
    this.#dim.fillStyle(dimColor.hex, dimAlpha);
    // Four bands around the cutout: top, bottom, left, right. Clamped at zero rather than going negative — a
    // cutout that overhangs the viewport (an anchor mid-transition) just shrinks its own band to nothing instead
    // of drawing a band the wrong way.
    const top = Math.max(0, cutout.y - viewport.y);
    const bottom = Math.max(0, viewport.y + viewport.height - (cutout.y + cutout.height));
    const left = Math.max(0, cutout.x - viewport.x);
    const right = Math.max(0, viewport.x + viewport.width - (cutout.x + cutout.width));
    if (top > 0) this.#dim.fillRect(viewport.x, viewport.y, viewport.width, top);
    if (bottom > 0) this.#dim.fillRect(viewport.x, cutout.y + cutout.height, viewport.width, bottom);
    if (left > 0) this.#dim.fillRect(viewport.x, cutout.y, left, cutout.height);
    if (right > 0) this.#dim.fillRect(cutout.x + cutout.width, cutout.y, right, cutout.height);

    this.#ring.clear().setVisible(true);
    const outer: Rect = {
      x: cutout.x - ringOffset,
      y: cutout.y - ringOffset,
      width: cutout.width + ringOffset * 2,
      height: cutout.height + ringOffset * 2,
    };
    this.#ring.lineStyle(ringWidth, ringColor.hex, 1).strokeRect(outer.x, outer.y, outer.width, outer.height);

    this.#scene.children.bringToTop(this.#dim);
    this.#scene.children.bringToTop(this.#ring);
  }

  hide(): void {
    this.#dim.clear().setVisible(false);
    this.#ring.clear().setVisible(false);
  }

  destroy(): void {
    this.#dim.destroy();
    this.#ring.destroy();
  }
}

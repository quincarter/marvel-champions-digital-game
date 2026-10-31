/**
 * The Phaser half of the guide highlight's glide (#552, `view/guide-glide.ts` holds where it is). Moves the widgets
 * of one draw in place frame by frame, so a glide costs no board redraw; a redraw stops this one and starts a fresh
 * one on its fresh widgets, from the same position.
 */
import Phaser from "phaser";
import { appSession } from "../session.js";
import { GuideGlide } from "../view/guide-glide.js";
import type { Rect } from "../view/layout.js";
import { McGuideTag, type McGuideTagVariant } from "./guide-tag.js";

/** The clock a glide runs on: the game's, since a scene's own `time.now` is stale until its first frame after a launch. */
export const glideNow = (scene: Phaser.Scene): number => scene.game.getTime();

/** Paints the rest of the glide under way, if there is one. Returns what stops it. */
export function runGuideGlide(scene: Phaser.Scene, glide: GuideGlide, paint: (rect: Rect) => void): () => void {
  const remaining = glide.remainingMs(glideNow(scene));
  if (remaining <= 0) return () => {};
  const tween = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: remaining,
    onUpdate: () => {
      const rect = glide.rectAt(glideNow(scene));
      if (rect) paint(rect);
    },
    onComplete: () => {
      const rect = glide.rectAt(Number.POSITIVE_INFINITY);
      if (rect) paint(rect);
    },
  });
  return () => tween.stop();
}

/**
 * A sheet's own stamp (`TRY THIS` on Inspect's Play, `GUIDE PICK` on a defend option): those scenes sit above Board, so
 * they draw their own `McGuideTag`, and it flies in from wherever the board's highlight was. One instance per opening
 * of the sheet, since a fresh opening is what glides in. Call `draw` from the sheet's rebuild, which destroys the tag.
 */
export class GuideStampGlide {
  readonly #glide = new GuideGlide();
  #started = false;
  #stop: (() => void) | null = null;

  /** Where the stamp is this moment, for a test to read mid-glide. */
  shownRect(scene: Phaser.Scene): Rect | null {
    return this.#glide.rectAt(glideNow(scene));
  }

  draw(scene: Phaser.Scene, variant: McGuideTagVariant, target: Rect, from: Rect | null): void {
    this.#stop?.();
    const now = glideNow(scene);
    if (!this.#started && from) this.#glide.seed(from, now);
    this.#started = true;
    const shown = this.#glide.place("stamp", target, now, !appSession().settings.reducedMotion);
    const tag = new McGuideTag(scene, variant);
    tag.update(shown);
    this.#stop = runGuideGlide(scene, this.#glide, (rect) => {
      if (!tag.alive) return;
      tag.leaveEntrance();
      tag.update(rect);
    });
  }
}

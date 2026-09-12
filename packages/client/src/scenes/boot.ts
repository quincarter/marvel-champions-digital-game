/**
 * Boot: load the fonts before any text is drawn, then hand off to Title.
 *
 * The design system's type rules are load-bearing — Bangers carries every
 * number the player reads at a glance — so drawing a screen in a fallback face
 * and swapping later would reflow the table. Phaser 4 can load a web font
 * directly, so the wait happens here and nowhere else.
 */

import Phaser from "phaser";
import { surface, typeRole, WEB_FONTS } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { SCENES } from "./keys.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    const { width, height } = this.scale.gameSize;
    this.add
      .text(width / 2, height / 2, "LOADING", textStyle(typeRole.label, surface.paper.hex, 0.6))
      .setOrigin(0.5)
      .setLetterSpacing(typeRole.label.letterSpacing);

    void this.#awaitFonts().then(() => this.scene.start(SCENES.title));
  }

  /**
   * Waits for the three families, but never blocks the game on the network: a
   * font that fails to arrive falls back rather than leaving a dead screen.
   */
  async #awaitFonts(): Promise<void> {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    try {
      await Promise.race([
        Promise.all(WEB_FONTS.map((face) => fonts.load(face))),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // A missing face is a cosmetic problem, not a reason not to start.
    }
  }
}

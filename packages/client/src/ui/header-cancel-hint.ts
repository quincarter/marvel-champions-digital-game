/**
 * The Cancel glyph (B, Esc) in an ink header bar, just after the title, for the screens whose close is a drawn × rather
 * than an `McButton` (How to play, How to win, the aspect lessons, New in each box). Pad and keyboard only: `GlyphHints`
 * draws nothing while the mouse or a finger is in use. It sits on the bar's own ink ground, level with the title.
 */
import type Phaser from "phaser";
import type { Rect } from "../view/layout.js";
import { specsForShortcuts, type GlyphHints } from "./glyph-hints.js";

export function hintCancelInHeader(hints: GlyphHints, header: Rect, title: Phaser.GameObjects.Text, height = 18): void {
  hints.custom(
    (set, snapshot) => (set === "pad" || set === "keyboard" ? specsForShortcuts(["cancel"], snapshot) : null),
    height,
    ({ height: h }) => {
      const at = title.getBounds();
      return { x: at.right + 14, y: header.y + (header.height - h) / 2 };
    },
    { ground: "ink" },
  );
}

/**
 * Draws the small outlined "BETA" tag (device sync, #276): a hero-red outline and wash with mono caps, decorative only.
 * Nothing in it is interactive, so a press on it goes to whatever control is under it. Shared by every screen that
 * wears it, behind the one `SHOW_BETA_TAGS` switch (`view/beta-tag.ts`).
 */
import type Phaser from "phaser";
import { accent, font, surface, typeRole } from "../tokens.js";
import { BETA_TAG_GAP, BETA_TAG_SIZE, BETA_TAG_TEXT, SHOW_BETA_TAGS } from "../view/beta-tag.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";

/** The tag with its left edge at `x` and vertically centred on `centerY`; returns its rect, or null when tags are off. */
export function drawBetaTag(scene: Phaser.Scene, x: number, centerY: number, depth?: number): Rect | null {
  if (!SHOW_BETA_TAGS) return null;
  const rect: Rect = {
    x: Math.round(x),
    y: Math.round(centerY - BETA_TAG_SIZE.height / 2),
    width: BETA_TAG_SIZE.width,
    height: BETA_TAG_SIZE.height,
  };
  const ground = scene.add.graphics();
  ground.fillStyle(accent.heroRed.hex, 0.28).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 4);
  ground.lineStyle(1.5, accent.heroRed.hex, 1).strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 4);
  const label = scene.add
    .text(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      BETA_TAG_TEXT,
      textStyle({ ...typeRole.mono, family: font.mono, size: 9, weight: 700, letterSpacing: 1 }, surface.paper.hex),
    )
    .setOrigin(0.5, 0.5);
  if (depth !== undefined) {
    ground.setDepth(depth);
    label.setDepth(depth);
  }
  return rect;
}

/** The tag just right of `text` (its bounds, wherever its origin is); null when tags are off or it would pass `maxRight`. */
export function drawBetaTagBeside(
  scene: Phaser.Scene,
  text: Phaser.GameObjects.Text,
  maxRight = Infinity,
): Rect | null {
  const bounds = text.getBounds();
  const x = bounds.right + BETA_TAG_GAP;
  if (x + BETA_TAG_SIZE.width > maxRight) return null;
  return drawBetaTag(scene, x, bounds.centerY, text.depth);
}

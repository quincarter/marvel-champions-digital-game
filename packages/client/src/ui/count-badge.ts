/**
 * A count badge: a small hero-red disc with a paper rim and the count in paper, hung on a control's top-right corner
 * (the Title's Mod Store button and storefront icon, for packs with an update: `packs/pack-updates.ts`). It is a
 * picture only, not a control: presses go through to the control under it. The number carries the meaning, so the
 * badge is never color alone.
 */
import Phaser from "phaser";
import { accent, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";

export interface CountBadge {
  destroy(): void;
}

/** The disc's diameter, and its width once the text needs more ("9+"). */
export const COUNT_BADGE_SIZE = 20;

/**
 * Hangs a badge reading `text` on `rect`'s top-right corner, its centre `inset` px in from the corner (so it overlaps
 * the control's rim and stays inside the screen when the control sits at its edge). `name` names the control.
 */
export function drawCountBadge(
  scene: Phaser.Scene,
  rect: Rect,
  text: string,
  options: { readonly name: string; readonly inset?: number; readonly depth?: number },
): CountBadge {
  const { inset = 4, depth = 3 } = options;
  const label = scene.add
    .text(0, 0, text, textStyle(typeRole.threatCount, surface.paper.hex))
    // The e2e suite finds a badge by its name (`count-badge:<control>`).
    .setName(`count-badge:${options.name}`)
    .setOrigin(0.5, 0.5)
    .setDepth(depth + 0.1);
  const height = COUNT_BADGE_SIZE;
  const width = Math.max(height, Math.ceil(label.width) + 10);
  const cx = rect.x + rect.width - inset;
  const cy = rect.y + inset;
  const graphics = scene.add.graphics().setDepth(depth);
  graphics.fillStyle(accent.heroRed.hex, 1).fillRoundedRect(cx - width / 2, cy - height / 2, width, height, height / 2);
  graphics
    .lineStyle(2, surface.paper.hex, 1)
    .strokeRoundedRect(cx - width / 2, cy - height / 2, width, height, height / 2);
  label.setPosition(cx, cy + 0.5);
  return {
    destroy: () => {
      graphics.destroy();
      label.destroy();
    },
  };
}

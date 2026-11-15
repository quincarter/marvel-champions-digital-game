/**
 * The Mod Store's storefront button (issue #734): a shop with a striped awning, in the Title's top row beside the
 * theme, language, music and Report buttons, on tablets and desktops. A phone's top row is full already, so there the
 * store is only the main-menu item. Drawn as the same ink chrome button as its neighbours (`scenes/theme-button.ts`):
 * ink with a paper rim, paper while hovered. A press is `onTap`'s, so a swipe's lift never fires it.
 */
import Phaser from "phaser";
import { surface } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { onTap } from "./tap.js";

/** A storefront `size` px across, centred on (cx, cy): a scalloped, striped awning over a shop with a door. */
export function drawStoreIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  ground: number,
): void {
  const half = size / 2;
  const left = cx - half;
  const top = cy - half;
  const line = Math.max(1.5, size / 11);
  // The awning: a band across the top, in four stripes, with a scalloped lower edge.
  const awningHeight = size * 0.34;
  const stripes = 4;
  const stripe = size / stripes;
  for (let i = 0; i < stripes; i += 1) {
    graphics.fillStyle(i % 2 === 0 ? color : ground, 1);
    graphics.fillRect(left + i * stripe, top, stripe, awningHeight);
    // Each stripe ends in a half-disc, the awning's scallop.
    graphics.fillCircle(left + i * stripe + stripe / 2, top + awningHeight, stripe / 2);
  }
  graphics.lineStyle(line, color, 1).strokeRect(left, top, size, awningHeight);
  // The shop under it: walls and a door.
  const bodyTop = top + awningHeight + stripe / 2 + line;
  const bodyInset = size * 0.1;
  graphics.lineStyle(line, color, 1);
  graphics.strokeRect(left + bodyInset, bodyTop, size - bodyInset * 2, top + size - bodyTop);
  const doorWidth = size * 0.26;
  graphics
    .fillStyle(color, 1)
    .fillRect(cx - doorWidth / 2, bodyTop + (top + size - bodyTop) * 0.3, doorWidth, (top + size - bodyTop) * 0.7);
}

export interface StoreIconButton {
  readonly rect: Rect;
  destroy(): void;
}

/** The storefront button at `rect`, calling `onPress` on a tap or click. */
export function drawStoreIconButton(scene: Phaser.Scene, rect: Rect, onPress: () => void): StoreIconButton {
  const graphics = scene.add.graphics().setDepth(2);
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setDepth(2)
    .setInteractive({ useHandCursor: true });
  let hovered = false;
  const draw = (): void => {
    graphics.clear();
    const ground = hovered ? surface.paper.hex : surface.ink.hex;
    const ink = hovered ? surface.ink.hex : surface.paper.hex;
    graphics.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    drawStoreIcon(
      graphics,
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      Math.min(20, Math.round(rect.height * 0.55)),
      ink,
      ground,
    );
  };
  zone.on("pointerover", () => {
    hovered = true;
    draw();
  });
  zone.on("pointerout", () => {
    hovered = false;
    draw();
  });
  onTap(zone, onPress, "mod-store-icon");
  draw();
  return {
    rect,
    destroy: () => {
      graphics.destroy();
      zone.destroy();
    },
  };
}

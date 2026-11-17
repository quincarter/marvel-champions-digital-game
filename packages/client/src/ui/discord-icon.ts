/**
 * The Discord button (issue #759): the community server's logo shape (a rounded game-pad face with two eyes), in the
 * Title's top row beside the theme, language, music and Report buttons (and the storefront, on a tablet or desktop). A
 * phone shows it only where the eyebrow leaves room, and keeps its small "Discord" footer link otherwise. Drawn as the
 * same ink chrome
 * button as its neighbours (`ui/store-icon.ts`); a press is `onTap`'s, so a swipe's lift never fires it. A hover (or a
 * keyboard/controller focus, `setFocused`) shows the label "Discord", since a glyph alone is not a name.
 */
import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "./theme.js";
import type { Rect } from "../view/layout.js";
import { onTap } from "./tap.js";

/** The words the button is named by, for its hover label. */
export const DISCORD_LABEL = "Discord";

/** The logo `size` px across, centred on (cx, cy): the face in `color`, its two eyes cut out in `ground`. */
export function drawDiscordIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  ground: number,
): void {
  const width = size;
  const height = size * 0.78;
  const left = cx - width / 2;
  const top = cy - height / 2;
  // The face: rounded on top, squarer at the bottom corners, as the logo is.
  graphics.fillStyle(color, 1);
  graphics.fillRoundedRect(left, top, width, height, {
    tl: size * 0.42,
    tr: size * 0.42,
    bl: size * 0.2,
    br: size * 0.2,
  });
  // The two small tabs at the bottom corners that make the logo's "feet".
  graphics.fillRect(left + width * 0.1, top + height * 0.8, width * 0.2, height * 0.3);
  graphics.fillRect(left + width * 0.7, top + height * 0.8, width * 0.2, height * 0.3);
  // The eyes.
  graphics.fillStyle(ground, 1);
  const eyeWidth = width * 0.17;
  const eyeHeight = height * 0.3;
  const eyeY = top + height * 0.55;
  graphics.fillEllipse(left + width * 0.31, eyeY, eyeWidth, eyeHeight);
  graphics.fillEllipse(left + width * 0.69, eyeY, eyeWidth, eyeHeight);
}

export interface DiscordIconButton {
  readonly rect: Rect;
  /** Shows the label while a focus ring (keyboard or controller) is on the button. */
  setFocused(focused: boolean): void;
  destroy(): void;
}

/** The Discord button at `rect`, calling `onPress` on a tap or click. */
export function drawDiscordIconButton(scene: Phaser.Scene, rect: Rect, onPress: () => void): DiscordIconButton {
  const graphics = scene.add.graphics().setDepth(2);
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setDepth(2)
    .setInteractive({ useHandCursor: true });
  const label = scene.add
    .text(0, 0, DISCORD_LABEL, textStyle(typeRole.label, surface.paper.hex))
    .setDepth(60)
    .setPadding(8, 4, 8, 4)
    .setBackgroundColor(cssOf(surface.ink.hex))
    .setVisible(false);
  let hovered = false;
  let focused = false;
  const draw = (): void => {
    graphics.clear();
    const ground = hovered ? surface.paper.hex : surface.ink.hex;
    const ink = hovered ? surface.ink.hex : surface.paper.hex;
    graphics.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    drawDiscordIcon(
      graphics,
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      Math.min(22, Math.round(rect.height * 0.6)),
      ink,
      ground,
    );
    // Hung above the button (under it, the label lands on the title), kept on screen.
    const screenWidth = scene.scale.gameSize.width;
    label
      .setPosition(
        Math.max(8, Math.min(rect.x + rect.width / 2 - label.width / 2, screenWidth - label.width - 8)),
        Math.max(2, rect.y - label.height - 4),
      )
      .setVisible(hovered || focused);
  };
  zone.on("pointerover", () => {
    hovered = true;
    draw();
  });
  zone.on("pointerout", () => {
    hovered = false;
    draw();
  });
  onTap(zone, onPress, "discord-icon");
  draw();
  return {
    rect,
    setFocused: (value) => {
      focused = value;
      draw();
    },
    destroy: () => {
      graphics.destroy();
      zone.destroy();
      label.destroy();
    },
  };
}

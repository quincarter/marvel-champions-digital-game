/**
 * The first player token (the physical game's token, art from the owner, 2026-10-16): drawn on whoever is first
 * player, with a soft shadow on the table under it, and flown to a new first player in the style the player picked
 * (`view/first-player-token-motion.ts`).
 *
 * The art is an SVG with only a viewBox, which a canvas can't size reliably, so it is fetched as text, given an
 * explicit size, and rasterized once into a texture every scene shares. Until that texture exists the token is a
 * plain red disc with "1st", so nothing waits on the file.
 */
import Phaser from "phaser";
import { accent, surface, typeRole } from "../tokens.js";
import { textStyle } from "./theme.js";
import { countTween } from "./bound-tween.js";
import type { FirstPlayerTokenMotion } from "../settings.js";
import {
  tokenMotionDurationMs,
  tokenMotionFrame,
  type Point,
  type TokenFrame,
} from "../view/first-player-token-motion.js";

export const FIRST_PLAYER_TOKEN_TEXTURE = "first-player-token";
const TEXTURE_PX = 192;
const TOKEN_URL = `${import.meta.env.BASE_URL}assets/first-player-token.svg`;

let loading: Promise<void> | null = null;

/** Starts rasterizing the token art into the shared texture (once per game), then calls `onReady` if `scene` is still running. */
export function ensureFirstPlayerTokenTexture(scene: Phaser.Scene, onReady?: () => void): boolean {
  const textures = scene.textures;
  if (textures.exists(FIRST_PLAYER_TOKEN_TEXTURE)) return true;
  if (!loading) {
    loading = fetch(TOKEN_URL)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`${response.status}`))))
      .then(
        (svg) =>
          new Promise<void>((resolve, reject) => {
            const sized = svg.replace("<svg ", `<svg width="${TEXTURE_PX}" height="${TEXTURE_PX}" `);
            const image = new Image();
            image.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = TEXTURE_PX;
              canvas.height = TEXTURE_PX;
              canvas.getContext("2d")?.drawImage(image, 0, 0, TEXTURE_PX, TEXTURE_PX);
              if (!textures.exists(FIRST_PLAYER_TOKEN_TEXTURE)) textures.addCanvas(FIRST_PLAYER_TOKEN_TEXTURE, canvas);
              resolve();
            };
            image.onerror = () => reject(new Error("token art did not decode"));
            image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
          }),
      )
      .catch(() => {
        // The disc stands in; a later request tries the file again.
        loading = null;
      });
  }
  void loading?.then(() => {
    if (onReady && scene.sys.isActive() && textures.exists(FIRST_PLAYER_TOKEN_TEXTURE)) onReady();
  });
  return false;
}

/** The token on the table: its shadow, and the token itself (art or stand-in disc) in a container it can turn and scale. */
export class FirstPlayerTokenView {
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly body: Phaser.GameObjects.Container;
  readonly #size: number;

  constructor(scene: Phaser.Scene, at: Point, size: number) {
    this.#size = size;
    this.shadow = scene.add.ellipse(at.x, at.y, size * 0.8, size * 0.28, surface.void.hex, 0.35);
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (scene.textures.exists(FIRST_PLAYER_TOKEN_TEXTURE)) {
      parts.push(scene.add.image(0, 0, FIRST_PLAYER_TOKEN_TEXTURE).setDisplaySize(size, size));
    } else {
      const disc = scene.add.graphics();
      disc.fillStyle(accent.heroRed.hex, 1).fillCircle(0, 0, size / 2 - 2);
      disc.lineStyle(3, surface.ink.hex, 1).strokeCircle(0, 0, size / 2 - 2);
      parts.push(
        disc,
        scene.add
          .text(0, 0, "1st", {
            ...textStyle(typeRole.label, surface.paper.hex),
            fontSize: `${Math.round(size * 0.34)}px`,
          })
          .setOrigin(0.5),
      );
    }
    this.body = scene.add.container(at.x, at.y, parts);
    this.place({ x: at.x, y: at.y, lift: 0, scaleX: 1, scaleY: 1, angle: 0 });
  }

  get active(): boolean {
    return this.body.active;
  }

  place(frame: TokenFrame): void {
    if (!this.body.active) return;
    this.body.setPosition(frame.x, frame.y).setScale(frame.scaleX, frame.scaleY).setAngle(frame.angle);
    // The shadow stays on the table, under where the token will come down, and fades as the token rises.
    const fade = Math.max(0.12, 1 - frame.lift / 160);
    this.shadow
      .setPosition(frame.x, frame.y + frame.lift + this.#size * 0.36)
      .setScale(fade, fade)
      .setAlpha(fade);
  }

  setDepth(depth: number): this {
    this.shadow.setDepth(depth);
    this.body.setDepth(depth);
    return this;
  }
}

/**
 * Flies `view` from `from` to `to` in `style`, starting `startProgress` of the way along (a redraw mid-flight picks
 * the flight up where it was). Calls `onLanded` when it comes to rest. An instant style just places it.
 */
export function flyFirstPlayerToken(
  scene: Phaser.Scene,
  view: FirstPlayerTokenView,
  from: Point,
  to: Point,
  style: FirstPlayerTokenMotion,
  options: { readonly startProgress?: number; readonly onLanded?: () => void } = {},
): void {
  const durationMs = tokenMotionDurationMs(style, from, to);
  const start = Math.min(1, Math.max(0, options.startProgress ?? 0));
  if (durationMs <= 0 || start >= 1) {
    view.place(tokenMotionFrame(style, from, to, 1));
    options.onLanded?.();
    return;
  }
  countTween(scene, view.body, {
    from: start,
    to: 1,
    durationMs: durationMs * (1 - start),
    ease: "Linear",
    onStep: (t) => {
      view.place(tokenMotionFrame(style, from, to, t));
      if (t >= 1) options.onLanded?.();
    },
  });
}

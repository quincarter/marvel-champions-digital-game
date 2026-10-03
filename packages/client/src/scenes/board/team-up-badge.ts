/**
 * The Team-Up badge: the pair's closeup in a circle with an accent ring, in the Board's top bar while the Team-Up is
 * active. Hovering shows "Team-Up active: Gambit and Rogue" under it; a click or tap opens the Team-Up panel
 * (`scenes/team-up-info.ts`), and so does the Board's T key (`scenes/board.ts`), the keyboard route to it.
 *
 * Drawn fresh with every board redraw like everything else on the table; which label is open lives on the scene.
 */
import type Phaser from "phaser";
import { ensurePictureLoaded, type Picture } from "../../art/pictures.js";
import { accent, surface, typeRole } from "../../tokens.js";
import { setMask } from "../../ui/rex.js";
import { textStyle } from "../../ui/theme.js";
import { badgeLabelRect, badgeSlots } from "../../view/team-up-layout.js";
import type { Rect } from "../../view/layout.js";

export interface TeamUpBadge {
  readonly key: string;
  /** "Gambit and Rogue". */
  readonly label: string;
  readonly picture: Picture;
}

export interface BadgeOptions {
  readonly badges: readonly TeamUpBadge[];
  /** The badge whose label is showing. */
  readonly hoverKey: string | null;
  /** Mouse hover, remembered so a redraw keeps the label (the badge itself shows and hides it; no redraw). */
  readonly onHover: (key: string | null) => void;
  /** A click or tap: open that Team-Up's panel. */
  readonly onOpen: (key: string) => void;
  /** Redraw once a closeup that was still loading arrives. */
  readonly onReady: () => void;
  /** Mask shapes the board destroys before its next draw. */
  readonly masks: Phaser.GameObjects.Graphics[];
}

const RING_WIDTH = 3;
/** How far the closeup is zoomed inside the circle, and how far down its picture the faces sit (0 top, 1 bottom). */
const BADGE_ZOOM = 1.7;
const BADGE_FOCUS_Y = 0.4;
const LABEL_DEPTH = 900;

/** The edge of the baked square: at least twice the largest circle's diameter, so it is only ever scaled down a little. */
const BAKED_SIZE = 112;

/**
 * The closeup, cropped square toward the faces (`BADGE_ZOOM`, `BADGE_FOCUS_Y`) and downscaled by halves into its own
 * small texture, once per picture. Returns that texture's key.
 */
export function bakedBadge(
  scene: Phaser.Scene,
  key: string,
  source: { width: number; height: number },
  bakedSize: number = BAKED_SIZE,
): string {
  const bakedKey = `${key}:badge:${bakedSize}`;
  if (scene.textures.exists(bakedKey)) return bakedKey;
  const image = scene.textures.get(key).getSourceImage() as CanvasImageSource;
  const side = Math.min(source.width, source.height) / BADGE_ZOOM;
  const cropX = (source.width - side) / 2;
  const cropY = Math.max(0, Math.min(source.height - side, source.height * BADGE_FOCUS_Y - side / 2));
  let size = Math.round(side);
  let canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")!.drawImage(image, cropX, cropY, side, side, 0, 0, size, size);
  while (size > bakedSize) {
    const next = Math.max(bakedSize, Math.round(size / 2));
    const half = document.createElement("canvas");
    half.width = half.height = next;
    const context = half.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(canvas, 0, 0, size, size, 0, 0, next, next);
    canvas = half;
    size = next;
  }
  scene.textures.addCanvas(bakedKey, canvas);
  return bakedKey;
}

/** Draws the badges right-aligned to `rightEdge` inside `bar`; returns the x the bar's other contents may use up to. */
export function drawTeamUpBadges(scene: Phaser.Scene, bar: Rect, rightEdge: number, options: BadgeOptions): number {
  const { slots, leftEdge } = badgeSlots(
    bar,
    rightEdge,
    options.badges.map((badge) => badge.key),
  );
  const viewport = scene.scale.gameSize;
  for (const slot of slots) {
    const badge = options.badges.find((candidate) => candidate.key === slot.key)!;
    const ground = scene.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillCircle(slot.cx, slot.cy, slot.radius);

    const key = ensurePictureLoaded(scene, badge.picture, options.onReady);
    if (key) {
      const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
      const box: Rect = {
        x: slot.cx - slot.radius,
        y: slot.cy - slot.radius,
        width: slot.radius * 2,
        height: slot.radius * 2,
      };
      // Baked once to a small square with the browser's own smoothing: sampling a 560px picture straight down to a
      // 40px chip aliases into noise on the GPU (no mipmaps), and the circle should read as two people.
      const baked = bakedBadge(scene, key, source);
      const image = scene.add.image(box.x, box.y, baked).setOrigin(0, 0).setDisplaySize(box.width, box.height);
      const mask = scene.make.graphics({}, false);
      mask.fillStyle(0xffffff).fillCircle(slot.cx, slot.cy, slot.radius);
      options.masks.push(mask);
      setMask(image, mask, "world");
    }

    const ring = scene.add.graphics();
    ring.lineStyle(RING_WIDTH, accent.heroRed.hex, 1).strokeCircle(slot.cx, slot.cy, slot.radius - RING_WIDTH / 2);

    // The label is always built and only shown or hidden: a hover must never redraw the board, because the redraw
    // rebuilds this very hit zone, and a click that follows the hover instantly would land on the destroyed one.
    const text = scene.add
      .text(0, 0, `Team-Up active: ${badge.label}`, textStyle(typeRole.label, surface.paper.hex))
      .setPadding(8, 5, 8, 5)
      .setDepth(LABEL_DEPTH + 1);
    const rect = badgeLabelRect(slot, { width: text.width, height: text.height }, viewport);
    text.setPosition(rect.x, rect.y);
    const plate = scene.add
      .graphics()
      .setDepth(LABEL_DEPTH)
      .fillStyle(surface.ink.hex, 1)
      .fillRect(rect.x, rect.y, rect.width, rect.height)
      .lineStyle(2, surface.paper.hex, 1)
      .strokeRect(rect.x, rect.y, rect.width, rect.height);
    const showLabel = (visible: boolean): void => {
      text.setVisible(visible);
      plate.setVisible(visible);
    };
    showLabel(options.hoverKey === slot.key);

    const hit = Math.max(slot.radius * 2, 32);
    scene.add
      .zone(slot.cx - hit / 2, slot.cy - hit / 2, hit, hit)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) return;
        showLabel(true);
        options.onHover(slot.key);
      })
      .on("pointerout", () => {
        showLabel(false);
        options.onHover(null);
      })
      .on("pointerdown", () => {
        showLabel(false);
        options.onOpen(slot.key);
      });
  }
  return leftEdge;
}

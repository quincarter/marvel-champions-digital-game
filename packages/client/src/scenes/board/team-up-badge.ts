/**
 * The Team-Up ring: the pair's closeup in a circle with an accent ring, on the hero panel of each seat providing one
 * of the pair's characters while the Team-Up is present (both in play in any form). Solid when Team-Up cards can be
 * played (both showing the hero side), quiet (dashed, desaturated, same size and place) when not. Hovering shows
 * "Team-Up active: Gambit and Rogue" (or "Team-Up: Gambit and Rogue · needs Rogue in hero form") under it; a
 * click or tap opens the Team-Up panel (`scenes/team-up-info.ts`), and so does the Board's T key (`scenes/board.ts`),
 * the keyboard route to it.
 *
 * Drawn fresh with every board redraw like everything else on the table; which label is open lives on the scene.
 */
import type Phaser from "phaser";
import { ensurePictureLoaded, type Picture } from "../../art/pictures.js";
import { accent, surface, typeRole } from "../../tokens.js";
import { setMask } from "../../ui/rex.js";
import { textStyle } from "../../ui/theme.js";
import { badgeLabelRect, type BadgeSlot } from "../../view/team-up-layout.js";
import { badgeFocusFor } from "../../art/team-up-art.js";
import type { Rect } from "../../view/layout.js";

export interface TeamUpBadge {
  readonly key: string;
  /** "Gambit and Rogue". */
  readonly label: string;
  readonly picture: Picture;
  /** Both characters show the hero side: the engine lets Team-Up cards be played. False draws the quiet ring. */
  readonly playable: boolean;
  /** Names in play on their alter-ego side (what the quiet ring's label says is needed). */
  readonly missing: readonly string[];
}

/** What every ring on a draw shares; `hoverId` is a ring's slot key (a pair on a panel), `onOpen` gets the pair's key. */
export interface RingOptions {
  readonly hoverId: string | null;
  /** Mouse hover, remembered so a redraw keeps the label (the ring shows and hides it itself; no redraw). */
  readonly onHover: (id: string | null) => void;
  /** A click or tap: open that Team-Up's panel. */
  readonly onOpen: (pairKey: string) => void;
  /** Redraw once a closeup that was still loading arrives. */
  readonly onReady: () => void;
  /** Mask shapes the board destroys before its next draw. */
  readonly masks: Phaser.GameObjects.Graphics[];
  /** Reports where a ring's pair can be focused by keyboard (the first ring of each pair); the board draws its focus ring there. */
  readonly onFocusRect?: (pairKey: string, rect: Rect) => void;
}

/** The rings for the board's panels: which pairs each seat provides, and how to draw them. */
export interface TeamUpRings extends RingOptions {
  readonly byPlayer: ReadonlyMap<string, readonly TeamUpBadge[]>;
  readonly tabbed: boolean;
}

const RING_WIDTH = 3;
const LABEL_DEPTH = 900;

/** The edge of the baked square: at least twice the largest circle's diameter, so it is only ever scaled down a little. */
const BAKED_SIZE = 128;

/**
 * The closeup, cropped to a square (the whole picture centered, unless `art/team-up-art.ts#badgeFocusFor` says
 * otherwise for this pair) and downscaled by halves into its own small texture, once per picture and size. Returns
 * that texture's key.
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
  const focus = badgeFocusFor(key);
  const side = Math.min(source.width, source.height) / focus.zoom;
  const cropX = Math.max(0, Math.min(source.width - side, source.width * focus.x - side / 2));
  const cropY = Math.max(0, Math.min(source.height - side, source.height * focus.y - side / 2));
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

/**
 * The closeup alone, in a circle on an ink ground, with the accent ring: what a ring is made of, and what the seat
 * screens' Team-Up pill wears. Nothing is interactive; `onReady` fires once a closeup still loading arrives.
 */
export function drawRingImage(
  scene: Phaser.Scene,
  slot: BadgeSlot,
  picture: Picture,
  masks: Phaser.GameObjects.Graphics[],
  onReady: () => void,
  quiet = false,
): void {
  const ground = scene.add.graphics();
  ground.fillStyle(surface.ink.hex, 1).fillCircle(slot.cx, slot.cy, slot.radius);
  const key = ensurePictureLoaded(scene, picture, onReady);
  if (key) {
    const source = scene.textures.get(key).getSourceImage() as { width: number; height: number };
    const box: Rect = {
      x: slot.cx - slot.radius,
      y: slot.cy - slot.radius,
      width: slot.radius * 2,
      height: slot.radius * 2,
    };
    // Baked once to a small square with the browser's own smoothing: sampling a large picture straight down to a
    // chip aliases into noise on the GPU (no mipmaps), and the circle should read as two people.
    const baked = bakedBadge(scene, key, source);
    const image = scene.add.image(box.x, box.y, baked).setOrigin(0, 0).setDisplaySize(box.width, box.height);
    // The quiet state is desaturated (grey tint) and faded, and its ring dashed: shape differs, never color alone.
    if (quiet) image.setTint(0x8c8c8c).setAlpha(0.6);
    const mask = scene.make.graphics({}, false);
    mask.fillStyle(0xffffff).fillCircle(slot.cx, slot.cy, slot.radius);
    masks.push(mask);
    setMask(image, mask, "world");
  }
  const ring = scene.add.graphics();
  ring.lineStyle(RING_WIDTH, accent.heroRed.hex, quiet ? 0.75 : 1);
  if (quiet) strokeDashedCircle(ring, slot.cx, slot.cy, slot.radius - RING_WIDTH / 2);
  else ring.strokeCircle(slot.cx, slot.cy, slot.radius - RING_WIDTH / 2);
}

/** A circle drawn as evenly spaced arcs with gaps: the quiet ring, the same size and place as the solid one. */
function strokeDashedCircle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  const dashes = 12;
  const step = (Math.PI * 2) / dashes;
  for (let i = 0; i < dashes; i++) {
    g.beginPath();
    g.arc(cx, cy, r, i * step, i * step + step * 0.58);
    g.strokePath();
  }
}

/** The hover label: "Team-Up active: ..." when playable, else which character still needs the hero side. */
export function ringLabel(badge: Pick<TeamUpBadge, "label" | "playable" | "missing">): string {
  if (badge.playable) return `Team-Up active: ${badge.label}`;
  const needs = badge.missing.length > 0 ? ` · needs ${badge.missing.join(" and ")} in hero form` : "";
  return `Team-Up: ${badge.label}${needs}`;
}

/**
 * One ring: the closeup in a circle with the accent ring, a hover label, and a click target. The label is always
 * built and only shown or hidden: a hover must never redraw the board, because the redraw rebuilds this very hit
 * zone, and a click that follows the hover instantly would land on the destroyed one.
 */
export function drawTeamUpRing(scene: Phaser.Scene, slot: BadgeSlot, badge: TeamUpBadge, options: RingOptions): void {
  const viewport = scene.scale.gameSize;
  drawRingImage(scene, slot, badge.picture, options.masks, options.onReady, !badge.playable);
  const text = scene.add
    .text(0, 0, ringLabel(badge), textStyle(typeRole.label, surface.paper.hex))
    .setPadding(8, 5, 8, 5)
    .setName(`teamUpRingLabel:${slot.key}`)
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
  showLabel(options.hoverId === slot.key);

  const hit = Math.max(slot.radius * 2, 32);
  options.onFocusRect?.(badge.key, {
    x: slot.cx - slot.radius - 2,
    y: slot.cy - slot.radius - 2,
    width: slot.radius * 2 + 4,
    height: slot.radius * 2 + 4,
  });
  scene.add
    .zone(slot.cx - hit / 2, slot.cy - hit / 2, hit, hit)
    .setOrigin(0, 0)
    // Named so `__mcBoardDebug.teamUpRings` (dev e2e hook) can find each ring's click target on the display list.
    .setName(`teamUpRing:${slot.key}`)
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
      options.onOpen(badge.key);
    });
}

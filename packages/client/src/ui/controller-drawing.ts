/**
 * Draws one controller (`view/controller-shapes.ts`: Xbox, DualSense-style, a Joy-Con grip, a Steam Deck) scaled into
 * a rect, with each button wearing the label its family prints there (`view/pad-family.ts#padGlyphOf`). Labels are
 * positional: a Nintendo pad prints B at the bottom whatever the layout swap says; the swap only changes what a press
 * does, which the list beside the drawing shows.
 *
 * Returns every object it made, so a caller can parent them into a scroll region's content container.
 */
import Phaser from "phaser";
import { font } from "../tokens.js";
import type { DrawingKind } from "../view/controls-rows.js";
import { CONTROLLER_SHAPES, type ShapeOp } from "../view/controller-shapes.js";
import { padGlyphOf, type PadFamily } from "../view/pad-family.js";
import { flattenPath } from "../view/svg-path.js";
import { textStyle } from "./theme.js";

/** The drawing's labels by the reference the shapes use. */
const LABEL_INDEX: Readonly<Record<string, number>> = {
  $f0: 0,
  $f1: 1,
  $f2: 2,
  $f3: 3,
  $lb: 4,
  $rb: 5,
  $lt: 6,
  $rt: 7,
  $view: 8,
  $menu: 9,
};

/** The smallest label that stays readable when a phone shrinks the drawing. */
const MIN_FONT = 8;

/** Controllers drawn from a picture instead of vector shapes: texture key and file (`public/assets/controllers/`). */
const IMAGES: Readonly<Record<string, { readonly key: string; readonly url: string }>> = {
  xbox: { key: "controller-xbox", url: `${import.meta.env.BASE_URL}assets/controllers/xbox.png` },
  switch: { key: "controller-switch", url: `${import.meta.env.BASE_URL}assets/controllers/switch.png` },
  playstation: {
    key: "controller-playstation",
    url: `${import.meta.env.BASE_URL}assets/controllers/playstation.png`,
  },
};

/** The picture a drawing kind uses, or null for a vector drawing. */
function imageOf(kind: DrawingKind): { readonly key: string; readonly url: string } | null {
  return kind === "xbox"
    ? IMAGES["xbox"]!
    : kind === "playstation"
      ? IMAGES["playstation"]!
      : kind === "nintendo"
        ? IMAGES["switch"]!
        : null;
}

/** Keys of pictures that failed to load, so a missing file is reported once instead of retried in a loop. */
const failed = new Set<string>();

export type PictureState = "ready" | "loading" | "failed" | "none";

/** Loads the picture for the drawing being shown (only that one); `onReady` fires once it has landed. */
export function ensureControllerImage(scene: Phaser.Scene, kind: DrawingKind, onReady: () => void): PictureState {
  const image = imageOf(kind);
  if (image === null) return "none";
  if (scene.textures.exists(image.key)) return "ready";
  if (failed.has(image.key)) return "failed";
  scene.load.image(image.key, image.url);
  scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: { key: string }) => failed.add(file.key));
  scene.load.once(Phaser.Loader.Events.COMPLETE, onReady);
  if (!scene.load.isLoading()) scene.load.start();
  return "loading";
}

export function labelOf(ref: string, family: PadFamily): string {
  const index = LABEL_INDEX[ref];
  if (index === undefined) return ref;
  return padGlyphOf(family, index)?.label ?? "";
}

export function drawController(
  scene: Phaser.Scene,
  rect: { readonly x: number; readonly y: number; readonly width: number },
  kind: DrawingKind,
  family: PadFamily,
): Phaser.GameObjects.GameObject[] {
  const shape = CONTROLLER_SHAPES[kind];
  const scale = rect.width / shape.width;
  let g = scene.add.graphics();
  const made: Phaser.GameObjects.GameObject[] = [g];
  const sx = (v: number): number => rect.x + v * scale;
  const sy = (v: number): number => rect.y + v * scale;
  for (const op of shape.ops) {
    if (op.k === "image") {
      const image = IMAGES[op.src]!;
      if (scene.textures.exists(image.key)) {
        made.push(
          scene.add
            .image(sx(op.x), sy(op.y), image.key)
            .setOrigin(0, 0)
            .setDisplaySize(op.w * scale, op.h * scale),
        );
        // Shapes after a picture draw over it: a fresh Graphics sits above the image in the display list.
        g = scene.add.graphics();
        made.push(g);
      }
      continue;
    }
    if (op.k === "text") {
      made.push(drawText(scene, op, family, sx, sy, scale));
      continue;
    }
    drawShape(g, op, sx, sy, scale);
  }
  return made;
}

function drawText(
  scene: Phaser.Scene,
  op: Extract<ShapeOp, { k: "text" }>,
  family: PadFamily,
  sx: (v: number) => number,
  sy: (v: number) => number,
  scale: number,
): Phaser.GameObjects.Text {
  const size = Math.max(MIN_FONT, Math.round(op.size * scale));
  const text = scene.add.text(
    sx(op.x),
    sy(op.y),
    labelOf(op.text, family),
    textStyle(
      {
        family: op.display ? font.display : font.body,
        size,
        weight: op.weight === 800 ? 800 : op.weight === 700 ? 800 : 400,
        lineHeight: 1,
        letterSpacing: op.spacing ? op.spacing * scale : 0,
        uppercase: false,
      },
      op.color,
      op.alpha ?? 1,
    ),
  );
  // The shapes give a baseline; a Text's origin sits a little above its bottom edge.
  text.setOrigin(op.anchor === "middle" ? 0.5 : op.anchor === "end" ? 1 : 0, 0.82);
  return text;
}

function drawShape(
  g: Phaser.GameObjects.Graphics,
  op: Exclude<ShapeOp, { k: "text" | "image" }>,
  sx: (v: number) => number,
  sy: (v: number) => number,
  scale: number,
): void {
  const alpha = op.alpha ?? 1;
  const fill = (): void => {
    if (op.fill !== undefined) g.fillStyle(op.fill, alpha);
  };
  const line = (): boolean => {
    if (op.stroke === undefined) return false;
    g.lineStyle(Math.max(1, (op.sw ?? 1) * scale), op.stroke, alpha);
    return true;
  };
  switch (op.k) {
    case "circle":
      fill();
      if (op.fill !== undefined) g.fillCircle(sx(op.cx), sy(op.cy), op.r * scale);
      if (line()) g.strokeCircle(sx(op.cx), sy(op.cy), op.r * scale);
      break;
    case "rect": {
      const x = sx(op.x);
      const y = sy(op.y);
      const w = op.w * scale;
      const h = op.h * scale;
      const radius = (op.rx ?? 0) * scale;
      fill();
      if (op.fill !== undefined) {
        if (radius > 0) g.fillRoundedRect(x, y, w, h, radius);
        else g.fillRect(x, y, w, h);
      }
      if (line()) {
        if (op.dash)
          dashPolyline(g, [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h), pt(x, y)], op.dash, scale);
        else if (radius > 0) g.strokeRoundedRect(x, y, w, h, radius);
        else g.strokeRect(x, y, w, h);
      }
      break;
    }
    case "line":
      if (line()) g.lineBetween(sx(op.x1), sy(op.y1), sx(op.x2), sy(op.y2));
      break;
    case "path":
      for (const sub of flattenPath(op.d)) {
        const points = sub.points.map((p) => pt(sx(p.x), sy(p.y)));
        if (op.fill !== undefined && points.length > 2) {
          g.fillStyle(op.fill, alpha);
          g.fillPoints(points, true);
        }
        if (line()) g.strokePoints(sub.closed ? [...points, points[0]!] : points, false);
      }
      break;
  }
}

const pt = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x, y);

function dashPolyline(
  g: Phaser.GameObjects.Graphics,
  points: readonly Phaser.Math.Vector2[],
  dash: readonly [number, number],
  scale: number,
): void {
  const on = dash[0] * scale;
  const gap = dash[1] * scale;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / length;
    const dy = (b.y - a.y) / length;
    for (let at = 0; at < length; at += on + gap) {
      const end = Math.min(at + on, length);
      g.lineBetween(a.x + dx * at, a.y + dy * at, a.x + dx * end, a.y + dy * end);
    }
  }
}

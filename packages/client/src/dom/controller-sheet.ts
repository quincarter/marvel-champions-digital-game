/**
 * The controller drawing of the Controls screen (`view/controller-shapes.ts`) as parts of an `mc-sheet`: its shapes and
 * labels as one inline SVG (the labels stay text nodes), and each button's picture as an `mc-glyph` laid over the
 * drawing where the shape's label box is. The geometry is the Phaser drawing's, scaled the same way.
 */
import { layoutGlyph, measureGlyphText, type SvgOp } from "@mc/ui";
import { font } from "../tokens.js";
import { CONTROLLER_SHAPES, type ShapeOp } from "../view/controller-shapes.js";
import { t } from "../i18n/translate.js";
import { LABEL_INDEX, controllerImageUrl, controllerPictureOf, labelOf } from "../view/controller-labels.js";
import type { DrawingKind } from "../view/controls-rows.js";
import { uiSpecOf } from "../view/glyph-ui-spec.js";
import { padGlyphSpec } from "../view/input-glyph-model.js";
import type { PadFamily } from "../view/pad-family.js";
import { padGlyphArtOf } from "../view/pad-glyph-art.js";
import { sheetColor, type SheetBuilder } from "./sheet-builder.js";

/** The smallest label that stays readable when a phone shrinks the drawing. */
const MIN_FONT = 8;
const BODY_MEASURE = (label: string, size: number): number =>
  measureGlyphText(label, size, `"${font.body}", sans-serif`);

/** The height the drawing takes in a column `width` wide. */
export function controllerDrawingHeight(kind: DrawingKind, width: number): number {
  const shape = CONTROLLER_SHAPES[kind];
  return shape.height * (width / shape.width);
}

interface Styled {
  readonly fill?: number | undefined;
  readonly stroke?: number | undefined;
  readonly sw?: number | undefined;
  readonly alpha?: number | undefined;
  readonly dash?: readonly [number, number] | undefined;
}

/** A stroke never draws thinner than one screen pixel, as the Phaser drawing floored it (`max(1, sw * scale)`). */
function styleOf(op: Styled, scale: number): Record<string, unknown> {
  return {
    ...(op.fill !== undefined ? { fill: sheetColor(op.fill, "fill") } : {}),
    ...(op.stroke !== undefined ? { stroke: sheetColor(op.stroke, "line") } : {}),
    ...(op.stroke !== undefined ? { sw: Math.max(op.sw ?? 1, 1 / scale) } : {}),
    ...(op.alpha !== undefined ? { alpha: op.alpha } : {}),
    ...(op.dash ? { dash: op.dash } : {}),
  };
}

/** Draws the controller for `kind` wearing `family`'s labels into `rect` (its width sets the scale). */
export function drawControllerSheet(
  b: SheetBuilder,
  rect: { readonly x: number; readonly y: number; readonly width: number },
  kind: DrawingKind,
  family: PadFamily,
): void {
  const shape = CONTROLLER_SHAPES[kind];
  const scale = rect.width / shape.width;
  const ops: SvgOp[] = [];
  const glyphs: { x: number; y: number; height: number; maxWidth: number; index: number }[] = [];
  for (let i = 0; i < shape.ops.length; i++) {
    const op: ShapeOp = shape.ops[i]!;
    const label = shape.ops[i + 1];
    if (op.k === "rect" && label?.k === "text") {
      const index = LABEL_INDEX[label.text];
      if (index !== undefined && padGlyphArtOf(family, index) !== null) {
        // The box and its label give way to the button's picture, centered on the box and a little larger than it.
        glyphs.push({
          x: rect.x + (op.x + op.w / 2) * scale,
          y: rect.y + (op.y + op.h / 2) * scale,
          height: op.h * 1.2 * scale,
          maxWidth: op.w * 1.2 * scale,
          index,
        });
        i++;
        continue;
      }
    }
    switch (op.k) {
      case "image":
        ops.push({ k: "image", href: controllerImageUrl(op.src), x: op.x, y: op.y, w: op.w, h: op.h });
        break;
      case "text":
        ops.push({
          k: "text",
          x: op.x,
          y: op.y,
          text: labelOf(op.text, family),
          size: Math.max(op.size, MIN_FONT / scale),
          weight: op.weight === 800 || op.weight === 700 ? 800 : 400,
          anchor: op.anchor,
          fill: sheetColor(op.color, "text"),
          ...(op.alpha !== undefined ? { alpha: op.alpha } : {}),
          ...(op.spacing ? { spacing: op.spacing } : {}),
          font: op.display ? "display" : "body",
        });
        break;
      case "rect":
        ops.push({
          k: "rect",
          x: op.x,
          y: op.y,
          w: op.w,
          h: op.h,
          ...(op.rx ? { rx: op.rx } : {}),
          ...styleOf(op, scale),
        });
        break;
      case "circle":
        ops.push({ k: "circle", cx: op.cx, cy: op.cy, r: op.r, ...styleOf(op, scale) });
        break;
      case "line":
        ops.push({ k: "line", x1: op.x1, y1: op.y1, x2: op.x2, y2: op.y2, ...styleOf(op, scale) });
        break;
      case "path":
        ops.push({ k: "path", d: op.d, ...styleOf(op, scale) });
        break;
    }
  }
  b.svg(
    { x: rect.x, y: rect.y, width: rect.width, height: shape.height * scale },
    [shape.width, shape.height],
    ops,
    "controller",
    controllerPictureOf(kind) === null ? undefined : t("controls.pictureFailed"),
  );
  for (const glyph of glyphs) {
    const spec = padGlyphSpec(glyph.index, family, false);
    if (!spec) continue;
    const ui = uiSpecOf(spec);
    const laid = layoutGlyph([ui], glyph.height, BODY_MEASURE);
    const fit = Math.min(1, glyph.maxWidth / laid.fullWidth);
    const height = glyph.height * fit;
    const width = layoutGlyph([ui], height, BODY_MEASURE).fullWidth;
    b.glyph({ x: glyph.x - width / 2, y: glyph.y, specs: [ui], height, ground: "paper", openness: 1, still: true });
  }
}

/**
 * The controller drawing of the Controls screen (`view/controller-shapes.ts`) as plain data for `mc-controller-diagram`:
 * the shapes and labels as `SvgOp`s in the drawing's own units, and each button's picture as a glyph to lay over the
 * drawing where the shape's label box is. A button that has a picture in the family's set gives its box and label way
 * to it, centred on the box and a little larger than it. Nothing is drawn here and nothing is scaled: the element knows
 * how wide it is.
 */
import type { GlyphSpec as UiGlyphSpec, SvgOp } from "@mc/ui";
import { t } from "../i18n/translate.js";
import { sheetColor } from "../dom/sheet-builder.js";
import { CONTROLLER_SHAPES, type ShapeOp } from "./controller-shapes.js";
import { LABEL_INDEX, controllerImageUrl, controllerPictureOf, labelOf } from "./controller-labels.js";
import type { DrawingKind } from "./controls-rows.js";
import { uiSpecOf } from "./glyph-ui-spec.js";
import { padGlyphSpec } from "./input-glyph-model.js";
import type { PadFamily } from "./pad-family.js";
import { padGlyphArtOf } from "./pad-glyph-art.js";

/** The smallest label that stays readable when a phone shrinks the drawing (px on screen). */
export const MIN_DIAGRAM_FONT = 8;

/** A button's picture laid over the drawing, in the drawing's units (the element scales them). */
export interface DiagramGlyph {
  /** Its centre. */
  readonly x: number;
  readonly y: number;
  /** The height the picture would take, and the widest it may be. */
  readonly height: number;
  readonly maxWidth: number;
  readonly spec: UiGlyphSpec;
}

export interface ControllerDiagram {
  readonly viewBox: readonly [number, number];
  readonly ops: readonly SvgOp[];
  readonly glyphs: readonly DiagramGlyph[];
  /** Said over the drawing when its picture fails to load, or undefined when it has none. */
  readonly missing: string | undefined;
}

interface Styled {
  readonly fill?: number | undefined;
  readonly stroke?: number | undefined;
  readonly sw?: number | undefined;
  readonly alpha?: number | undefined;
  readonly dash?: readonly [number, number] | undefined;
}

/** A stroke never draws thinner than one screen pixel (`max(1, sw * scale)`): the element passes its scale in `minStroke`. */
function styleOf(op: Styled): Record<string, unknown> {
  return {
    ...(op.fill !== undefined ? { fill: sheetColor(op.fill, "fill") } : {}),
    ...(op.stroke !== undefined ? { stroke: sheetColor(op.stroke, "line") } : {}),
    ...(op.stroke !== undefined ? { sw: op.sw ?? 1 } : {}),
    ...(op.alpha !== undefined ? { alpha: op.alpha } : {}),
    ...(op.dash ? { dash: op.dash } : {}),
  };
}

/** The controller for `kind` wearing `family`'s labels. */
export function controllerDiagramOf(kind: DrawingKind, family: PadFamily): ControllerDiagram {
  const shape = CONTROLLER_SHAPES[kind];
  const ops: SvgOp[] = [];
  const glyphs: DiagramGlyph[] = [];
  for (let i = 0; i < shape.ops.length; i++) {
    const op: ShapeOp = shape.ops[i]!;
    const label = shape.ops[i + 1];
    if (op.k === "rect" && label?.k === "text") {
      const index = LABEL_INDEX[label.text];
      if (index !== undefined && padGlyphArtOf(family, index) !== null) {
        const spec = padGlyphSpec(index, family, false);
        if (spec) {
          glyphs.push({
            x: op.x + op.w / 2,
            y: op.y + op.h / 2,
            height: op.h * 1.2,
            maxWidth: op.w * 1.2,
            spec: uiSpecOf(spec),
          });
          i++;
          continue;
        }
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
          size: op.size,
          weight: op.weight === 800 || op.weight === 700 ? 800 : 400,
          anchor: op.anchor,
          fill: sheetColor(op.color, "text"),
          ...(op.alpha !== undefined ? { alpha: op.alpha } : {}),
          ...(op.spacing ? { spacing: op.spacing } : {}),
          font: op.display ? "display" : "body",
        });
        break;
      case "rect":
        ops.push({ k: "rect", x: op.x, y: op.y, w: op.w, h: op.h, ...(op.rx ? { rx: op.rx } : {}), ...styleOf(op) });
        break;
      case "circle":
        ops.push({ k: "circle", cx: op.cx, cy: op.cy, r: op.r, ...styleOf(op) });
        break;
      case "line":
        ops.push({ k: "line", x1: op.x1, y1: op.y1, x2: op.x2, y2: op.y2, ...styleOf(op) });
        break;
      case "path":
        ops.push({ k: "path", d: op.d, ...styleOf(op) });
        break;
    }
  }
  return {
    viewBox: [shape.width, shape.height],
    ops,
    glyphs,
    missing: controllerPictureOf(kind) === null ? undefined : t("controls.pictureFailed"),
  };
}

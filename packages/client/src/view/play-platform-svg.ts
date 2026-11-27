/**
 * A platform mark (`view/play-platform-mark.ts`) as the shapes of a `SheetSvg` drawing on its own 24 x 24 grid, one flat
 * color: the same icon `ui/play-platform-icon.ts` strokes with Phaser Graphics, for a screen drawn as a Lit panel.
 */
import type { SvgOp } from "@mc/ui";
import { ICON_GRID, type PlayPlatformMark } from "./play-platform-mark.js";

/** The grid's size, as the drawing's `viewBox`. */
export const PLATFORM_ICON_VIEWBOX = [ICON_GRID, ICON_GRID] as const;

/** `mark`'s strokes and fills in `color` (a CSS color) at `alpha`. */
export function playPlatformSvgOps(mark: PlayPlatformMark, color: string, alpha = 1): SvgOp[] {
  return mark.shapes.map((shape): SvgOp => {
    switch (shape.kind) {
      case "ring":
        return { k: "circle", cx: shape.cx, cy: shape.cy, r: shape.r, stroke: color, sw: shape.w, alpha };
      case "ellipse":
        // An ellipse as two arcs, since the drawing has no ellipse shape of its own.
        return {
          k: "path",
          d: `M${shape.cx - shape.rx} ${shape.cy}a${shape.rx} ${shape.ry} 0 1 0 ${shape.rx * 2} 0a${shape.rx} ${shape.ry} 0 1 0 ${-shape.rx * 2} 0`,
          stroke: color,
          sw: shape.w,
          alpha,
        };
      case "line":
        return { k: "line", x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2, stroke: color, sw: shape.w, alpha };
      case "box":
        return {
          k: "rect",
          x: shape.x,
          y: shape.y,
          w: shape.width,
          h: shape.height,
          stroke: color,
          sw: shape.w,
          alpha,
        };
      case "fillBox":
        return { k: "rect", x: shape.x, y: shape.y, w: shape.width, h: shape.height, fill: color, alpha };
      case "dot":
        return { k: "circle", cx: shape.cx, cy: shape.cy, r: shape.r, fill: color, alpha };
    }
  });
}

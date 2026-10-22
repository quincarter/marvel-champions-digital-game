/**
 * Draws a platform mark (`view/play-platform-mark.ts`) with Graphics, one flat color, like `ui/music-icon.ts`.
 */
import type Phaser from "phaser";
import type { PlayPlatformMark } from "../view/play-platform-mark.js";
import { ICON_GRID } from "../view/play-platform-mark.js";
import type { Rect } from "../view/layout.js";

/** Strokes and fills `mark` into `box` (a square) in `color`. Clears nothing: the caller owns the Graphics. */
export function drawPlayPlatformIcon(
  graphics: Phaser.GameObjects.Graphics,
  mark: PlayPlatformMark,
  box: Rect,
  color: number,
  alpha = 1,
): void {
  const unit = box.width / ICON_GRID;
  const x = (value: number): number => box.x + value * unit;
  const y = (value: number): number => box.y + value * unit;
  for (const shape of mark.shapes) {
    switch (shape.kind) {
      case "ring":
        graphics.lineStyle(shape.w * unit, color, alpha).strokeCircle(x(shape.cx), y(shape.cy), shape.r * unit);
        break;
      case "ellipse":
        graphics
          .lineStyle(shape.w * unit, color, alpha)
          .strokeEllipse(x(shape.cx), y(shape.cy), shape.rx * 2 * unit, shape.ry * 2 * unit);
        break;
      case "line":
        graphics
          .lineStyle(shape.w * unit, color, alpha)
          .lineBetween(x(shape.x1), y(shape.y1), x(shape.x2), y(shape.y2));
        break;
      case "box":
        graphics
          .lineStyle(shape.w * unit, color, alpha)
          .strokeRect(x(shape.x), y(shape.y), shape.width * unit, shape.height * unit);
        break;
      case "fillBox":
        graphics.fillStyle(color, alpha).fillRect(x(shape.x), y(shape.y), shape.width * unit, shape.height * unit);
        break;
      case "dot":
        graphics.fillStyle(color, alpha).fillCircle(x(shape.cx), y(shape.cy), shape.r * unit);
        break;
    }
  }
}

/**
 * The "open a file" mark (#858): an open folder, drawn rather than set as a glyph so it sits the same on every device
 * font. Past games' Open a replay file button wears it, so the button reads as "open a file" at a glance.
 */
import Phaser from "phaser";

/** An open folder `size` px tall, centred on (`cx`, `cy`). */
export function drawOpenFileIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
): void {
  const u = size / 20;
  const left = cx - u * 10;
  const right = cx + u * 10;
  const top = cy - u * 7;
  const bottom = cy + u * 7;
  const line = Math.max(1.5, u * 2);
  graphics.lineStyle(line, color, 1);
  // The folder's back, with its tab.
  graphics.strokePoints(
    [
      new Phaser.Math.Vector2(left, bottom),
      new Phaser.Math.Vector2(left, top),
      new Phaser.Math.Vector2(left + u * 7, top),
      new Phaser.Math.Vector2(left + u * 9, top + u * 2.5),
      new Phaser.Math.Vector2(right - u * 2, top + u * 2.5),
      new Phaser.Math.Vector2(right - u * 2, top + u * 5),
    ],
    false,
  );
  // Its front, swung open and filled.
  graphics.fillStyle(color, 1);
  graphics.fillPoints(
    [
      new Phaser.Math.Vector2(left, bottom),
      new Phaser.Math.Vector2(left + u * 4, top + u * 5),
      new Phaser.Math.Vector2(right, top + u * 5),
      new Phaser.Math.Vector2(right - u * 4, bottom),
    ],
    true,
  );
}

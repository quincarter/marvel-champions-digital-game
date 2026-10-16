/**
 * The music mark (#191), drawn rather than set as a glyph so it sits the same on every device font: the music button,
 * its "Now playing" notification and the music player all wear it.
 */
import Phaser from "phaser";

/** Two beamed eighth notes, `size` px tall, centred on (`cx`, `cy`): the universal "music" mark. */
export function drawMusicIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
): void {
  const unit = size / 20;
  const stem = Math.max(1.5, unit * 2);
  const head = { width: unit * 7, height: unit * 5 };
  const left = { x: cx - unit * 5, y: cy + unit * 6.5 };
  const right = { x: cx + unit * 5, y: cy + unit * 4.5 };
  graphics.fillStyle(color, 1);
  graphics.fillEllipse(left.x, left.y, head.width, head.height);
  graphics.fillEllipse(right.x, right.y, head.width, head.height);
  // Stems up from each head's right side, joined by a slanted beam.
  const leftStem = left.x + head.width / 2 - stem / 2;
  const rightStem = right.x + head.width / 2 - stem / 2;
  const leftTop = cy - unit * 9;
  const rightTop = cy - unit * 11;
  graphics.fillRect(leftStem - stem / 2, leftTop, stem, left.y - leftTop);
  graphics.fillRect(rightStem - stem / 2, rightTop, stem, right.y - rightTop);
  const beam = unit * 3.2;
  graphics.fillPoints(
    [
      new Phaser.Math.Vector2(leftStem - stem / 2, leftTop),
      new Phaser.Math.Vector2(rightStem + stem / 2, rightTop),
      new Phaser.Math.Vector2(rightStem + stem / 2, rightTop + beam),
      new Phaser.Math.Vector2(leftStem - stem / 2, leftTop + beam),
    ],
    true,
  );
}

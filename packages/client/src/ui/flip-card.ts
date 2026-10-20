/**
 * A card turning over in place (#287): the back narrows to nothing about its vertical centre line, then the face
 * widens. The pose at any moment is `flipFrameAt` (plain data, from the time since the press), so a full redraw of
 * the scene mid-turn recreates the card where it had got to and the tween carries on from there.
 */
import type Phaser from "phaser";
import type { ArtSource } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { border, ink, signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { FLIP_MS, flipFrameAt } from "../view/villain-phase-reveal.js";
import { textStyle } from "./theme.js";

/**
 * Draws one card side in `rect`: the scan, or a labelled blank when it has not arrived. `elapsedMs` null draws the
 * back at rest; a number draws the turn that far in and plays out the rest.
 */
export function drawFlipCard(
  scene: Phaser.Scene,
  rect: Rect,
  back: ArtSource,
  face: ArtSource | null,
  faceName: string,
  elapsedMs: number | null,
  durationMs: number = FLIP_MS,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const side = (art: ArtSource | null, name: string): Phaser.GameObjects.GameObject[] => {
    const ground = scene.add.graphics();
    ground.fillStyle(signal.spent.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const objects: Phaser.GameObjects.GameObject[] = [ground];
    const image = drawArt(scene, cardArt(scene).request(scene, art), rect);
    if (image) objects.push(image);
    else {
      objects.push(
        scene.add
          .text(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
            name,
            textStyle({ ...typeRole.rowTitle, size: 13 }, surface.paper.hex, ink.secondary),
          )
          .setOrigin(0.5)
          .setAlign("center")
          .setWordWrapWidth(rect.width - 12)
          .setMaxLines(4),
      );
    }
    const frame = scene.add.graphics();
    frame.lineStyle(border.object, surface.paper.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    objects.push(frame);
    return objects;
  };
  const backSide = scene.add.container(0, 0, side(back, "Encounter card"));
  if (elapsedMs === null) return;
  const faceSide = scene.add.container(0, 0, side(face, faceName));

  const centre = rect.x + rect.width / 2;
  const pose = (elapsed: number): void => {
    // Both sides turn about the card's own centre line: x' = centre + (x - centre) * scaleX.
    if (!backSide.scene || !faceSide.scene) return;
    const frame = flipFrameAt(elapsed, durationMs);
    const shown = frame.side === "back" ? backSide : faceSide;
    const hidden = frame.side === "back" ? faceSide : backSide;
    hidden.setVisible(false);
    shown
      .setVisible(true)
      .setScale(Math.max(0.001, frame.scaleX), 1)
      .setPosition(centre * (1 - frame.scaleX), 0);
  };
  pose(elapsedMs);
  const remaining = durationMs - elapsedMs;
  if (remaining <= 0) return;
  scene.tweens.addCounter({
    from: elapsedMs,
    to: durationMs,
    duration: remaining,
    onUpdate: (tween) => {
      // A redraw destroyed this card: its own tween has nothing left to turn.
      if (!backSide.scene) tween.stop();
      else pose(tween.getValue() ?? durationMs);
    },
  });
}

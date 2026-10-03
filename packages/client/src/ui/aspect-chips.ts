/**
 * One chip per aspect, in the aspect's printed frame color with its name on it (never color alone): the badge the
 * campaign briefing, Take your seats and the deck screens share, drawn by one function so they cannot drift.
 */
import type Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import type { AspectStamp } from "../view/aspect-stamp.js";
import { textStyle } from "./theme.js";

export interface AspectChipsResult {
  readonly width: number;
  readonly objects: readonly Phaser.GameObjects.GameObject[];
}

/** Draws the chips at (`x`, `y`), growing right (or ending at `x` when `right`). Returns the total width. */
export function drawAspectChips(
  scene: Phaser.Scene,
  x: number,
  y: number,
  aspects: readonly AspectStamp[],
  right = false,
): AspectChipsResult {
  const chipHeight = 18;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const widths = aspects.map((aspect) => {
    const probe = scene.add.text(0, 0, aspect.label.toUpperCase(), {
      ...textStyle(typeRole.label, 0),
      fontSize: "10px",
    });
    const width = probe.width + 14;
    probe.destroy();
    return width;
  });
  const total = widths.reduce((sum, width) => sum + width, 0) + 6 * Math.max(0, widths.length - 1);
  let cursor = right ? x - total : x;
  aspects.forEach((aspect, index) => {
    const width = widths[index]!;
    objects.push(scene.add.rectangle(cursor, y, width, chipHeight, aspect.fill).setOrigin(0, 0));
    objects.push(scene.add.graphics().lineStyle(1, surface.ink.hex, 1).strokeRect(cursor, y, width, chipHeight));
    objects.push(
      scene.add
        .text(cursor + width / 2, y + chipHeight / 2, aspect.label.toUpperCase(), {
          ...textStyle(typeRole.label, aspect.ink),
          fontSize: "10px",
        })
        .setOrigin(0.5),
    );
    cursor += width + 6;
  });
  return { width: total, objects };
}

/**
 * One chip per aspect, in the aspect's printed frame color with its name on it (never color alone): the badge the
 * campaign briefing, Take your seats and the deck screens share, drawn by one function so they cannot drift.
 */
import type Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import type { AspectStamp } from "../view/aspect-stamp.js";
import { packChipRows, widestRow } from "../view/aspect-chip-rows.js";
import { textStyle } from "./theme.js";
import { fitText } from "./widgets.js";
import { aspectChipsOf } from "../view/past-games-model.js";
import type { Rect } from "../view/layout.js";

export interface AspectChipsResult {
  /** The widest line's width. */
  readonly width: number;
  /** How many lines the chips took (1 unless `maxWidth` made them wrap). */
  readonly lines: number;
  /** The last line's width, for what sits beside the final chip. */
  readonly lastWidth: number;
  readonly objects: readonly Phaser.GameObjects.GameObject[];
}

const CHIP_HEIGHT = 18;
const CHIP_GAP = 6;
const CHIP_LINE_STEP = CHIP_HEIGHT + 4;
const widthCache = new Map<string, number>();

/** One chip's width, measured once per label (the chip font never changes under a running scene). */
export function aspectChipWidth(scene: Phaser.Scene, label: string): number {
  const key = label.toUpperCase();
  const known = widthCache.get(key);
  if (known !== undefined) return known;
  const probe = scene.add.text(0, 0, key, { ...textStyle(typeRole.label, 0), fontSize: "10px" });
  const width = probe.width + 14;
  probe.destroy();
  widthCache.set(key, width);
  return width;
}

/** How many lines `aspects` take in `maxWidth` (1 with no limit): what a row has to leave room for before it draws. */
export function aspectChipLines(scene: Phaser.Scene, aspects: readonly AspectStamp[], maxWidth: number): number {
  return Math.max(
    1,
    packChipRows(
      aspects.map((a) => aspectChipWidth(scene, a.label)),
      CHIP_GAP,
      maxWidth,
    ).length,
  );
}

/** The vertical room each extra line of chips takes. */
export const ASPECT_CHIP_LINE_STEP = CHIP_LINE_STEP;

/**
 * Draws the chips at (`x`, `y`), growing right (or ending at `x` when `right`). With `maxWidth`, chips that would run
 * past it wrap onto a further line (`ASPECT_CHIP_LINE_STEP` lower) so all of them show. Returns the widest line's width.
 */
export function drawAspectChips(
  scene: Phaser.Scene,
  x: number,
  y: number,
  aspects: readonly AspectStamp[],
  right = false,
  maxWidth = Number.POSITIVE_INFINITY,
): AspectChipsResult {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const widths = aspects.map((aspect) => aspectChipWidth(scene, aspect.label));
  const rows = packChipRows(widths, CHIP_GAP, maxWidth);
  rows.forEach((row, rowIndex) => {
    const total = row.reduce((sum, i) => sum + widths[i]!, 0) + CHIP_GAP * Math.max(0, row.length - 1);
    let cursor = right ? x - total : x;
    const rowY = y + rowIndex * CHIP_LINE_STEP;
    for (const index of row) {
      const aspect = aspects[index]!;
      const width = widths[index]!;
      objects.push(scene.add.rectangle(cursor, rowY, width, CHIP_HEIGHT, aspect.fill).setOrigin(0, 0));
      objects.push(scene.add.graphics().lineStyle(1, surface.ink.hex, 1).strokeRect(cursor, rowY, width, CHIP_HEIGHT));
      objects.push(
        scene.add
          .text(cursor + width / 2, rowY + CHIP_HEIGHT / 2, aspect.label.toUpperCase(), {
            ...textStyle(typeRole.label, aspect.ink),
            fontSize: "10px",
          })
          .setOrigin(0.5),
      );
      cursor += width + CHIP_GAP;
    }
  });
  const last = rows.at(-1);
  return {
    width: widestRow(widths, rows, CHIP_GAP),
    lines: Math.max(1, rows.length),
    lastWidth: last ? widestRow(widths, [last], CHIP_GAP) : 0,
    objects,
  };
}

/**
 * Draws the aspect chips along the foot of a hero's picture: the aspect's frame color with its name in words on it. Past
 * games' rows (#917) and the Decks list's rows (#966) wear them.
 */
export function drawPictureAspectChips(
  scene: Phaser.Scene,
  pic: Rect,
  aspectIds: readonly string[],
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const chips = aspectChipsOf(pic, aspectIds);
  if (chips.length === 0) return objects;
  const g = scene.add.graphics();
  objects.push(g);
  for (const chip of chips) {
    g.fillStyle(chip.stamp.fill, 1).fillRect(chip.rect.x, chip.rect.y, chip.rect.width, chip.rect.height);
    g.lineStyle(1, surface.ink.hex, 0.9).strokeRect(chip.rect.x, chip.rect.y, chip.rect.width, chip.rect.height);
    const text = scene.add
      .text(
        chip.rect.x + chip.rect.width / 2,
        chip.rect.y + chip.rect.height / 2,
        chip.text,
        textStyle(typeRole.label, chip.stamp.ink),
      )
      .setOrigin(0.5, 0.5);
    text.setFontSize(chip.fontSize);
    // The model picked the wording by an estimate of the type's width; the measured text shrinks to fit what it chose.
    fitText(text, chip.rect.width - 4, 6);
    objects.push(text);
  }
  return objects;
}

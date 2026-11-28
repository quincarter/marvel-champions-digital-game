/**
 * One row of the seat picker's list, as parts of the picker's scroller: the hero's picture, its name, a saved deck's name,
 * the aspect chips (wrapping onto a second line rather than running off the row), where the deck came from (or why it
 * cannot be seated) and, for a recommended hero, a Team-Up tag and the reason. The row's height depends on those lines, so
 * `pickerRowHeight` is asked first, with the same measures the row is drawn with.
 */
import { currentCardsById } from "../../../content/pool.js";
import { heroPictureOf, type HeroPicture } from "../../../dom/hero-picture.js";
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { cardDisplayName } from "../../../view/hero-names.js";
import { packChipRows } from "../../../view/aspect-chip-rows.js";
import { accent, ink, surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { t } from "../../../i18n/translate.js";
import type { PickerEntry, RosterDeckOption } from "../../../view/campaign-roster-model.js";
import type { Rect } from "../../../view/layout.js";
import { PICKER_DECK_NAME_STEP, PICKER_HEADING_HEIGHT, type RosterCtx } from "./context.js";

const CHIP_HEIGHT = 18;
const CHIP_GAP = 6;
const CHIP_LINE_STEP = CHIP_HEIGHT + 4;
const REASON_SIZE = 11;

/**
 * A chip's width: its label in the chip type, with the plate's padding. The chip draws its type at 10px on every screen,
 * so the measure is asked for the size that comes out as 10px after the desktop bump (`SheetBuilder.typeSize`).
 */
const chipWidthOf = (b: SheetBuilder, label: string): number =>
  b.measure(caseOf(typeRole.label, label.toLocaleUpperCase()), typeRole.label, { size: 10 - (b.typeSize(10) - 10) })
    .width + 14;

/** What the row's text may take: the width right of the thumbnail. */
export function pickerRowGeometry(rowWidth: number, rowHeight: number): { thumbSide: number; chipRoom: number } {
  const thumbSide = rowHeight - 16;
  return { thumbSide, chipRoom: rowWidth - 8 - thumbSide - 12 - 12 };
}

/** A heading is a compact band; an option row grows by its deck name, a second line of chips and a two line reason. */
export function pickerRowHeight(
  b: SheetBuilder,
  entry: PickerEntry,
  options: readonly RosterDeckOption[],
  rowWidth: number,
  rowHeight: number,
): number {
  if (entry.kind !== "option") return PICKER_HEADING_HEIGHT;
  const option = options[entry.optionIndex]!;
  const { chipRoom } = pickerRowGeometry(rowWidth, rowHeight);
  const lines = Math.max(
    1,
    packChipRows(
      option.stamps.map((stamp) => chipWidthOf(b, stamp.label)),
      CHIP_GAP,
      chipRoom,
    ).length,
  );
  const reason = entry.rec?.reason ?? "";
  let reasonExtra = 0;
  if (reason) {
    const one = b.measure("Ag", typeRole.body, { size: REASON_SIZE }).height;
    const wrapped = b.measure(reason, typeRole.body, { size: REASON_SIZE, wrapWidth: chipRoom }).height;
    reasonExtra = Math.max(0, Math.min(wrapped, one * 2) - one);
  }
  return rowHeight + (option.deckName ? PICKER_DECK_NAME_STEP : 0) + (lines - 1) * CHIP_LINE_STEP + reasonExtra;
}

export function drawPickerHeading(b: SheetBuilder, rect: Rect, text: string): void {
  const mid = rect.y + PICKER_HEADING_HEIGHT / 2;
  const word = caseOf(typeRole.label, text.toLocaleUpperCase());
  const width = b.measure(word, typeRole.label).width;
  b.text(rect.x, mid, word, typeRole.label, { color: surface.ink.hex, alpha: ink.label, origin: [0, 0.5] });
  b.box(
    { x: rect.x + width + 10, y: mid - 1, width: Math.max(0, rect.width - width - 10), height: 2 },
    { fill: surface.ink.hex, alpha: ink.meta },
  );
}

export interface PickerRowResult {
  readonly name: string;
  readonly picture: HeroPicture;
}

/** Draws the row of `entry` (an option) in `rect`, its key `key`; the caller adds the tap and the stop. */
export function drawPickerRow(
  ctx: RosterCtx,
  b: SheetBuilder,
  entry: Extract<PickerEntry, { kind: "option" }>,
  option: RosterDeckOption,
  rect: Rect,
  rowHeight: number,
): PickerRowResult {
  const identity = currentCardsById().get(option.identityId);
  const name = identity ? cardDisplayName(identity) : option.identityId;
  const dim = option.blocked ? 0.55 : undefined;
  const alpha = dim === undefined ? {} : { alpha: dim };
  b.box(rect, { fill: surface.paper.hex, ...alpha });
  b.box(rect, { stroke: surface.ink.hex, strokeWidth: 2.5, ...alpha });

  const pad = 8;
  const { thumbSide, chipRoom } = pickerRowGeometry(rect.width, rowHeight);
  const thumb: Rect = { x: rect.x + pad, y: rect.y + pad, width: thumbSide, height: thumbSide };
  const picture = heroPictureOf(identity, ctx.leases);
  if (picture.src !== null)
    b.image(thumb, {
      src: picture.src,
      cover: { x: picture.cover.x, y: 0.2 },
      fill: surface.parchment.hex,
      key: `pick-art:${option.deck.id as string}`,
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
    });
  else b.box(thumb, { fill: surface.parchment.hex });
  b.box(thumb, { stroke: surface.ink.hex, strokeWidth: 1.5 });

  const textX = thumb.x + thumb.width + 12;
  const textWidth = rect.x + rect.width - textX - 12;
  const rec = entry.rec;
  let titleRoom = textWidth;
  // A recommended row: the Team-Up tag where it applies (right of the name), quiet: the accent as an outline on an ink
  // plate, its label paper-white (owner, 2026-10-20).
  if (rec && rec.teamUps.length > 0) {
    const word = caseOf(typeRole.label, t("roster.teamUp").toLocaleUpperCase());
    const size = b.measure(word, typeRole.label);
    const plate: Rect = {
      x: rect.x + rect.width - 10 - size.width - 10,
      y: rect.y + 8,
      width: size.width + 10,
      height: size.height + 4,
    };
    b.box(plate, { fill: surface.ink.hex });
    b.box(plate, { stroke: accent.heroRed.hex, strokeWidth: 1.5 });
    b.text(plate.x + 5, plate.y + 2, word, typeRole.label, { color: surface.paper.hex });
    titleRoom = Math.max(40, textWidth - plate.width - 8);
  }
  b.text(textX, rect.y + 8, name.toLocaleUpperCase(), bangers(16), {
    color: surface.ink.hex,
    fitWidth: titleRoom,
    ...alpha,
  });
  if (option.deckName)
    b.text(textX, rect.y + 8 + 16 + 4, option.deckName, typeRole.emphasis, {
      size: 13,
      color: surface.ink.hex,
      wrapWidth: textWidth,
      maxLines: 1,
      ...alpha,
    });
  const lineY = rect.y + 8 + 16 + 8 + (option.deckName ? PICKER_DECK_NAME_STEP : 0);

  // Four chips (Adam Warlock) wrap to a second line rather than run off the row's edge; the source note rides beside the
  // last chip and the reason moves down by the extra line.
  const widths = option.stamps.map((stamp) => chipWidthOf(b, stamp.label));
  const rows = packChipRows(widths, CHIP_GAP, chipRoom);
  rows.forEach((indexes, line) => {
    let x = textX;
    for (const index of indexes) {
      const stamp = option.stamps[index]!;
      b.chip(x, lineY + line * CHIP_LINE_STEP, stamp.aspect, stamp.label, { height: CHIP_HEIGHT, size: 10 });
      x += widths[index]! + CHIP_GAP;
    }
  });
  const extraLines = (Math.max(1, rows.length) - 1) * CHIP_LINE_STEP;
  const lastWidth = rows.at(-1)?.reduce((sum, index) => sum + widths[index]! + CHIP_GAP, 0) ?? 0;
  const noteX = textX + (lastWidth > 0 ? lastWidth - CHIP_GAP + 8 : 0);
  const note = option.blocked ? (option.blockedReason ?? t("roster.blocked.seated")) : option.sourceLabel;
  b.text(noteX, lineY + extraLines + 9, note, typeRole.emphasis, {
    size: 12,
    color: surface.ink.hex,
    alpha: (dim ?? 1) * ink.secondary,
    origin: [0, 0.5],
    fitWidth: Math.max(40, rect.x + rect.width - 12 - noteX),
  });
  if (rec)
    b.text(textX, lineY + extraLines + 22, rec.reason, typeRole.body, {
      size: REASON_SIZE,
      color: surface.ink.hex,
      alpha: (dim ?? 1) * ink.secondary,
      wrapWidth: textWidth,
      maxLines: 2,
    });
  return { name, picture };
}

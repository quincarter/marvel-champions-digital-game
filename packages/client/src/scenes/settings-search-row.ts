/**
 * One search result on Settings (#576): its title and where it lives on the first line, the description cut around the
 * match on the second, with what matched marked on both. Words come from `view/settings-search.ts`.
 *
 * The mark is a band behind the letters with a heavier line under them, never color alone. It is measured off the one
 * `Text` of the line rather than splitting the line into a `Text` per run, so a row costs one texture a line.
 */
import type Phaser from "phaser";
import { signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import type { VirtualListRow } from "../ui/virtual-list.js";
import { fitText } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import type { SettingsSearchResult } from "../view/settings-search.js";
import { markedLineOf, type MarkedLine, type TextRange } from "../view/settings-search-line.js";

export const SEARCH_RESULT_ROW_HEIGHT = 52;

const TITLE_SIZE = 14;
const DETAIL_SIZE = 11;
const PLACE_SIZE = 10;
/** Room at the row's right edge for the list's own scrollbar. */
const GUTTER = 14;
const PLACE_GAP = 12;

/** Sets `text` to as much of `whole` as fits `room`, around the match: how much fits is read off `whole` drawn at full length. */
function fitLine(text: Phaser.GameObjects.Text, whole: string, ranges: readonly TextRange[], room: number): MarkedLine {
  const maxChars = text.width <= room ? whole.length : Math.floor((whole.length * room) / text.width);
  const line = markedLineOf(whole, ranges, maxChars);
  text.setText(line.text);
  return line;
}

/** Bands behind `line`'s marked letters, drawn before the text so they sit under it. */
function markRanges(band: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text, line: MarkedLine): void {
  // Sizing the canvas to the text resets its context, font included.
  text.style.syncFont(text.canvas, text.context);
  const scale = text.scaleX;
  const widthOf = (to: number): number => text.context.measureText(line.text.slice(0, to)).width * scale;
  for (const { start, end } of line.ranges) {
    const x = text.x + widthOf(start);
    const width = widthOf(end) - widthOf(start);
    band.fillStyle(signal.caution.hex, 0.35).fillRect(x, text.y - 1, width, text.height + 2);
    band.fillStyle(signal.caution.hex, 1).fillRect(x, text.y + text.height, width, 2);
  }
}

export function drawSearchResultRow(
  scene: Phaser.Scene,
  rect: Rect,
  { entry, titleRanges, detailRanges }: SettingsSearchResult,
): VirtualListRow {
  const right = rect.x + rect.width - GUTTER;
  const place = scene.add
    .text(right, rect.y + 8, entry.place, textStyle(typeRole.body, surface.paper.hex, 0.6))
    .setFontSize(PLACE_SIZE)
    .setOrigin(1, 0);
  fitText(place, rect.width * 0.45, PLACE_SIZE);
  const titleRoom = rect.width - GUTTER - place.displayWidth - PLACE_GAP;
  const band = scene.add.graphics();
  const title = scene.add
    .text(rect.x, rect.y + 6, entry.title, textStyle(typeRole.body, surface.paper.hex, 0.95))
    .setFontSize(TITLE_SIZE);
  markRanges(band, title, fitLine(title, entry.title, titleRanges, titleRoom));
  const detail = scene.add
    .text(rect.x, rect.y + 28, entry.detail, textStyle(typeRole.body, surface.paper.hex, 0.75))
    .setFontSize(DETAIL_SIZE);
  markRanges(band, detail, fitLine(detail, entry.detail, detailRanges, rect.width - GUTTER));
  const rule = scene.add.graphics();
  rule
    .fillStyle(surface.paper.hex, 0.25)
    .fillRect(rect.x, rect.y + SEARCH_RESULT_ROW_HEIGHT - 2, rect.width - GUTTER, 1);
  return { objects: [band, title, detail, place, rule] };
}

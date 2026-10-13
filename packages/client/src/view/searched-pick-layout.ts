/**
 * Where Hunted's "which minion?" sheet puts things (Tigra, 56007; docs/phase7-wave10-client.md 5.3 and 5.6): a sheet
 * over the table with one tile per candidate the engine listed, each a card face with its area tag under it and an
 * Inspect button, and Cancel in the header. Plain geometry, no Phaser, so the tiles never overlap or leave the sheet
 * at any window size. The scene turns the rects into pictures (`scenes/board/searched-pick-sheet.ts`).
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export interface SearchedTileRects {
  /** The whole tile: tapping it chooses the minion. */
  readonly tile: Rect;
  readonly face: Rect;
  /** The area tag, on a strip under the face. */
  readonly tag: Rect;
  /** The name and type lines under the tag. */
  readonly caption: Rect;
  readonly inspect: Rect;
}

export interface SearchedPickLayout {
  readonly sheet: Rect;
  readonly title: Rect;
  readonly cancel: Rect;
  readonly tiles: readonly SearchedTileRects[];
  /** Tiles per row, and how many rows the sheet needed (a long list scrolls nowhere: tiles shrink instead). */
  readonly columns: number;
  readonly rows: number;
}

const PAD = 16;
const GAP = 12;
const TAG_HEIGHT = 24;
const CAPTION_HEIGHT = 40;
const HEADER_HEIGHT = hit.primary + 12;
const MIN_FACE_WIDTH = 64;
const MAX_FACE_WIDTH = 170;

/** Lays `count` tiles out in `viewport`: as few rows as the width allows, each tile as large as the height then allows. */
export function searchedPickLayout(viewport: Rect, count: number): SearchedPickLayout {
  const margin = viewport.width < 600 ? 8 : 24;
  const sheet: Rect = {
    x: viewport.x + margin,
    y: viewport.y + margin,
    width: Math.max(0, viewport.width - margin * 2),
    height: Math.max(0, viewport.height - margin * 2),
  };
  const inner: Rect = {
    x: sheet.x + PAD,
    y: sheet.y + PAD + HEADER_HEIGHT,
    width: Math.max(0, sheet.width - PAD * 2),
    height: Math.max(0, sheet.height - PAD * 2 - HEADER_HEIGHT),
  };
  const cancelWidth = Math.min(140, Math.max(88, sheet.width * 0.2));
  const cancel: Rect = {
    x: sheet.x + sheet.width - PAD - cancelWidth,
    y: sheet.y + PAD,
    width: cancelWidth,
    height: hit.primary,
  };
  const title: Rect = {
    x: sheet.x + PAD,
    y: sheet.y + PAD,
    width: Math.max(0, cancel.x - GAP - (sheet.x + PAD)),
    height: hit.primary,
  };
  // The tile is a face (5:7) over the tag, caption and Inspect rows. Pick the column count that gives the largest face.
  const chrome = TAG_HEIGHT + CAPTION_HEIGHT + hit.target + GAP;
  let best = { columns: 1, rows: Math.max(1, count), face: 0 };
  for (let columns = 1; columns <= Math.max(1, count); columns++) {
    const rows = Math.ceil(Math.max(1, count) / columns);
    const byWidth = (inner.width - GAP * (columns - 1)) / columns;
    const byHeight = ((inner.height - GAP * (rows - 1)) / rows - chrome) * (5 / 7);
    const face = Math.min(byWidth, byHeight, MAX_FACE_WIDTH);
    if (face > best.face) best = { columns, rows, face };
  }
  const faceWidth = Math.max(Math.min(MIN_FACE_WIDTH, inner.width), Math.floor(best.face));
  const faceHeight = Math.round(faceWidth * (7 / 5));
  const tileHeight = faceHeight + chrome;
  const rowWidth = best.columns * faceWidth + (best.columns - 1) * GAP;
  const left = inner.x + Math.max(0, (inner.width - rowWidth) / 2);
  const tiles = Array.from({ length: count }, (_, index): SearchedTileRects => {
    const column = index % best.columns;
    const row = Math.floor(index / best.columns);
    const x = Math.round(left + column * (faceWidth + GAP));
    const y = Math.round(inner.y + row * (tileHeight + GAP));
    const face: Rect = { x, y, width: faceWidth, height: faceHeight };
    return {
      tile: { x, y, width: faceWidth, height: tileHeight },
      face,
      tag: { x, y: y + faceHeight, width: faceWidth, height: TAG_HEIGHT },
      caption: { x, y: y + faceHeight + TAG_HEIGHT, width: faceWidth, height: CAPTION_HEIGHT },
      inspect: { x, y: y + faceHeight + TAG_HEIGHT + CAPTION_HEIGHT + 4, width: faceWidth, height: hit.target },
    };
  });
  return { sheet, title, cancel, tiles, columns: best.columns, rows: best.rows };
}

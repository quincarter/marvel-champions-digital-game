/**
 * The compact villain tile of a multi-villain scenario (The Wrecking Crew, the Sinister Six, the Four Horsemen, Kang's
 * rows of villains), as pure geometry: how many tiles go in a row, how tall a row is, and where a tile's art, text
 * column and hit point bar sit. `scenes/board/zones.ts` only draws what this decides (nothing here imports Phaser).
 *
 * A tile is art first. The card scan is what tells six villains apart at a glance, so a tile always carries it: beside
 * the text (`side`) when the tile is wide enough for both, over it (`stacked`) when it is narrow and tall, whichever
 * gives the scan more room. The text column wraps whole words; it is never the thing a tile gives up.
 */

import type { Rect } from "./layout.js";

/** A card's own proportions (`CARD_ASPECT` in `layout.ts`, repeated here so the two modules do not import each other). */
const ASPECT = 2.5 / 3.5;

/** Padding inside a tile, and the gap between a tile's art and its text. */
const PAD = 3;
const ART_GAP = 5;
/** The hit point bar at a tile's foot, and the line of numbers above it. */
export const VILLAIN_HP_BAR_HEIGHT = 7;
const HP_LINE_HEIGHT = 12;
/** The least width a text column needs for a name, "VILLAIN · STAGE I" and the ATK / SCH line wrapped whole. */
export const VILLAIN_TEXT_MIN_WIDTH = 80;
/** The least height the text under a stacked tile's art needs: a two line name, the stage, the stats. */
export const VILLAIN_STACKED_TEXT_MIN = 78;
/** The least art worth drawing; under this a tile is too small to read as a card. */
const ART_MIN = 44;

/** The narrowest a tile is made, and the height at which it reads as a card with its text. */
export const VILLAIN_TILE_MIN_WIDTH = 96;
export const VILLAIN_TILE_MIN_HEIGHT = 112;

export type VillainTileShape = "side" | "stacked";

export interface VillainTileLayout {
  readonly shape: VillainTileShape;
  /** The scan's rect; null only for a tile too small for any (never drawn at a size the row plan produces). */
  readonly art: Rect | null;
  /** Where the name, stage, status tag and stats wrap. */
  readonly text: Rect;
  /** The hit point bar across the tile's foot. */
  readonly bar: Rect;
  /** The line the "28/28" reading takes, right aligned in the text column above the bar. */
  readonly hpLine: Rect;
}

interface Candidate {
  readonly shape: VillainTileShape;
  readonly artRect: Rect;
  readonly text: Rect;
  readonly valid: boolean;
  readonly area: number;
}

/** The tile's inner box: padded, with the bar's strip taken off the foot. */
function innerOf(rect: Rect): { readonly bar: Rect; readonly hpLine: (text: Rect) => Rect; readonly inner: Rect } {
  const bar: Rect = {
    x: rect.x + PAD + 1,
    y: rect.y + rect.height - VILLAIN_HP_BAR_HEIGHT - PAD,
    width: rect.width - (PAD + 1) * 2,
    height: VILLAIN_HP_BAR_HEIGHT,
  };
  const inner: Rect = {
    x: rect.x + PAD,
    y: rect.y + PAD,
    width: rect.width - PAD * 2,
    height: Math.max(0, bar.y - PAD - (rect.y + PAD)),
  };
  const hpLine = (text: Rect): Rect => ({
    x: text.x,
    y: bar.y - PAD - HP_LINE_HEIGHT + 1,
    width: text.width,
    height: HP_LINE_HEIGHT,
  });
  return { bar, hpLine, inner };
}

/** The scan beside the text: as card-shaped as the height allows, never more than 42% of the width. */
function sideCandidate(inner: Rect): Candidate {
  const artWidth = Math.floor(Math.min(inner.height * ASPECT, inner.width * 0.42));
  const text: Rect = {
    x: inner.x + artWidth + ART_GAP,
    y: inner.y,
    width: inner.width - artWidth - ART_GAP,
    height: inner.height,
  };
  return {
    shape: "side",
    artRect: { x: inner.x, y: inner.y, width: artWidth, height: inner.height },
    text,
    valid: artWidth >= ART_MIN && text.width >= VILLAIN_TEXT_MIN_WIDTH,
    area: artWidth * inner.height,
  };
}

/** The scan over the text: the whole card across the tile's width when the height allows, less of it otherwise. */
function stackedCandidate(inner: Rect): Candidate {
  const artHeight = Math.floor(Math.min(inner.width / ASPECT, inner.height - VILLAIN_STACKED_TEXT_MIN));
  const text: Rect = {
    x: inner.x,
    y: inner.y + Math.max(0, artHeight) + ART_GAP,
    width: inner.width,
    height: Math.max(0, inner.height - Math.max(0, artHeight) - ART_GAP),
  };
  return {
    shape: "stacked",
    artRect: { x: inner.x, y: inner.y, width: inner.width, height: Math.max(0, artHeight) },
    text,
    valid: artHeight >= ART_MIN && inner.width >= VILLAIN_TEXT_MIN_WIDTH,
    area: Math.max(0, artHeight) * inner.width,
  };
}

/** How much scan a tile of this size shows, 0 when neither shape holds a readable one. Used to pick the row's shape. */
export function villainTileArtArea(width: number, height: number): number {
  const { inner } = innerOf({ x: 0, y: 0, width, height });
  return [sideCandidate(inner), stackedCandidate(inner)].reduce(
    (best, c) => (c.valid ? Math.max(best, c.area) : best),
    0,
  );
}

/**
 * Where a tile's parts sit inside `rect`: the shape that shows the larger scan while its text column still holds
 * whole words (a tie goes to the side shape, the one the single villain's panel also uses). A tile too small for
 * either keeps whichever gives the text the room, so nothing is drawn outside `rect`.
 */
export function villainTileLayout(rect: Rect): VillainTileLayout {
  const { bar, hpLine, inner } = innerOf(rect);
  const side = sideCandidate(inner);
  const stacked = stackedCandidate(inner);
  const valid = [side, stacked].filter((candidate) => candidate.valid);
  const chosen =
    valid.length > 0
      ? valid.reduce((best, candidate) => (candidate.area > best.area ? candidate : best))
      : // Neither shape fits: the wider tile keeps its scan beside the text (shrunk), the narrower stacks it.
        inner.width >= inner.height
        ? side
        : stacked;
  const art = chosen.artRect.width > 0 && chosen.artRect.height > 0 ? chosen.artRect : null;
  return { shape: chosen.shape, art, text: chosen.text, bar, hpLine: hpLine(chosen.text) };
}

export interface VillainRowPlan {
  readonly perRow: number;
  readonly rows: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** The whole grid's height, gaps included. */
  readonly height: number;
}

/**
 * How `count` tiles share a band `width` wide: as many rows as give the largest scan at tiles no narrower than
 * `VILLAIN_TILE_MIN_WIDTH`, fewest rows on a tie. Rows are as even as the count allows (six tiles in two rows are
 * three and three, never four and two). A row is `height` tall in total when there is room; where the tiles would be
 * shorter than `VILLAIN_TILE_MIN_HEIGHT`, rows grow toward it, but the grid never takes more than `maxHeight`.
 */
export function villainRowPlan(
  width: number,
  count: number,
  height: number,
  maxHeight: number = height,
  gap = 8,
): VillainRowPlan {
  const ceiling = Math.max(height, maxHeight);
  let best: { plan: VillainRowPlan; score: number } | null = null;
  const seen = new Set<number>();
  for (let rows = 1; rows <= Math.max(1, count); rows++) {
    const perRow = Math.ceil(count / rows);
    if (seen.has(perRow)) continue;
    seen.add(perRow);
    const realRows = Math.ceil(count / perRow);
    const tileWidth = (width - gap * (perRow - 1)) / perRow;
    const gaps = gap * (realRows - 1);
    const wanted = (height - gaps) / realRows;
    const room = (ceiling - gaps) / realRows;
    const tileHeight = Math.max(wanted, Math.min(VILLAIN_TILE_MIN_HEIGHT, room));
    const score = tileWidth >= VILLAIN_TILE_MIN_WIDTH ? villainTileArtArea(tileWidth, tileHeight) : 0;
    const plan: VillainRowPlan = {
      perRow,
      rows: realRows,
      tileWidth,
      tileHeight,
      height: tileHeight * realRows + gaps,
    };
    if (!best || score > best.score) best = { plan, score };
  }
  if (best && best.score > 0) return best.plan;
  // No arrangement holds a readable tile: the widest tiles (fewest per row), as tall as the band gives them.
  const perRow = Math.max(1, Math.min(count, Math.floor((width + gap) / (VILLAIN_TILE_MIN_WIDTH + gap))));
  const rows = Math.ceil(count / perRow);
  const even = Math.ceil(count / rows);
  const gaps = gap * (rows - 1);
  const tileHeight = Math.max(0, (height - gaps) / rows);
  return {
    perRow: even,
    rows,
    tileWidth: (width - gap * (even - 1)) / even,
    tileHeight,
    height: tileHeight * rows + gaps,
  };
}

/** Each tile's rect for a plan, rows centred on the band's width when the last row is short. */
export function villainRowSlotsFor(
  rect: Pick<Rect, "x" | "y" | "width">,
  count: number,
  plan: VillainRowPlan,
  gap = 8,
): readonly Rect[] {
  const slots: Rect[] = [];
  for (let at = 0; at < count; at++) {
    const row = Math.floor(at / plan.perRow);
    const inRow = Math.min(plan.perRow, count - row * plan.perRow);
    const col = at - row * plan.perRow;
    // Every row uses the plan's own tile width and the room left of it is shared out, so a short last row is centred.
    const rowWidth = inRow * plan.tileWidth + (inRow - 1) * gap;
    slots.push({
      x: rect.x + (rect.width - rowWidth) / 2 + col * (plan.tileWidth + gap),
      y: rect.y + row * (plan.tileHeight + gap),
      width: plan.tileWidth,
      height: plan.tileHeight,
    });
  }
  return slots;
}

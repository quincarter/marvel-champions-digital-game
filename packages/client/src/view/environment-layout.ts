/**
 * Where the environment cards sit beside a lone villain (`scenes/board/zones.ts`), as pure geometry.
 *
 * The old layout put every environment in one row of tiles at least 110px wide and silently skipped any tile that
 * ran past the zone's edge, so a third environment (or a second one on a narrow table) was simply never drawn. An
 * environment can carry the counters a player has to read (MaGog's crowds, Criminal Enterprise's infamy), so none
 * may be left out: the tiles wrap into more rows, then shrink, before they are ever dropped.
 */

import type { Rect } from "./layout.js";

/** The gap between two tiles. */
export const ENVIRONMENT_GAP = 8;
/** The narrowest tile that still holds "2 MADNESS" on one line, and the widest one worth drawing. */
export const ENVIRONMENT_MIN_WIDTH = 110;
export const ENVIRONMENT_MAX_WIDTH = 170;
/** The shortest tile that still shows the scan, the name and a counter chip. */
export const ENVIRONMENT_MIN_HEIGHT = 60;

/**
 * One slot per environment, all inside `room`: the arrangement (columns by rows) whose tiles come closest to the
 * preferred size wins, preferring fewer rows on a tie. Always returns `count` slots, in play order, left to right
 * and top to bottom, even when `room` is too small for the preferred size (the tiles are then smaller than it).
 */
export function environmentSlots(room: Rect, count: number, preferredHeight: number = room.height): Rect[] {
  if (count <= 0 || room.width <= 0 || room.height <= 0) return [];
  const wantedHeight = Math.min(preferredHeight, room.height);
  let best: {
    readonly columns: number;
    readonly rows: number;
    readonly width: number;
    readonly height: number;
  } | null = null;
  let bestScore = -Infinity;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const width = Math.min(ENVIRONMENT_MAX_WIDTH, (room.width - ENVIRONMENT_GAP * (columns - 1)) / columns);
    const height = Math.min(wantedHeight, (room.height - ENVIRONMENT_GAP * (rows - 1)) / rows);
    // How much of the preferred size the tile keeps, by its worse side; a tile past the minimum counts as fully fit.
    const score = Math.min(1, width / ENVIRONMENT_MIN_WIDTH, height / ENVIRONMENT_MIN_HEIGHT) - rows * 1e-3;
    if (score > bestScore) {
      bestScore = score;
      best = { columns, rows, width, height };
    }
  }
  const { columns, width, height } = best!;
  return Array.from({ length: count }, (_unused, index) => ({
    x: room.x + (index % columns) * (width + ENVIRONMENT_GAP),
    y: room.y + Math.floor(index / columns) * (height + ENVIRONMENT_GAP),
    width,
    height,
  }));
}

/** Below this tile height the full tile (a 30px title band, a subtitle and counter chips) cannot lay out without overlap. */
export const ENVIRONMENT_COMPACT_BELOW = 96;

/** The one-line tile (`environmentCompactLayout`): the name on its own band, the counters on another, nothing else. */
export function isCompactEnvironment(tile: Rect): boolean {
  return tile.height < ENVIRONMENT_COMPACT_BELOW;
}

export interface CompactEnvironmentLayout {
  /** The band over the art the name sits on (the whole tile's width, less the ability tag). */
  readonly title: Rect;
  /** The `▶` tag at the title band's right, when the environment carries a usable ability. Null otherwise. */
  readonly ability: Rect | null;
  /** One chip per counter kind, side by side along the foot; empty with no counters. */
  readonly counters: readonly Rect[];
}

const COMPACT_BAND = 20;
const COMPACT_PAD = 3;
const COMPACT_GAP = 3;
const COMPACT_TAG_WIDTH = 20;
/** The shortest title band that still holds one line of the name's 11px text. */
const COMPACT_TITLE_MIN = 15;
/** What a counter chip spends besides its name: the stripe, the count (up to two digits) and their padding. */
const COMPACT_CHIP_EXTRA = 34;
/** Pixels one letter of a counter's name takes at the smallest size it is drawn at, letter spacing included (a conservative estimate). */
const COMPACT_CHAR_WIDTH = 8;

/** The width a compact counter chip needs to spell `name` out in full beside its count. */
export function compactCounterWidth(name: string): number {
  return COMPACT_CHIP_EXTRA + name.length * COMPACT_CHAR_WIDTH;
}

/**
 * A short tile: the name on a band across the top and, under it, the counters (`counters` are their names, at most
 * two are ever printed). The subtitle ("ENVIRONMENT" — the tile's shape already says so) and the "no counters"
 * caption are left out, so a 60px tile never overprints one line on another. Two counters sit side by side when
 * both names fit in half the tile, else one above the other, so a name is never cut short ("MADN...").
 */
export function environmentCompactLayout(
  tile: Rect,
  counters: readonly string[],
  hasAbility: boolean,
): CompactEnvironmentLayout {
  const inner: Rect = {
    x: tile.x + COMPACT_PAD,
    y: tile.y + COMPACT_PAD,
    width: tile.width - COMPACT_PAD * 2,
    height: tile.height - COMPACT_PAD * 2,
  };
  const names = counters.slice(0, 2);
  const tag = hasAbility ? COMPACT_TAG_WIDTH : 0;
  const stacked =
    names.length === 2 && names.some((name) => compactCounterWidth(name) > (inner.width - COMPACT_GAP) / 2);
  const rowsOfChips = stacked ? 2 : names.length > 0 ? 1 : 0;
  const titleHeight =
    rowsOfChips === 0
      ? COMPACT_BAND
      : Math.min(COMPACT_BAND, Math.max(COMPACT_TITLE_MIN, inner.height - rowsOfChips * (COMPACT_BAND + COMPACT_GAP)));
  const title: Rect = { x: inner.x, y: inner.y, width: inner.width - tag, height: titleHeight };
  const ability: Rect | null = hasAbility
    ? { x: inner.x + inner.width - tag, y: inner.y, width: tag, height: titleHeight }
    : null;
  if (rowsOfChips === 0) return { title, ability, counters: [] };
  const chipHeight = Math.min(COMPACT_BAND, (inner.height - titleHeight - rowsOfChips * COMPACT_GAP) / rowsOfChips);
  if (stacked) {
    return {
      title,
      ability,
      counters: names.map((_name, index) => ({
        x: inner.x,
        y: inner.y + inner.height - (2 - index) * chipHeight - (1 - index) * COMPACT_GAP,
        width: inner.width,
        height: chipHeight,
      })),
    };
  }
  const chipWidth = (inner.width - COMPACT_GAP * (names.length - 1)) / names.length;
  return {
    title,
    ability,
    counters: names.map((_name, index) => ({
      x: inner.x + index * (chipWidth + COMPACT_GAP),
      y: inner.y + inner.height - chipHeight,
      width: chipWidth,
      height: chipHeight,
    })),
  };
}

/**
 * The room a strip of `count` environment tiles needs under a villain row: as many tiles per row as fit at the
 * minimum width, and enough rows (each `tileHeight` tall) for the rest, so the strip grows taller before it ever
 * drops a tile.
 */
export function environmentStripRoom(
  origin: { x: number; y: number },
  width: number,
  count: number,
  tileHeight = ENVIRONMENT_MIN_HEIGHT,
): Rect {
  const perRow = Math.max(1, Math.floor((width + ENVIRONMENT_GAP) / (ENVIRONMENT_MIN_WIDTH + ENVIRONMENT_GAP)));
  const rows = Math.max(1, Math.ceil(count / perRow));
  return { x: origin.x, y: origin.y, width, height: rows * tileHeight + (rows - 1) * ENVIRONMENT_GAP };
}

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

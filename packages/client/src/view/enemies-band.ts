/**
 * How tall the villain band is allowed to be when minions share the enemies zone with it (`scenes/board/zones.ts`).
 *
 * The band's floor height was drawn for the 1440x900 table. On a short tablet (a 1024x600 screen, or 1250x700 with
 * the browser's own bars) the enemies zone is barely taller than the band, so the minion row got whatever was left:
 * 56px of card at 1250x700, and under 40px (the row's own cut-off) at 1024x600, where the minions were not drawn at
 * all. A minion you cannot see is a minion you cannot attack, so the band gives height back, down to a floor,
 * before the minions give up theirs.
 */

/** The shortest minion row worth drawing: the card is still readable at this height, not just a damage badge. */
export const MINION_ROW_MIN_HEIGHT = 88;
/** The gap between the villain band and the minion row, and the zone's padding above the band and under the row. */
const BAND_GAP = 8;
const ZONE_PADDING = 10;

/**
 * The band height to use in a zone `zoneHeight` tall: `base` while the minion row still gets
 * `MINION_ROW_MIN_HEIGHT`, otherwise as much less as that takes, never below `floor`. With no minions, `base`.
 */
export function bandHeightWithMinions(zoneHeight: number, base: number, floor: number, minions: number): number {
  if (minions <= 0) return base;
  const leftover = zoneHeight - ZONE_PADDING - base - BAND_GAP - ZONE_PADDING;
  if (leftover >= MINION_ROW_MIN_HEIGHT) return base;
  const wanted = zoneHeight - ZONE_PADDING * 2 - BAND_GAP - MINION_ROW_MIN_HEIGHT;
  return Math.min(base, Math.max(floor, wanted));
}

/**
 * Whether a mouse hovering a scrolling list should show the hand cursor: the pointer is over a row the list's own tap
 * (`onRowActivate`) would act on. A row's own buttons and tabs set their hand cursor themselves (`useHandCursor`); the
 * list's tap has no game object under it to do that, so `McVirtualList` asks this on each pointer move.
 */
import type { Rect } from "./layout.js";

export interface ListCursorProbe {
  readonly x: number;
  readonly y: number;
  readonly rect: Rect;
  /** The scrollbar's column on the list's right edge, which starts a thumb drag rather than a row press. */
  readonly scrollbarWidth: number;
  /** The row under the pointer (-1 when none) and how many rows the list has. */
  readonly rowIndex: number;
  readonly rowCount: number;
  /** Whether a tap at this spot does anything (a tile and not a gap between tiles). */
  readonly pressable: boolean;
}

export function listWantsHandCursor(probe: ListCursorProbe): boolean {
  const { x, y, rect } = probe;
  if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) return false;
  if (x >= rect.x + rect.width - probe.scrollbarWidth) return false;
  if (probe.rowIndex < 0 || probe.rowIndex >= probe.rowCount) return false;
  return probe.pressable;
}

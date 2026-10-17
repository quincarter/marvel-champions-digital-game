/**
 * The pack-shelf roster's 2-axis keyboard/pad navigation (docs/phase4-screen-gaps.md
 * §3 W2b): Left/Right move within a shelf, Up/Down move to the nearest card
 * (by index — every shelf shares one fixed card width, so index and x-position
 * agree) in the shelf above/below, Home/End go to a shelf's first/last card,
 * and Page Up/Down move by shelf. Pure over shelf *shapes* (how many cards
 * each one holds), so it's testable without a live roster or a canvas.
 *
 * **Not wired into live keyboard input.** Since issue #206 the arrows and the D-pad move focus spatially on every
 * screen (`view/spatial-nav.ts`, over each stop's on-screen rect), which already gives the shelves Left/Right within a
 * shelf and Up/Down to the nearest card in the shelf above or below; `scenes/scenario-select.ts`/`scenes/seats.ts`
 * still list the cards in reading order for Tab. This module is kept for its Home/End and Page Up/Down rules.
 */

export interface ShelfShape {
  /** How many focusable cards this shelf has, in order. */
  readonly count: number;
}

export interface ShelfPosition {
  readonly shelf: number;
  /** Index within that shelf's own cards. */
  readonly item: number;
}

export type ShelfNavIntent = "left" | "right" | "up" | "down" | "home" | "end" | "pageUp" | "pageDown";

function clampItem(shelves: readonly ShelfShape[], shelf: number, item: number): ShelfPosition {
  const count = shelves[shelf]?.count ?? 0;
  return { shelf, item: Math.max(0, Math.min(item, Math.max(0, count - 1))) };
}

/**
 * The next position for `intent` from `current`, over `shelves` (in shelf
 * order). Out-of-range input (an empty `shelves`, or a `current` naming a
 * shelf/item that no longer exists — the roster was just filtered) clamps
 * rather than throwing, since a stale focus position is exactly what a filter
 * change produces every time.
 */
export function moveShelfFocus(
  shelves: readonly ShelfShape[],
  current: ShelfPosition,
  intent: ShelfNavIntent,
): ShelfPosition {
  if (shelves.length === 0) return { shelf: 0, item: 0 };
  const shelf = Math.max(0, Math.min(current.shelf, shelves.length - 1));
  const item = Math.max(0, Math.min(current.item, Math.max(0, shelves[shelf]!.count - 1)));

  switch (intent) {
    case "left":
      return clampItem(shelves, shelf, item - 1);
    case "right":
      return clampItem(shelves, shelf, item + 1);
    case "up":
      return shelf === 0 ? { shelf, item } : clampItem(shelves, shelf - 1, item);
    case "down":
      return shelf === shelves.length - 1 ? { shelf, item } : clampItem(shelves, shelf + 1, item);
    case "home":
      return { shelf, item: 0 };
    case "end":
      return clampItem(shelves, shelf, shelves[shelf]!.count - 1);
    case "pageUp":
      return shelf === 0 ? { shelf, item: 0 } : clampItem(shelves, shelf - 1, item);
    case "pageDown":
      return shelf === shelves.length - 1
        ? clampItem(shelves, shelf, shelves[shelf]!.count - 1)
        : clampItem(shelves, shelf + 1, item);
  }
}

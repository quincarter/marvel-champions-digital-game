/**
 * "Drill into the packs for the selection" (the owner's explicit W2b second-pass ask): a pack-shelf roster's own
 * header (or a "SEE ALL N ▸" chip at its right end) opens that one pack as a full wrapped grid of every item it
 * holds, with "◂ ALL PACKS" to return; search keeps filtering inside the drilled-in pack, and choosing an item
 * works identically in both views (`scenes/scenario-select.ts`/`scenes/seats.ts` route the same `onClick` either
 * way — this module only decides *which items are on screen*, never what picking one does).
 *
 * Pure, so the state transitions and the grid arithmetic are Vitest-tested without a live Phaser scene.
 */

export interface ShelfDrillState {
  /** Null = every pack, as horizontally-scrolling shelves. Set = one pack, as a full wrapped grid. */
  readonly packId: string | null;
}

export const ALL_PACKS: ShelfDrillState = { packId: null };

/** Opens `packId` as a full grid — the shelf header or its "SEE ALL N ▸" chip. */
export function drillIntoPack(packId: string): ShelfDrillState {
  return { packId };
}

/** "◂ ALL PACKS" — back to every shelf. */
export function drillOut(): ShelfDrillState {
  return ALL_PACKS;
}

/**
 * How many of a fixed card width fit across `availableWidth` (never fewer than one, so a column narrower than a
 * single card still gets a one-wide grid rather than dividing by zero or a negative count).
 */
export function gridColumnsFor(availableWidth: number, cardWidth: number, gap: number): number {
  return Math.max(1, Math.floor((availableWidth + gap) / (cardWidth + gap)));
}

/** Groups `items` into rows of `columns`, in order — the last row may be shorter. */
export function gridRowsOf<T>(items: readonly T[], columns: number): readonly (readonly T[])[] {
  const cols = Math.max(1, columns);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return rows;
}

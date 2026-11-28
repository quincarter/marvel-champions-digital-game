/**
 * Where each of the store's lists was scrolled to, by what it shows (a tab's grid, a pack's gallery): kept across the
 * redraws a tab or a pack page makes, and across visits. A list element reads its place back when its `listId` comes
 * round again, and a new filter sets one to the top (`keepScroll(id, 0)`).
 */
const kept = new Map<string, number>();

export const keptScroll = (id: string): number => kept.get(id) ?? 0;

export const keepScroll = (id: string, top: number): void => {
  if (id !== "") kept.set(id, top);
};

/** Puts `scroller` where the list `id` was left. */
export function restoreScroll(id: string, scroller: HTMLElement | null): void {
  if (!scroller) return;
  const top = keptScroll(id);
  if (scroller.scrollTop !== top) scroller.scrollTop = top;
}

/** The slots screens leave for the dark mode toggle (#459, `scenes/theme-button.ts`), by scene key. */
import type { Rect } from "../view/layout.js";

const slots = new Map<string, Rect>();

/**
 * A screen whose top edge is its own panel's header (Settings) leaves the toggle a slot there, by scene key, rather
 * than have it float over the panel's border. Null clears it.
 */
export function setThemeSlot(sceneKey: string, rect: Rect | null): void {
  if (rect) slots.set(sceneKey, rect);
  else slots.delete(sceneKey);
}

export function themeSlots(): ReadonlyMap<string, Rect> {
  return slots;
}

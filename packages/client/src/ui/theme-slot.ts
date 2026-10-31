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

let shown: Rect | null = null;

/** Where the toggle is drawn now, or null while it is hidden. */
export function shownThemeButton(): Rect | null {
  return shown;
}

export function setShownThemeButton(rect: Rect | null): void {
  shown = rect;
}

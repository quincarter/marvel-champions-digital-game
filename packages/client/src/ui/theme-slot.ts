/**
 * Where the dark mode toggle (#459, `scenes/theme-button.ts`) is drawn now, or null while it is hidden: a screen's focus
 * route reads it to take the button as a stop (`scenes/focus-route.ts`), as it does the music and Report buttons.
 */
import type { Rect } from "../view/layout.js";

let shown: Rect | null = null;
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

export function shownThemeButton(): Rect | null {
  return shown;
}

export function setShownThemeButton(rect: Rect | null): void {
  shown = rect;
}

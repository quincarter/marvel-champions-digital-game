/**
 * The top-bar slots screens leave for the music button (#191, `scenes/music-button.ts`), by scene key: just left of the
 * Report button's (`ui/report-slot.ts`). The button draws in the slot of the topmost running screen that has one, by
 * the same rule as the Report button (`view/report-button.ts`).
 */
import type { Rect } from "../view/layout.js";

const slots = new Map<string, Rect>();
let shown: Rect | null = null;

export function setMusicSlot(sceneKey: string, rect: Rect | null): void {
  if (rect) slots.set(sceneKey, rect);
  else slots.delete(sceneKey);
}

export function musicSlots(): ReadonlyMap<string, Rect> {
  return slots;
}

/** Where the music button is drawn now, or null while it is hidden: the music player opens from it. */
export function shownMusicButton(): Rect | null {
  return shown;
}

export function setShownMusicButton(rect: Rect | null): void {
  shown = rect;
}

/**
 * The top-bar slots screens leave for the Report button (#176, `view/report-button.ts`), by scene key. A screen sets
 * its slot each time it lays its top bar out; the button draws in the slot of the topmost running screen that has one.
 */
import type { Rect } from "../view/layout.js";

const slots = new Map<string, Rect>();

export function setReportSlot(sceneKey: string, rect: Rect | null): void {
  if (rect) slots.set(sceneKey, rect);
  else slots.delete(sceneKey);
}

export function reportSlots(): ReadonlyMap<string, Rect> {
  return slots;
}

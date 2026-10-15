/**
 * The right-hand rect a screen offers the choice sheet to dock in, or null for the centered sheet. A screen that
 * hosts decisions beside its own content (`scenes/setup-deal.ts`) publishes it each time it lays out; the sheet
 * reads it as it draws and clears nothing: the publisher withdraws it when it goes.
 */
import type { Rect } from "./layout.js";

let dock: Rect | null = null;

export function setChoiceDock(next: Rect | null): boolean {
  const same =
    dock === next ||
    (dock !== null &&
      next !== null &&
      dock.x === next.x &&
      dock.y === next.y &&
      dock.width === next.width &&
      dock.height === next.height);
  dock = next;
  return !same;
}

export function choiceDock(): Rect | null {
  return dock;
}

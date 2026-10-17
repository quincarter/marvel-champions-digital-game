/**
 * The rect a screen offers the choice sheet to dock in, or null for the centered sheet. A screen that hosts decisions
 * beside its own content publishes it each time it lays out (`scenes/setup-deal.ts`'s right-hand column, the docked
 * villain phase's panel in `scenes/villain-phase.ts`); the sheet reads it as it draws and clears nothing: the publisher
 * withdraws it when it goes.
 */
import type { Rect } from "./layout.js";

export interface ChoiceDockOptions {
  /** Show the source card as a strip inside the docked sheet (the villain phase: the revealed card that asks). */
  readonly sourceStrip?: boolean;
  /** Dock on a phone too (the villain phase's tab, between the chrome and the hand); otherwise a phone keeps the sheet. */
  readonly onPhone?: boolean;
}

let dock: Rect | null = null;
let options: ChoiceDockOptions = {};

/** True when the dock or its options changed, so the publisher knows to ask an open sheet to redraw. */
export function setChoiceDock(next: Rect | null, nextOptions: ChoiceDockOptions = {}): boolean {
  const kept = next ? nextOptions : {};
  const same =
    (dock === next ||
      (dock !== null &&
        next !== null &&
        dock.x === next.x &&
        dock.y === next.y &&
        dock.width === next.width &&
        dock.height === next.height)) &&
    options.sourceStrip === kept.sourceStrip &&
    options.onPhone === kept.onPhone;
  dock = next;
  options = kept;
  return !same;
}

export function choiceDock(): Rect | null {
  return dock;
}

export function choiceDockOptions(): ChoiceDockOptions {
  return options;
}

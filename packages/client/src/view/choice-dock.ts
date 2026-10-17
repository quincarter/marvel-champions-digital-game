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

/**
 * What a screen hosting the full-screen sheet offers it (#231): the docked villain phase, after the player pressed
 * EXPAND, gives the sheet COLLAPSE (back into the dock) and PEEK AT TABLE (back into the dock, tucked away to show the
 * table). The sheet draws a control for each one given. `key` says when it changed, so the host redraws the sheet.
 */
export interface ChoiceSheetHost {
  readonly key: string;
  readonly collapse?: () => void;
  readonly peek?: () => void;
}

let host: ChoiceSheetHost | null = null;

/** True when the host changed (by key), so the publisher knows to ask an open sheet to redraw. */
export function setChoiceSheetHost(next: ChoiceSheetHost | null): boolean {
  const changed = (host?.key ?? null) !== (next?.key ?? null);
  host = next;
  return changed;
}

export function choiceSheetHost(): ChoiceSheetHost | null {
  return host;
}

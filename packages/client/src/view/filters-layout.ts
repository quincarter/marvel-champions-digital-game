/**
 * Where the filter chips sit on Scenario select and Take your seats: always in view on a wide screen, behind a
 * Filters button on a narrow one or while a controller is in use (the owner, 2026-10-24: 21 pack chips in four rows
 * took the top of the page on a Steam Deck, and a phone has less room still).
 */

/**
 * Game width under which the chips go behind the Filters button, for every input. 1000 sits between the 768 phone
 * break (`formFactorFor`) and the 1024 tablet reference viewport: a tablet held landscape keeps its chips, a
 * narrowed window or a couch-scaled game (which shrinks the effective game width) folds them away.
 */
export const FILTERS_BREAKPOINT = 1000;

/** The Filters button's width, wide enough for "Filters (3) ▾". */
export const FILTERS_BUTTON_WIDTH = 156;

/** Whether the chips are behind the Filters button at this size: always in pad mode, else below the breakpoint. */
export function filtersBehindButton(gameWidth: number, padMode: boolean): boolean {
  return padMode || gameWidth < FILTERS_BREAKPOINT;
}

/** The button's text: "Filters", or "Filters (2)" with filters set, then ▸ shut or ▾ open. */
export function filtersLabel(activeCount: number, open: boolean): string {
  return `Filters${activeCount > 0 ? ` (${activeCount})` : ""} ${open ? "▾" : "▸"}`;
}

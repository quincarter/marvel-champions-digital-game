/**
 * What every Scenario select element says to the scene: one `mc-scenario-select` event whose `detail` is a
 * `ScenarioSelectDetail`. A feature's own events share one name (`packages/ui/ARCHITECTURE.md`), and that name is in
 * `GUARDED_EVENTS` (`dom/dom-region.ts`) so the region holds them back while its scene is not taking input.
 *
 * The keys are the screen's action keys, the same ones the old panel used: `back`, `scenario-search-toggle`,
 * `filters-toggle`, `scenario-chip:<id>`, `random-box`, `random-scenario`, `random-villain`, `drill-back`,
 * `stages-toggle`, `customize` and `next` for a press; `entry:<id>`, `fold:<shelf>`, `all:<shelf>` and `clear` for a
 * tap in the roster.
 */
export const SCENARIO_SELECT_EVENT = "mc-scenario-select";

export type ScenarioSelectDetail =
  /** A control was pressed (a tap, or Enter on its focus stop). */
  | { readonly type: "press"; readonly key: string }
  /** A tap in the shelves: a tile, a shelf's fold header, its See all, or the empty state's Clear. */
  | { readonly type: "tile"; readonly key: string }
  /** A hold or right-click on a tile. */
  | { readonly type: "inspect"; readonly key: string }
  /** The search field's text (after its typing pause). */
  | { readonly type: "search"; readonly value: string };

declare global {
  interface HTMLElementEventMap {
    "mc-scenario-select": CustomEvent<ScenarioSelectDetail>;
  }
}

/** Raises one `mc-scenario-select` from `source`. */
export function raiseScenarioSelect(source: EventTarget, detail: ScenarioSelectDetail): void {
  source.dispatchEvent(
    new CustomEvent<ScenarioSelectDetail>(SCENARIO_SELECT_EVENT, { detail, bubbles: true, composed: true }),
  );
}

/** Re-raises a child's `mc-press` (a button's tap) as a `press` of `key`, and keeps the child's own event from escaping. */
export function pressOf(source: EventTarget, key: string): (event: Event) => void {
  return (event) => {
    event.stopPropagation();
    raiseScenarioSelect(source, { type: "press", key });
  };
}

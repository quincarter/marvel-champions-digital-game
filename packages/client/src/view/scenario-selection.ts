/**
 * Which scenario Scenario select treats as picked once a filter chip or the search has narrowed the shelf. The
 * right-hand panel and "Choose heroes" follow the selection, so it must always be something the shelf shows: a
 * selection the filter hides moves to the first scenario still visible (the shelf's own order). With nothing visible
 * at all there is nothing to pick, and the screen disables "Choose heroes" rather than starting a hidden scenario.
 * Chips and search both go through this, so they behave the same.
 */
export interface ScenarioSelection {
  /** The scenario id the panel shows and "Choose heroes" starts; `null` while the player has picked none yet. */
  readonly selectedId: string | null;
  /** False when the shelf shows no scenario at all: "Choose heroes" is disabled. */
  readonly canContinue: boolean;
}

export function selectionAmongVisible(selectedId: string | null, visibleIds: readonly string[]): ScenarioSelection {
  // Nothing is picked until the player picks (a fresh New game): no scenario is moved into the pick for them.
  if (selectedId === null) return { selectedId: null, canContinue: false };
  if (visibleIds.length === 0) return { selectedId, canContinue: false };
  if (visibleIds.includes(selectedId)) return { selectedId, canContinue: true };
  return { selectedId: visibleIds[0]!, canContinue: true };
}

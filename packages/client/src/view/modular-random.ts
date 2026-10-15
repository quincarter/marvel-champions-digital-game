/**
 * Table setup's Random button for modular sets: a legal set of picks drawn at random from the sets the picker would let
 * the table choose by hand (the scenario's candidates, minus another product's locked sets, barred pairings and the
 * other side's sets). A scenario with its own pool (MojoMania) keeps its Random chip instead, and one that takes no
 * modular set (Breakout) has nothing to draw. The draw only fills the draft's picks: the game log records them, so a
 * replay never draws again.
 */
import type { AnyCard, Scenario } from "@mc/content";
import { modularPickRangeFor, modularSetOptionsFor, type ModularPickerContext } from "./modular-sets.js";
import { setModularSetIds, type SetupDraft } from "./setup-draft.js";

/** Whether the scenario offers the Random button: it takes modular sets and has no pool of its own. */
export function offersRandomModularSets(scenario: Scenario, playerCount: number): boolean {
  if (scenario.modularSetPool) return false;
  return modularPickRangeFor(scenario, playerCount).max > 0;
}

/**
 * `count` sets drawn without repeats from the sets the table could pick by hand, or null when the scenario offers no
 * Random button or has too few candidates. `random` returns a number in [0, 1), like `Math.random`.
 */
export function randomModularSetIds(
  draft: SetupDraft,
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
  random: () => number = Math.random,
  context: ModularPickerContext = {},
): readonly string[] | null {
  const playerCount = draft.seats.length;
  if (!offersRandomModularSets(scenario, playerCount)) return null;
  const count = modularPickRangeFor(scenario, playerCount).max;
  // With nothing chosen no tile is held back by the cap, so every disabled tile is one the table may never pick.
  const pool = modularSetOptionsFor(setModularSetIds(draft, []), scenario, cardsById, context)
    .filter((option) => option.kind === "set" && option.disabledReason === null)
    .map((option) => option.id);
  if (pool.length < count) return null;
  const picks: string[] = [];
  const left = [...pool];
  while (picks.length < count) {
    const index = Math.min(left.length - 1, Math.floor(random() * left.length));
    picks.push(left.splice(index, 1)[0]!);
  }
  return picks;
}

/** The draft with its modular picks replaced by a random draw, or unchanged when the scenario offers no draw. */
export function withRandomModularSets(
  draft: SetupDraft,
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
  random: () => number = Math.random,
  context: ModularPickerContext = {},
): SetupDraft {
  const picks = randomModularSetIds(draft, scenario, cardsById, random, context);
  return picks ? setModularSetIds(draft, picks) : draft;
}

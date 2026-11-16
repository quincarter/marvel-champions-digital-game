/**
 * Scenario select's Random choices (issue #762), one per step of choosing a scenario: the box (a shelf), the villain
 * (a scenario inside a box), or both at once. Each picks only among what that step offers right now, so the filters,
 * the installed packs and the scripted-only pool are already applied by the shelves it is handed. `random` returns a
 * number in [0, 1), like `Math.random`, the app's usual source (the same one `rollSeed` and Civil War's Random use).
 */
import type { Shelf } from "./roster-shelves.js";

export type RandomSource = () => number;

const pickOne = <T>(items: readonly T[], random: RandomSource): T | null =>
  items.length === 0 ? null : (items[Math.min(items.length - 1, Math.floor(random() * items.length))] ?? null);

/** The shelves that hold at least one scenario, `isScenario` leaving out a tile that is not one ("Build your own"). */
export function randomBoxOptions<T>(
  shelves: readonly Shelf<T>[],
  isScenario: (item: T) => boolean,
): readonly Shelf<T>[] {
  return shelves.filter((shelf) => shelf.items.some(isScenario));
}

/** Step one, the box: a random shelf of the ones offered, or null when none offers a scenario. */
export function randomBox<T>(
  shelves: readonly Shelf<T>[],
  isScenario: (item: T) => boolean,
  random: RandomSource,
): Shelf<T> | null {
  return pickOne(randomBoxOptions(shelves, isScenario), random);
}

/** Step two, the villain: a random scenario of one box, or null when it holds none. */
export function randomVillainIn<T>(shelf: Shelf<T>, isScenario: (item: T) => boolean, random: RandomSource): T | null {
  return pickOne(shelf.items.filter(isScenario), random);
}

/** Both steps: a random box, then a random scenario in it. */
export function randomScenario<T>(
  shelves: readonly Shelf<T>[],
  isScenario: (item: T) => boolean,
  random: RandomSource,
): { readonly shelf: Shelf<T>; readonly item: T } | null {
  const shelf = randomBox(shelves, isScenario, random);
  const item = shelf ? randomVillainIn(shelf, isScenario, random) : null;
  return shelf && item ? { shelf, item } : null;
}

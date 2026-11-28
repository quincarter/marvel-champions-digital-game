/** The Random buttons above Choose a scenario's list (#762): what each one lands on. */
import type { Scenario } from "@mc/content";
import { unlocks } from "../../progression/progression.js";
import { isBuilderTile, type RosterEntry } from "../../view/civil-war-entry.js";
import { randomBox, randomScenario, randomVillainIn } from "../../view/scenario-random.js";
import type { Shelf } from "../../view/roster-shelves.js";

export type RandomKind = "random-box" | "random-scenario" | "random-villain";

/** A box to open as its own grid, or a scenario to pick (in its shelf). */
export type RandomOutcome =
  | { readonly kind: "box"; readonly shelfId: string }
  | { readonly kind: "scenario"; readonly shelfId: string; readonly entry: Scenario };

/** What Random may land on: a scenario that is on offer now, so not the builder tile and not one still locked. */
const isPick = (entry: RosterEntry): boolean => !isBuilderTile(entry) && unlocks().scenarioLock(entry) === null;

/**
 * Step one (`random-box`): a random box of the ones showing. Both steps at once (`random-scenario`): a random box, then a
 * random villain in it. Step two (`random-villain`): a random villain of the box that is open.
 */
export function randomOutcome(
  kind: RandomKind,
  shelves: readonly Shelf<RosterEntry>[],
  openBox: string | null,
  random: () => number = Math.random,
): RandomOutcome | null {
  if (kind === "random-box") {
    const shelf = randomBox(shelves, isPick, random);
    return shelf ? { kind: "box", shelfId: shelf.id } : null;
  }
  if (kind === "random-scenario") {
    const pick = randomScenario(shelves, isPick, random);
    return pick && !isBuilderTile(pick.item) ? { kind: "scenario", shelfId: pick.shelf.id, entry: pick.item } : null;
  }
  const shelf = shelves.find((s) => s.id === openBox);
  const item = shelf ? randomVillainIn(shelf, isPick, random) : null;
  return shelf && item && !isBuilderTile(item) ? { kind: "scenario", shelfId: shelf.id, entry: item } : null;
}

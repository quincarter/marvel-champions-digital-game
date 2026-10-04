/**
 * The modular picker's view of what the player has open (`view/modular-candidates.ts`'s `ModularScope`), read from the
 * same `unlocks()` the deck builder and Scenario select ask, so `?unlock=all` and the Unlock-everything setting open the
 * same sets there.
 */
import type { ModularScope } from "../view/modular-candidates.js";
import { unlocks } from "./progression.js";

export function progressionScope(): ModularScope {
  const open = unlocks();
  return { isCycleOpen: (cycleId) => open.waveLock(cycleId) === null, officialPrintAndPlay: open.officialPrintAndPlay };
}

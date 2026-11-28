/** A fresh New game draft (`newGameDraft`), shared by the Title, the first-run chooser and the room lobby. */
import { POOL_SCENARIOS } from "../content/pool.js";
import { initialSetupDraft } from "../view/setup-draft.js";
import { rollSeed } from "../view/seed.js";

/**
 * A fresh New game draft: a new seed, every seat blank and, by default, no villain picked. Nothing is preselected
 * (owner, 2026-10-26): Scenario select and Take your seats each wait for the player's pick. `picked` seeds the pool's
 * first scenario as the pick, for the two entries that skip Scenario select (Civil War!'s builder, "Play this deck").
 * Shared with the first-run chooser (`scenes/guide-chooser.ts`), whose "Hints only" / "No guide" continue straight
 * into scenario select.
 */
export function newGameDraft(picked = false): ReturnType<typeof initialSetupDraft> {
  return initialSetupDraft({
    scenarioId: POOL_SCENARIOS[0]!.id as string,
    seatDeckId: null,
    scenarioPicked: picked,
    seed: rollSeed(),
  });
}

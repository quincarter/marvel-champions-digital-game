/**
 * A real one-seat game stopped on Maria Hill's first turn holding Slingshot (50013) and Energy (50025) (issue #634):
 * Slingshot can be played for 3 or put into play by her own Action, "Spend a [energy] resource → put Slingshot into
 * play from your hand", so a tap on her asks which. Started through the store with `SessionConfig.stack`, never a
 * state edit.
 */
import type { SessionConfig } from "../engine/host.js";
import { ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const SLINGSHOT_CARD = "50013";
export const SLINGSHOT_ACTION = "50013.slingshot-action";
export const ENERGY_CARD = "50025";

export const SLINGSHOT_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "maria-hill-leadership" }],
  seed: 3,
  stack: { players: { 0: ids(SLINGSHOT_CARD, ENERGY_CARD) } },
};

export async function startSlingshotDevGame(store: SessionStore): Promise<void> {
  await store.start(SLINGSHOT_DEV_CONFIG);
  await nextTurn(store);
}

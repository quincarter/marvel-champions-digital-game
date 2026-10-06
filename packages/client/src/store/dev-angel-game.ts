/**
 * A real one-seat game stopped on the board with Angel (42001) in alter-ego form on his own turn: his identity has three
 * faces (Warren Worthington III / Angel / Archangel), so the board's change-form control must ask which hero face.
 * Started through the store, never a state edit.
 */
import type { SessionConfig } from "../engine/host.js";
import { nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const ANGEL_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "angel-protection" }],
  seed: 3,
};

export async function startAngelDevGame(store: SessionStore): Promise<void> {
  await store.start(ANGEL_DEV_CONFIG);
  await nextTurn(store);
}

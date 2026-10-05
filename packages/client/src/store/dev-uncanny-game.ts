/**
 * A real two-hero game stopped where a play asks whose play area: Storm beside Wolverine, both in alter-ego, with
 * Uncanny X-Men (36018, "Play under any player's control") in Storm's hand and enough other cards to pay for it.
 * Started with `SessionConfig.stack` (the opening hand), never a state edit, so it replays byte for byte like any saved
 * game. Kept out of `boot.ts`; `dev-uncanny-game.test.ts` proves it reaches the state it claims.
 */
import type { SessionConfig } from "../engine/host.js";
import { copies, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const UNCANNY_CARD = "36018";

export const UNCANNY_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "storm-leadership" }, { starterDeckId: "wolverine-aggression" }],
  seed: 1,
  stack: { players: { 0: ids(UNCANNY_CARD, ...copies("36020", 3), ...copies("36019", 2)) } },
};

export async function startUncannyDevGame(store: SessionStore): Promise<void> {
  await store.start(UNCANNY_DEV_CONFIG);
  await nextTurn(store);
}

/** The same hand with Storm alone at the table: one seat to play under, so nothing to ask. */
export async function startUncannySoloDevGame(store: SessionStore): Promise<void> {
  await store.start({ ...UNCANNY_DEV_CONFIG, players: [UNCANNY_DEV_CONFIG.players[0]!] });
  await nextTurn(store);
}

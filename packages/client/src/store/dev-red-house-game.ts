/**
 * A real Red Skull game stopped on Spider-Man's first turn in hero form, with The Red House (04139, "they may use
 * their ATK instead of their THW") there to thwart, for `e2e/red-house-thwart-stat.spec.ts` and its screenshots
 * (issue #365). Played forward through the store with the engine's own example commands, never a state edit.
 */
import type { SessionConfig } from "../engine/host.js";
import { nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const RED_HOUSE = "04139";

export const redHouseConfig = (): SessionConfig => ({
  scenarioId: "red-skull",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 1,
});

/** Starts the game and flips Peter Parker to Spider-Man (an alter-ego cannot thwart). */
export async function startRedHouseGame(store: SessionStore): Promise<void> {
  await store.start(redHouseConfig());
  const turn = await nextTurn(store);
  const flip = turn?.legal.find((entry) => entry.action.kind === "changeForm");
  if (flip) await store.dispatch(flip.example);
  await nextTurn(store);
}

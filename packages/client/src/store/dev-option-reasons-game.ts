/**
 * The `?screen=board&fixture=option-reasons` dev jump (#412): a real Spider-Man game against Rhino that plays Nick Fury
 * on the first turn, before any threat is on a scheme, so his "choose one" lists "Remove 2 threat from a scheme"
 * disabled with why beside the two options offered. Played forward on the engine's own commands from a stacked setup.
 */
import { appSession } from "../session.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** Plays the game up to Nick Fury's choice. Shared with the test that reads the choice. */
export async function playToNickFuryChoice(store: SessionStore): Promise<void> {
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    stack: { players: { 0: ids("01084") } },
  });
  const turn = await nextTurn(store);
  const game = store.state.game!;
  // Threat on the main scheme would make the option available: this fixture is about the one that is not.
  if (game.instances[game.mainScheme.instanceId]!.threat > 0) return;
  const fury = turn?.legal.find(
    (entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === "01084",
  );
  if (fury) await store.dispatch(fury.example);
}

export async function startDevOptionReasonsGame(): Promise<void> {
  await playToNickFuryChoice(appSession().store);
}

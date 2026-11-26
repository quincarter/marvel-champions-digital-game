/**
 * The `?screen=board&fixture=engaged-target` dev jump (`scenes/boot-dev-jump.ts`): Iron Man and Spider-Man against
 * Ultron, each seat with its own facedown Drone (the same card back twice), stopped on Repulsor Blast's (01031) "Deal 1
 * damage to an enemy" question, so the choice sheet's Drone tiles say who each is engaged with (issue #1001).
 * `dev-engaged-target-game.test.ts` proves it.
 *
 * Played forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state
 * edit: the setup decisions take their minimum, Iron Man flips to hero form and plays Repulsor Blast.
 */
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

const REPULSOR_BLAST = "01031";

export const ENGAGED_TARGET_CONFIG: SessionConfig = {
  scenarioId: "ultron",
  difficulty: "standard",
  players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
  seed: 1,
  // Repulsor Blast and resources to pay for it, twice over in case a copy is set aside at setup.
  stack: { players: { 0: ids("01088", "01089", "01090", REPULSOR_BLAST, REPULSOR_BLAST) } },
};

/** Starts the game and plays it forward to Repulsor Blast's choose-an-enemy question. */
export async function startEngagedTargetGame(store: SessionStore): Promise<void> {
  await store.start(ENGAGED_TARGET_CONFIG);
  for (let step = 0; step < 24 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const first = store.state.legal?.actions;
  const flip = first?.kind === "turn" ? first.legal.find((entry) => entry.action.kind === "changeForm") : undefined;
  if (flip) await store.dispatch(flip.example);
  const turn = store.state.legal?.actions;
  const game = store.state.game;
  if (turn?.kind !== "turn" || !game) return;
  const blast = turn.legal.find(
    (entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === REPULSOR_BLAST,
  );
  if (blast) await store.dispatch(blast.example);
}

/**
 * The `?screen=board&fixture=upgraded-drones` dev jump (`scenes/boot-dev-jump.ts`): a real solo Ultron game whose
 * first villain phase (seed 6) deals Upgraded Drones (`core` 01142) onto the Ultron Drones environment, then Iron
 * Man's next turn in hero form, holding an [energy], a [mental] and a [physical] resource, so the attachment's "Spend
 * [energy] [mental] [physical] resources → discard this card" is usable from its strip on the environment (issue #462).
 * The encounter deck can't be stacked here: The Crimson Cowl's Setup shuffles it. Played forward through the store
 * with the engine's own example commands, never a state edit.
 */
import type { SessionConfig } from "../engine/host.js";
import { ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const UPGRADED_DRONES_CONFIG: SessionConfig = {
  scenarioId: "ultron",
  difficulty: "standard",
  players: [{ starterDeckId: "core-iron-man-aggression" }],
  seed: 6,
  stack: { players: { 0: ids("01088", "01089", "01090") } },
};

export async function startUpgradedDronesGame(store: SessionStore): Promise<void> {
  await store.start(UPGRADED_DRONES_CONFIG);
  for (let round = 0; round < 4; round++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    if (Object.values(game.instances).some((card) => card.cardId === "01142" && card.attachedTo !== null)) {
      const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
      return;
    }
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}

/**
 * The `?screen=board&fixture=tech-hand` dev jump (`scenes/boot-dev-jump.ts`): a real solo Rhino game with Iron Man in
 * hero form and Tech upgrades he has paid for and played, so his identity panel shows a hand size above the printed 1.
 * Played forward through the store with the engine's own example commands, never a state edit.
 */
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

const TECH = new Set(["01035", "01037", "01039"]);

export const TECH_HAND_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-iron-man-aggression" }],
  seed: 1,
  stack: { players: { 0: ids("01035", "01037", "01039", "01088", "01089", "01090", "01054", "01054") } },
};

export async function startTechHandGame(store: SessionStore): Promise<void> {
  await store.start(TECH_HAND_CONFIG);
  for (let step = 0; step < 12; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    if (me.identity.form === "alterEgo") {
      const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
      if (!flip) return;
      await store.dispatch(flip.example);
      continue;
    }
    const worn = game.instances[me.identity.instanceId]?.attachments ?? [];
    if (worn.filter((id) => TECH.has(codeOf(game, id))).length >= 2) return;
    // The engine's own example command pays for the card from the rest of the hand.
    const tech = turn.legal.find(
      (entry) => entry.action.kind === "playCard" && TECH.has(codeOf(game, entry.action.instanceId)),
    );
    if (!tech) return;
    await store.dispatch(tech.example);
  }
}

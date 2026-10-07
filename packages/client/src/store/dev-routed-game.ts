/**
 * A real one-seat Morlock Siege game (She-Hulk, Aggression) stopped on her own turn with the first villain defeated
 * and tucked under Routed (MC40 p. 9; 40081a "Forced Response: After the villain is defeated, put it under here"), so
 * the board has a card under the environment and one villain out of play. Played forward through the store with basic
 * attacks on the villain, never a state edit, so it replays byte for byte like any saved game.
 * `dev-routed-game.test.ts` proves it reaches the state.
 */
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const ROUTED_DEV_CONFIG: SessionConfig = {
  scenarioId: "morlock-siege",
  difficulty: "standard",
  modularSetIds: ["military_grade", "mutant_slayers"],
  players: [{ starterDeckId: "core-she-hulk-aggression" }],
  seed: 5,
  stack: { players: { 0: ids("01054", "01054", "01053", "01053") } },
};

const STRIKES = ["01054", "01053"];

/** Each turn: hero form, one basic attack on the active villain, end turn; stops when a card sits under an environment. */
export async function startRoutedDevGame(store: SessionStore): Promise<void> {
  await store.start(ROUTED_DEV_CONFIG);
  for (let step = 0; step < 200; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    if (game.villainArea.some((id) => (game.instances[id]?.tucked.length ?? 0) > 0)) return;
    const pick = (kind: string) => turn.legal.find((entry) => entry.action.kind === kind);
    const flip = pick("changeForm");
    const attack = pick("basicAttack");
    const strike = turn.legal.find(
      (entry) =>
        entry.action.kind === "playCard" &&
        STRIKES.includes(codeOf(game, (entry.action as { instanceId: string }).instanceId)),
    );
    const villainId = game.activeVillainId;
    if (flip && game.players[0]!.identity.form === "alterEgo") {
      await store.dispatch(flip.example);
    } else if (strike) {
      await store.dispatch(strike.example);
    } else if (attack && attack.targets.includes(villainId)) {
      await store.dispatch({ ...attack.example, targetInstanceId: villainId } as never);
    } else {
      const end = pick("endTurn");
      if (!end) return;
      await store.dispatch(end.example);
    }
  }
}

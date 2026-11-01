/**
 * The `?screen=board&fixture=sync-ratio` dev jump (`scenes/boot-dev-jump.ts`): a real solo Rhino game with SP//dr in hero
 * form and a second Interface upgrade played last round, so paying for a card offers Sync Ratio once per
 * Interface (issue #601). Played forward through the store with the engine's own example commands, never a state edit.
 */
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** Speed-Metal Alloy, the cheapest Interface. */
const INTERFACE = "31012";

export const SYNC_RATIO_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "spdr-protection" }],
  seed: 1,
  stack: { players: { 0: ids(INTERFACE) } },
};

export async function startSyncRatioGame(store: SessionStore): Promise<void> {
  await store.start(SYNC_RATIO_CONFIG);
  let played = false;
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
    // Its payment exhausts SP//dr, so a turn ends and the next round starts with both Interfaces ready.
    if (played) {
      const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
      if (end && game.round === 1) await store.dispatch(end.example);
      else return;
      continue;
    }
    const interfaceCard = turn.legal.find(
      (entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === INTERFACE,
    );
    if (!interfaceCard) return;
    await store.dispatch(interfaceCard.example);
    played = true;
  }
}

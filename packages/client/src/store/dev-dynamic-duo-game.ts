/**
 * The `?screen=board&fixture=dynamic-duo` dev jump (`scenes/boot-dev-jump.ts`): a solo Luke Cage game in hero form with
 * Dynamic Duo and both of the precon's Team-Up cards in hand, so its search finds nothing unless one of them pays for it
 * and the pay bar says so (issue #966). Played forward through the store with the engine's own commands.
 */
import type { SessionConfig } from "../engine/host.js";
import { ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const DYNAMIC_DUO_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "luke-cage-leadership" }],
  seed: 4,
  // Dynamic Duo, Power Man and Iron Fist, Unbreakable Bond: the precon's only Team-Up cards.
  stack: { players: { 0: ids("62022", "62023", "62024") } },
};

export async function startDynamicDuoGame(store: SessionStore): Promise<void> {
  await store.start(DYNAMIC_DUO_CONFIG);
  const turn = await nextTurn(store);
  const game = store.state.game;
  if (!turn || !game || game.players[0]!.identity.form !== "alterEgo") return;
  const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
  if (flip) await store.dispatch(flip.example);
}

/**
 * The `?screen=board&fixture=stat-stars&ally=<name>` dev jump (`scenes/boot-dev-jump.ts`, issue #935): a real Rhino
 * game with one ally that prints consequential damage (and, for Cypher and Chamber, a star by ATK) played on the first
 * turn, for checking the stat badges against the printed card at every card size. Played forward through the store
 * with `SessionConfig.stack` and the engine's own commands, never a state edit.
 */
import type { InstanceId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** Each ally the issue shows, with the precon that holds it. */
export const STAT_STAR_ALLIES = {
  cypher: { code: "41013", starterDeckId: "psylocke-justice" },
  chamber: { code: "47011", starterDeckId: "jubilee-justice" },
  clea: { code: "09013", starterDeckId: "drs-protection" },
} as const;

export type StatStarAlly = keyof typeof STAT_STAR_ALLIES;

export const isStatStarAlly = (name: string | null): name is StatStarAlly =>
  name !== null && Object.hasOwn(STAT_STAR_ALLIES, name);

export function statStarsConfig(ally: StatStarAlly): SessionConfig {
  const { code, starterDeckId } = STAT_STAR_ALLIES[ally];
  return {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId }],
    seed: 5,
    stack: { players: { 0: ids(code) } },
  };
}

/** Starts the game and plays the ally from hand on the first turn; returns its instance id, or null if it could not. */
export async function startStatStarsGame(store: SessionStore, ally: StatStarAlly): Promise<InstanceId | null> {
  await store.start(statStarsConfig(ally));
  const { code } = STAT_STAR_ALLIES[ally];
  const turn = await nextTurn(store);
  const game = store.state.game;
  if (!turn || !game) return null;
  const play = turn.legal.find(
    (entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === code,
  );
  if (!play || play.example.type !== "playCard" || play.action.kind !== "playCard") return null;
  const allyId = play.action.instanceId;
  const others = game.players[0]!.hand.filter((id) => id !== allyId);
  for (let count = 0; count <= others.length; count++) {
    await store.dispatch({ ...play.example, payment: others.slice(0, count).map((id) => ({ fromHand: id })) });
    if (!store.state.error) return allyId;
  }
  return null;
}

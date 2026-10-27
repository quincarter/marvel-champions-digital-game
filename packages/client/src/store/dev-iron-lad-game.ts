/**
 * The `?screen=board&fixture=iron-lad` dev jump (`scenes/boot-dev-jump.ts`, issue #431): a real solo Rhino game with
 * Hulkling's deck, Iron Lad played on the first turn and sent in for a basic attack with no other Avenger ally on the
 * table, so his interrupt ("exhaust another Avenger ally you control →") cannot be paid, is not offered, and the board
 * says why (`abilityNotOffered`). `&fixture=aneka` is the same with Black Panther's Aneka, whose "choose another Dora Milaje
 * ally" response has no other Dora Milaje ally to choose. `dev-iron-lad-game.test.ts` proves both.
 *
 * Played forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state edit.
 */
import type { GameEvent, InstanceId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const IRON_LAD = "56052";

export const IRON_LAD_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "hulkling-protection" }],
  seed: 7,
  // Iron Lad and four events (Preservation's resource among them) to pay his 2: no other ally in the opening hand.
  stack: { players: { 0: ids(IRON_LAD, "56051", "56048", "56049", "56050") } },
};

export const ANEKA = "51022";

export const ANEKA_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "bp-justice" }],
  seed: 7,
  // Aneka and the three resource cards that pay her 3, and an upgrade: no other Dora Milaje ally in the opening hand.
  stack: { players: { 0: ids(ANEKA, "51027", "51028", "51029", "51019") } },
};

/** The dev games that end on an ability not offered (#431), by the ally that attacks. */
export const NOT_OFFERED_GAMES: Readonly<Record<string, { readonly code: string; readonly config: SessionConfig }>> = {
  "iron-lad": { code: IRON_LAD, config: IRON_LAD_CONFIG },
  aneka: { code: ANEKA, config: ANEKA_CONFIG },
};

/**
 * Starts the game, plays Iron Lad and attacks with him; returns the attack's events (its choices answered with their
 * minimum), or null when the path did not get there. `answer` false leaves the attack's first choice open.
 */
export const playIronLadAttack = (store: SessionStore, answer = true): Promise<readonly GameEvent[] | null> =>
  playAllyAttack(store, "iron-lad", answer);

/** `playIronLadAttack` for any of `NOT_OFFERED_GAMES`. */
export async function playAllyAttack(
  store: SessionStore,
  game: keyof typeof NOT_OFFERED_GAMES,
  answer = true,
): Promise<readonly GameEvent[] | null> {
  const { code, config } = NOT_OFFERED_GAMES[game]!;
  await store.start(config);
  let turn = await nextTurn(store);
  const state = () => store.state.game!;
  const play = turn?.legal.find(
    (entry) => entry.action.kind === "playCard" && codeOf(state(), entry.action.instanceId) === code,
  );
  if (!play || play.example.type !== "playCard") return null;
  const lad: InstanceId = play.example.cardInstanceId;
  await store.dispatch(play.example);
  if (!state().players[0]!.playArea.includes(lad)) return null;
  turn = await nextTurn(store);
  const attack = turn?.legal.find((entry) => entry.action.kind === "basicAttack" && entry.action.instanceId === lad);
  if (!attack) return null;
  await store.dispatch(attack.example);
  const events: GameEvent[] = [...store.state.lastEvents];
  for (let guard = 0; answer && guard < 10 && store.state.legal?.actions.kind === "choice"; guard++) {
    const choice = store.state.legal.actions.choice;
    await store.resolveChoice(choice.options.slice(0, Math.max(1, choice.minSelections)).map((o) => o.optionId));
    events.push(...store.state.lastEvents);
  }
  return events;
}

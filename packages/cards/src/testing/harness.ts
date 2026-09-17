import { cardId } from "@mc/content";
import {
  applyCommand,
  createGame,
  getInstance,
  getPlayer,
  playerId,
  type CardInstance,
  type Command,
  type CostChoices,
  type EngineDeps,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type Payment,
  type PlayerId,
  activeEncounterDeck,
  activeEncounterDeckId,
} from "@mc/engine";
import { CORE_DEPS } from "../core/index.js";

/**
 * Test helpers for real-Core-content games, built only on `@mc/engine`'s
 * public API. State surgery here is test-only (stacking a deck, putting a
 * card in hand) so a ruling test doesn't depend on the shuffle.
 */

export const P1 = playerId("p1");
export const P2 = playerId("p2");
export const P3 = playerId("p3");
export const P4 = playerId("p4");

export type Picker = (state: GameState) => readonly string[];
type PromptKind = NonNullable<GameState["pendingChoice"]>["prompt"]["kind"];

/** Declines every optional thing: no defender, no optional triggers, the fewest selections allowed. */
export const firstLegal: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  if (choice.prompt.kind === "declareDefender") return ["decline"];
  return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
};

export function applyOk(state: GameState, command: Command, deps: EngineDeps = CORE_DEPS): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  return { state: result.state, events: result.events };
}

export const run = (state: GameState, ...commands: readonly Command[]): GameState => runWith(CORE_DEPS, state, ...commands);
/**
 * `run`, with an explicit `deps` — for wave 1 (or any non-Core) content, whose ability ids aren't in `CORE_DEPS`.
 * `packages/cards/src/wave1/testing.ts` wraps this with `WAVE1_DEPS` so a pack's tests read exactly like Core's.
 */
export const runWith = (deps: EngineDeps, state: GameState, ...commands: readonly Command[]): GameState =>
  commands.reduce((s, c) => applyOk(s, c, deps).state, state);

export function answer(state: GameState, selected: readonly string[], deps: EngineDeps = CORE_DEPS): GameState {
  const choice = state.pendingChoice;
  if (!choice) throw new Error("no pending choice");
  return applyOk(state, { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected }, deps).state;
}

/** Answers pending choices with `pick` until none is left, the game ends, or `stop` says so. */
export function settle(state: GameState, pick: Picker = firstLegal, stop?: (state: GameState) => boolean, deps: EngineDeps = CORE_DEPS): GameState {
  let current = state;
  for (let guard = 0; current.pendingChoice && !current.outcome && !stop?.(current); guard++) {
    if (guard > 500) throw new Error(`choices did not settle (stuck on ${current.pendingChoice.prompt.kind})`);
    current = answer(current, pick(current), deps);
  }
  return current;
}

export const settleUntil = (state: GameState, kind: PromptKind, pick: Picker = firstLegal, deps: EngineDeps = CORE_DEPS): GameState =>
  settle(state, pick, (s) => s.pendingChoice?.prompt.kind === kind, deps);

/** A Core (or, with `deps`, any) game past setup, with every opening hand kept. */
export function startCoreGame(config: GameSetupConfig, deps: EngineDeps = CORE_DEPS): GameState {
  const created = createGame(config, deps);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
}

export const toHero = (player: PlayerId = P1): Command => ({ type: "changeForm", playerId: player });
export const changeForm = toHero;
export const endTurn = (player: PlayerId = P1): Command => ({ type: "endTurn", playerId: player });
export const play = (
  player: PlayerId,
  id: InstanceId,
  payment: readonly InstanceId[] = [],
  extra: { readonly attachToInstanceId?: InstanceId; readonly costChoices?: CostChoices; readonly abilities?: readonly Payment[] } = {},
): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [...(extra.abilities ?? []), ...payment.map((fromHand) => ({ fromHand }))],
  attachToInstanceId: extra.attachToInstanceId ?? null,
  ...(extra.costChoices ? { costChoices: extra.costChoices } : {}),
});
export const use = (
  player: PlayerId,
  id: InstanceId,
  ability: string,
  payment: readonly Payment[] = [],
  costChoices?: CostChoices,
): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: id,
  abilityId: ability as never,
  payment,
  ...(costChoices ? { costChoices } : {}),
});
export const resourceAbility = (id: InstanceId, ability: string): Payment => ({ ability: { instanceId: id, abilityId: ability as never } });

export function inst(state: GameState, id: InstanceId): CardInstance {
  const instance = getInstance(state, id);
  if (!instance) throw new Error(`no instance ${id}`);
  return instance;
}
export function playerOf(state: GameState, player: PlayerId) {
  const found = getPlayer(state, player);
  if (!found) throw new Error(`no player ${player}`);
  return found;
}
export const identityOf = (state: GameState, player: PlayerId = P1): InstanceId => playerOf(state, player).identity.instanceId;
export const instancesOf = (state: GameState, code: string): InstanceId[] =>
  Object.values(state.instances).filter((i) => i.cardId === cardId(code)).map((i) => i.instanceId);
export const threatOn = (state: GameState, id: InstanceId): number => inst(state, id).threat;
export const mainThreat = (state: GameState): number => threatOn(state, state.mainScheme.instanceId);

export function patchInstance(state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...inst(state, id), ...change } } };
}

/** Moves the first copies of these cards from the player's deck (or discard) into their hand. */
export function moveToHand(state: GameState, player: PlayerId, ...codes: readonly string[]): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  let current = state;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const owner = playerOf(current, player);
    const wanted = (id: InstanceId) => current.instances[id]?.cardId === cardId(code) && !ids.includes(id);
    const inHand = owner.hand.find(wanted);
    if (inHand) {
      ids.push(inHand);
      continue;
    }
    const id = owner.deck.find(wanted) ?? owner.discard.find(wanted);
    if (!id) throw new Error(`${player} has no ${code} in deck or discard`);
    ids.push(id);
    current = {
      ...current,
      players: current.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), discard: p.discard.filter((i) => i !== id), hand: [...p.hand, id] } : p,
      ),
    };
  }
  return { state: current, ids };
}

/** Puts copies of these cards (from the player's deck, discard or hand) on top of their deck, in order. */
export function putOnTopOfDeck(state: GameState, player: PlayerId, ...codes: readonly string[]): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, player);
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code) && !ids.includes(id);
    const id = owner.deck.find(wanted) ?? owner.discard.find(wanted) ?? owner.hand.find(wanted);
    if (!id) throw new Error(`${player} has no ${code}`);
    ids.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !ids.includes(id));
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, deck: [...ids, ...strip(p.deck)], discard: strip(p.discard), hand: strip(p.hand) } : p)),
    },
  };
}

/**
 * Puts copies of these encounter cards (from the encounter deck, else its
 * discard pile) on top of the encounter deck, in order. In a villain phase the
 * villain's boost card is drawn first (one per activation), then each player
 * is dealt their card(s).
 */
export function stackEncounterDeck(state: GameState, ...codes: readonly string[]): GameState {
  // "The encounter deck" is the active villain's.
  const piles = activeEncounterDeck(state);
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code) && !ids.includes(id);
    const id = piles.deck.find(wanted) ?? piles.discard.find(wanted);
    if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
    ids.push(id);
  }
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: {
        deck: [...ids, ...piles.deck.filter((id) => !ids.includes(id))],
        discard: piles.discard.filter((id) => !ids.includes(id)),
      },
    },
  };
}

/** The first `n` hand cards not in `exclude`, to pay with. */
export function payWith(state: GameState, player: PlayerId, n: number, exclude: readonly InstanceId[] = []): readonly InstanceId[] {
  const picks = playerOf(state, player).hand.filter((id) => !exclude.includes(id)).slice(0, n);
  if (picks.length < n) throw new Error(`${player} has fewer than ${n} other cards in hand`);
  return picks;
}

/** A picker that selects `optionId` when a prompt offers it and otherwise declines like `firstLegal`. */
export const picking =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const offered = state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    const hits = wanted.filter((w) => offered.includes(w));
    return hits.length > 0 ? hits.slice(0, state.pendingChoice?.maxSelections ?? 1) : firstLegal(state);
  };

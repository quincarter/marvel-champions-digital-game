import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, instancesOf, settle } from "../../testing/harness.js";
import { P1 } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

/** Helpers for the Project Wideawake tests: a game past setup, and a reveal of one named card from the encounter deck. */

export type { InstanceId };

/** A Project Wideawake game past setup (1 Core hero by default), every opening hand kept. */
export function wideawakeGame(
  options: Partial<Wave6ScenarioOptions> & { readonly extraEncounterCards?: readonly string[] } = {},
): GameState {
  const { extraEncounterCards, ...scenarioOptions } = options;
  const base: GameSetupConfig = wave6Scenario("project-wideawake", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    ...scenarioOptions,
  });
  const config: GameSetupConfig = extraEncounterCards
    ? { ...base, encounterDeck: [...(base.encounterDeck ?? []), ...extraEncounterCards.map((code) => cardId(code))] }
    : base;
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** The cards of `code` that are in play right now. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  instancesOf(state, code).filter((id) => cardsInPlay(state).includes(id));

/** Every card in play, by printed id. */
export const inPlayIds = (state: GameState): string[] => cardsInPlay(state).map((id) => state.instances[id]!.cardId);

/** Puts an encounter-side set-aside card (a Captive ally) into `player`'s play area, ready and faceup, under their control. */
export function putSetAsideAllyInPlay(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const id = state.encounterSetAside.find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`no set-aside ${code}`);
  return {
    id,
    state: {
      ...state,
      encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: player } },
    },
  };
}

/** Tucks `ids` (cards out of play, wherever they are) facedown under `host` by surgery, the state `tuckCards` leaves. */
export function tuckBySurgery(state: GameState, host: InstanceId, ids: readonly InstanceId[]): GameState {
  const strip = (zone: readonly InstanceId[]) => zone.filter((i) => !ids.includes(i));
  const instances = { ...state.instances };
  for (const id of ids) {
    instances[id] = { ...instances[id]!, faceup: false, home: { kind: "tucked", hostInstanceId: host } } as never;
  }
  instances[host] = { ...instances[host]!, tucked: [...instances[host]!.tucked, ...ids] };
  return {
    ...state,
    instances,
    players: state.players.map((p) => ({ ...p, deck: strip(p.deck), hand: strip(p.hand), discard: strip(p.discard) })),
  };
}

/** Attaches the first `code` found in the encounter deck or discard to `hostId` by surgery (no reveal, no When Revealed). */
export function attachToHost(state: GameState, code: string, hostId: InstanceId): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const host = state.instances[hostId]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: hostId },
        [hostId]: { ...host, attachments: [...host.attachments, id] },
      },
    },
  };
}

/** Puts the first `code` found in the encounter deck or discard into `player`'s play area, engaged with them (a minion in play, by surgery: no reveal). */
export function engageMinion(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, engagedWith: player } },
    },
  };
}

/** Moves `n` cards with a printed `resource` (or wild) icon from `player`'s deck into their hand; returns those cards. */
export function handWith(
  state: GameState,
  player: PlayerId,
  resource: "physical" | "mental" | "energy",
  n: number,
): { state: GameState; ids: InstanceId[] } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const has = (i: InstanceId) => {
    const card = state.cardPool[state.instances[i]!.cardId]!;
    return (
      "resourceIcons" in card && ((card.resourceIcons?.[resource] ?? 0) > 0 || (card.resourceIcons?.wild ?? 0) > 0)
    );
  };
  const ids = [...owner.hand.filter(has), ...owner.deck.filter(has)].slice(0, n);
  if (ids.length < n) throw new Error(`${player} has fewer than ${n} ${resource} resource cards`);
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              deck: p.deck.filter((i) => !ids.includes(i)),
              hand: [...p.hand.filter((i) => !ids.includes(i)), ...ids],
            }
          : p,
      ),
    },
  };
}

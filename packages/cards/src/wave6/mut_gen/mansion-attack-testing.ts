import {
  activeEncounterDeckId,
  activeVillain,
  characterProfile,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export type BrotherhoodTitle = "Avalanche" | "Blob" | "Pyro" | "Toad";

/** The title of the villain in play ("Avalanche", ...), standard or expert face alike. */
export const villainTitle = (state: GameState): string =>
  state.cardPool[state.instances[activeVillain(state).instanceId]!.cardId]!.name;

/**
 * A Mansion Attack game past setup, every opening hand kept. The villain deck is shuffled by the game's own seed, so
 * `villain` walks seeds from `options.seed` (default 1) until that title is the one in play; the Brotherhood set is
 * the scenario's own required set, the Mystique modular set is left out (another module).
 */
export function mansionAttackGame(
  options: Partial<Wave6ScenarioOptions> & { readonly villain?: BrotherhoodTitle } = {},
): GameState {
  const { villain, ...scenarioOptions } = options;
  for (let seed = scenarioOptions.seed ?? 1; seed < (scenarioOptions.seed ?? 1) + 200; seed++) {
    const config = wave6Scenario("mansion-attack", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      modularSetIds: [],
      ...scenarioOptions,
      seed,
    });
    const created = createGame(config, WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    if (villain && villainTitle(created.state) !== villain) continue;
    return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
  }
  throw new Error(`no seed starts Mansion Attack with ${villain}`);
}

/** Puts the facedown encounter cards 1B dealt at setup back into the encounter discard pile, so a villain phase reveals only what a test stacks. */
export function withoutDealtCards(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const dealt = state.players.flatMap((p) => p.dealtEncounter);
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, dealtEncounter: [] })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: pile.deck, discard: [...pile.discard, ...dealt] } },
  };
}

/** Keeps only the set-aside villain(s) with these ids set aside (the rest leave the game), so Save the School's random pick is forced. */
export function onlySetAsideVillain(state: GameState, code: string): GameState {
  const keep = cardId(code);
  const isVillain = (id: InstanceId) => state.cardPool[state.instances[id]!.cardId]!.type === "villain";
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter((id) => !isVillain(id) || state.instances[id]!.cardId === keep),
  };
}

/** The set-aside villains' printed ids. */
export const setAsideVillainIds = (state: GameState): string[] =>
  state.encounterSetAside
    .filter((id) => state.cardPool[state.instances[id]!.cardId]!.type === "villain")
    .map((id) => state.instances[id]!.cardId as string);

/** Puts the ally of `player`'s deck with the most hit points (`maxHp`, ties by deck order) whose printed id is not `exceptCode` into their play area, ready (state surgery: no cost, no ally limit check). */
export function putOtherAllyInPlay(
  state: GameState,
  player: PlayerId,
  exceptCode: string,
): { state: GameState; id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const hp = (i: InstanceId): number => characterProfile(state, i, WAVE6_DEPS)?.maxHp ?? 0;
  const id = owner.deck
    .filter((i) => {
      const code = state.instances[i]!.cardId as string;
      return code !== exceptCode && state.cardPool[code]!.type === "ally";
    })
    .reduce<InstanceId | undefined>((best, i) => (best === undefined || hp(i) > hp(best) ? i : best), undefined);
  if (!id) throw new Error(`${player}'s deck has no other ally`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, exhausted: false, controllerId: player },
      },
    },
  };
}

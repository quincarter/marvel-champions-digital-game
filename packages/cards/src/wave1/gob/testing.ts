import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  createGame,
  type EngineDeps,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { firstLegal, runWith, settle } from "../../testing/harness.js";
import { WAVE1_ABILITIES } from "../index.js";

/**
 * Test deps for the Green Goblin (`gob`) pack. `GOB_ABILITIES` is registered in `../index.ts`'s `WAVE1_ABILITIES`, so
 * this is the same registry as `../testing.ts`'s `WAVE1_DEPS`; the names are kept so the pack's tests read unchanged.
 */
export const GOB_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

export const runGob = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState =>
  runWith(GOB_DEPS, state, ...commands);

export function startGobGame(config: GameSetupConfig): GameState {
  const created = createGame(config, GOB_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", GOB_DEPS);
}

/**
 * Test-only state surgery (copied from `wave1/drs/testing.ts` — see that file's own doc comment for the full
 * rationale): moves cards directly from a player's `setAside` to the top of the active encounter deck.
 */
export function stackFromSetAside(state: GameState, player: PlayerId, ...codes: readonly string[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = activeEncounterDeck(state);
  const ids: InstanceId[] = [];
  let players = state.players;
  for (const code of codes) {
    const owner = players.find((p) => p.playerId === player);
    if (!owner) throw new Error(`no player ${player}`);
    const found = owner.setAside.find((id) => state.instances[id]?.cardId === cardId(code) && !ids.includes(id));
    if (!found) throw new Error(`no ${code} in ${player}'s setAside`);
    ids.push(found);
    players = players.map((p) =>
      p.playerId === player ? { ...p, setAside: p.setAside.filter((id) => id !== found) } : p,
    );
  }
  return {
    ...state,
    players,
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: [...ids, ...piles.deck], discard: piles.discard } },
  };
}

/**
 * Test-only state surgery: forces a minion directly into play, engaged with `player`, without going through a real
 * reveal. Copied from `wave1/drs/testing.ts` (see its doc comment).
 */
export function forceMinionIntoPlay(state: GameState, id: InstanceId, player: PlayerId): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = activeEncounterDeck(state);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: piles.deck.filter((x) => x !== id), discard: piles.discard.filter((x) => x !== id) },
    },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: player } },
  };
}

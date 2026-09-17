import { cardId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, createGame, type EngineDeps, type GameSetupConfig, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { firstLegal, runWith, settle } from "../../testing/harness.js";
import { WAVE1_ABILITIES } from "../index.js";

/**
 * Test deps for the Thor pack. `THOR_ABILITIES` is now registered in `../index.ts`'s `WAVE1_ABILITIES`, so this is
 * the same registry as `../testing.ts`'s `WAVE1_DEPS`; the names are kept so the pack's tests read unchanged.
 */
export const THOR_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

export const runThor = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(THOR_DEPS, state, ...commands);

export function startThorGame(config: GameSetupConfig): GameState {
  const created = createGame(config, THOR_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", THOR_DEPS);
}

/**
 * Test-only state surgery (matching `../../testing/harness.ts`'s `stackEncounterDeck`, extended to cover a zone it
 * doesn't): a nemesis set is set aside at setup (RRG 1.8 Appendix II step 5, `PlayerState.setAside`) and only
 * enters the encounter deck via a scenario's own mechanism ("Shadow of the Past", `packages/engine/src/state.ts`)
 * — not present in a plain Rhino/standard game with no modular sets. To exercise a Thor nemesis-set card's ability
 * in isolation without depending on that mechanism, this moves it directly from a player's `setAside` to the top
 * of the active encounter deck.
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
    players = players.map((p) => (p.playerId === player ? { ...p, setAside: p.setAside.filter((id) => id !== found) } : p));
  }
  return {
    ...state,
    players,
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: [...ids, ...piles.deck], discard: piles.discard } },
  };
}

/**
 * Test-only state surgery: forces a minion (already an instance somewhere — e.g. on top of the encounter deck via
 * `stackFromSetAside` + `stackEncounterDeck`) directly into play, engaged with `player`, without going through a
 * real reveal. A minion "in play" lives in its engaged player's own `playArea` (`putIntoPlay`'s own case,
 * `packages/engine/src/resolve/apply-effect.ts`), not merely a matter of the instance's `engagedWith` field, so
 * this also relocates it — `patchInstance` (`../../testing/harness.ts`) alone would set `engagedWith` but leave the
 * card sitting in the encounter deck array, invisible to any "minion engaged with you" query.
 */
export function forceMinionIntoPlay(state: GameState, id: InstanceId, player: PlayerId): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = activeEncounterDeck(state);
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: piles.deck.filter((x) => x !== id), discard: piles.discard.filter((x) => x !== id) } },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: player } },
  };
}

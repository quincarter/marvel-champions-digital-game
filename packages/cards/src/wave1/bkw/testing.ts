import { cardId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, createGame, type EngineDeps, type GameSetupConfig, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { firstLegal, runWith, settle } from "../../testing/harness.js";
import { WAVE1_ABILITIES } from "../index.js";
import { BKW_ABILITIES } from "./index.js";

/**
 * Local test deps for the Black Widow pack, until the main session registers `BKW_ABILITIES` in `../index.ts`'s
 * `WAVE1_ABILITIES` (docs/phase7-wave1-scripting.md's shared-tree rules: a pack agent builds its own deps rather
 * than editing the shared `wave1/index.ts` / `wave1/testing.ts`). Mirrors `../thor/testing.ts`'s `THOR_DEPS` /
 * `runThor` / `startThorGame` shape exactly, so this file can be deleted with no other change once the pack is
 * registered upstream.
 */
export const BKW_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

export const runBkw = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(BKW_DEPS, state, ...commands);

export function startBkwGame(config: GameSetupConfig): GameState {
  const created = createGame(config, BKW_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", BKW_DEPS);
}

/**
 * Test-only state surgery (copied from `../thor/testing.ts` rather than imported — see that file's own doc comment
 * for the full rationale): a nemesis set is set aside at setup (RRG 1.8 Appendix II step 5, `PlayerState.setAside`)
 * and only enters the encounter deck via a scenario's own mechanism ("Shadow of the Past",
 * `packages/engine/src/state.ts`) — not present in a plain Rhino/standard game with no modular sets. To exercise a
 * Black Widow nemesis-set card's ability in isolation without depending on that mechanism, this moves it directly
 * from a player's `setAside` to the top of the active encounter deck.
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
 * real reveal. Copied from `../thor/testing.ts` (see its doc comment) rather than imported.
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

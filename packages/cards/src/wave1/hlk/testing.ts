import { cardId } from "@mc/content";
import { createGame, type EngineDeps, type GameSetupConfig, type GameState, activeEncounterDeck, activeEncounterDeckId, type InstanceId, type PlayerId } from "@mc/engine";
import { firstLegal, runWith, settle } from "../../testing/harness.js";
import { WAVE1_ABILITIES } from "../index.js";

/**
 * Local test wiring for the `hlk` pack only (docs/phase7-wave1-scripting.md's shared-tree rules): `hlk` is not yet
 * registered in `../index.ts`'s `WAVE1_ABILITIES`, so `../testing.ts`'s `WAVE1_DEPS`/`runWave1`/`startWave1Game`
 * don't know Hulk's ability ids yet. This is the `hlk`-only analog, built the same way, over the same deps-agnostic
 * `../../testing/harness.js` helpers `../testing.ts` itself wraps — never editing that shared file.
 */
export const HLK_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

/** `run`, wired to `HLK_DEPS` — the `hlk`-only analog of `../testing.ts`'s `runWave1`. */
export const runHlk = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(HLK_DEPS, state, ...commands);

/** A wave 1 game past setup, with every opening hand kept, using `HLK_DEPS` — the `hlk`-only analog of `startWave1Game`. */
export function startHlkGame(config: GameSetupConfig): GameState {
  const created = createGame(config, HLK_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", HLK_DEPS);
}

/**
 * Test-only state surgery (matching `../../testing/harness.ts`'s `stackEncounterDeck`, extended to cover a zone it
 * doesn't): a nemesis set is set aside at setup (RRG 1.8 Appendix II step 5, `PlayerState.setAside`) and only
 * enters the encounter deck via a scenario's own mechanism ("Shadow of the Past", `packages/engine/src/state.ts`)
 * — not present in a plain Rhino/standard game with no modular sets. To exercise a Hulk nemesis-set card's ability
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

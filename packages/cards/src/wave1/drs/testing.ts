import { cardId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, createGame, type EngineDeps, type GameSetupConfig, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { firstLegal, runWith, settle } from "../../testing/harness.js";
import { WAVE1_ABILITIES } from "../index.js";
import { DRS_ABILITIES } from "./index.js";

/**
 * Local test deps for the Doctor Strange pack, until the main session registers `DRS_ABILITIES` in `../index.ts`'s
 * `WAVE1_ABILITIES` (docs/phase7-wave1-scripting.md's shared-tree rules: a pack agent builds its own deps rather
 * than editing the shared `wave1/index.ts` / `wave1/testing.ts`). Unlike `hlk`/`bkw` (already merged into
 * `WAVE1_ABILITIES` by the main session by the time this was written), `drs` is still commented out there, so
 * `WAVE1_ABILITIES` alone doesn't know any Doctor Strange ability id yet — merge `DRS_ABILITIES` in on top. This
 * file can be deleted with no other change once the pack is registered upstream.
 */
export const DRS_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

export const runDrs = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(DRS_DEPS, state, ...commands);

export function startDrsGame(config: GameSetupConfig): GameState {
  const created = createGame(config, DRS_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DRS_DEPS);
}

/**
 * Test-only state surgery (copied from `../hlk/testing.ts` rather than imported — see that file's own doc comment
 * for the full rationale): a nemesis set is set aside at setup (RRG 1.8 Appendix II step 5, `PlayerState.setAside`)
 * and only enters the encounter deck via a scenario's own mechanism ("Shadow of the Past",
 * `packages/engine/src/state.ts`) — not present in a plain Rhino/standard game with no modular sets. To exercise a
 * Doctor Strange nemesis-set card's ability in isolation without depending on that mechanism, this moves it
 * directly from a player's `setAside` to the top of the active encounter deck.
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
 * `stackFromSetAside`) directly into play, engaged with `player`, without going through a real reveal. Copied from
 * `../hlk/testing.ts` (see its doc comment) rather than imported.
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

/**
 * Test-only state surgery: puts copies of these Invocation cards (by code, from Stephen Strange's separate
 * "Invocation" deck, else its discard pile) on top of the Invocation deck, in order — the separate-deck analog of
 * `../../testing/harness.js`'s `stackEncounterDeck`, since the Invocation deck lives in `PlayerState.separateDecks`
 * (`packages/engine/src/state.ts`), a zone that generic harness has no reason to know about.
 */
export function stackInvocation(state: GameState, player: PlayerId, ...codes: readonly string[]): GameState {
  const owner = state.players.find((p) => p.playerId === player);
  if (!owner) throw new Error(`no player ${player}`);
  const piles = owner.separateDecks["Invocation"];
  if (!piles) throw new Error(`${player} has no Invocation deck`);
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code) && !ids.includes(id);
    const id = piles.deck.find(wanted) ?? piles.discard.find(wanted);
    if (!id) throw new Error(`no ${code} in ${player}'s Invocation deck or discard`);
    ids.push(id);
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            separateDecks: {
              ...p.separateDecks,
              Invocation: {
                ...piles,
                deck: [...ids, ...piles.deck.filter((id) => !ids.includes(id))],
                discard: piles.discard.filter((id) => !ids.includes(id)),
              },
            },
          }
        : p,
    ),
  };
}

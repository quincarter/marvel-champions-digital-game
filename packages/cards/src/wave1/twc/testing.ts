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
import { mergeRegistries } from "../../dsl/index.js";
import { firstLegal, runWith, settle } from "../../testing/harness.js";
import { WAVE1_ABILITIES } from "../index.js";
import { TWC_ABILITIES } from "./index.js";

/**
 * Test deps for The Wrecking Crew (`twc`) pack. `TWC_ABILITIES` is NOT registered in `../index.ts`'s
 * `WAVE1_ABILITIES` (that file is shared and out of scope for this pass — the task brief), so this merges the two
 * explicitly with `mergeRegistries` (never an object spread — a spread silently hides a duplicate id, the exact
 * failure mode that broke `gob`'s suite once).
 */
export const TWC_DEPS: EngineDeps = { abilities: WAVE1_ABILITIES };

export const runTwc = (state: GameState, ...commands: Parameters<typeof runWith>[2][]): GameState => runWith(TWC_DEPS, state, ...commands);

export function startTwcGame(config: GameSetupConfig): GameState {
  const created = createGame(config, TWC_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", TWC_DEPS);
}

/**
 * Test-only state surgery (copied from `wave1/gob/testing.ts` — see that file's own doc comment for the full
 * rationale; copied rather than imported, `docs/phase7-wave1-scripting.md`: a pack never imports another pack's
 * folder). Moves cards directly from a player's `setAside` to the top of the active encounter deck.
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
 * Test-only state surgery: forces a minion directly into play, engaged with `player`, without going through a real
 * reveal. Copied from `wave1/gob/testing.ts` (see its doc comment).
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

/** The instance of `code` wherever it currently sits (any encounter deck, `setAside`, in play, …) — Breakout runs
 * one encounter deck per villain (docs/phase7-wave1.md §3.1), so a plain `stackEncounterDeck` only ever reaches the
 * "active" one. */
export function findInstance(state: GameState, code: string): InstanceId {
  const found = Object.values(state.instances).find((i) => i.cardId === cardId(code));
  if (!found) throw new Error(`no ${code} instance anywhere in this game`);
  return found.instanceId;
}

/**
 * Test-only state surgery: attaches a villain-attachment encounter card (Magic Crowbar/Ball and Chain/Bulldozer's
 * Helmet, "Attach to <villain>") directly to that villain, without going through a real reveal — Breakout's own
 * per-villain encounter decks (above) make stacking a specific villain's own deck and then revealing it, several
 * villains deep into a shared turn structure, disproportionate for exercising an attachment's own ability in
 * isolation, matching this file's `forceMinionIntoPlay`.
 */
export function forceAttachToVillain(state: GameState, id: InstanceId, villainInstanceId: InstanceId): GameState {
  const host = state.instances[villainInstanceId];
  if (!host) throw new Error(`no villain instance ${villainInstanceId}`);
  const encounterDecks = Object.fromEntries(
    Object.entries(state.encounterDecks).map(([deckId, piles]) => [deckId, { deck: piles.deck.filter((x) => x !== id), discard: piles.discard.filter((x) => x !== id) }]),
  );
  return {
    ...state,
    encounterDecks,
    instances: {
      ...state.instances,
      [villainInstanceId]: { ...host, attachments: [...host.attachments, id] },
      [id]: { ...state.instances[id]!, attachedTo: villainInstanceId, faceup: true },
    },
  };
}

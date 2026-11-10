/**
 * The `?screen=board&fixture=zemo` dev jump (`scenes/boot.ts`): a real one-seat Baron Zemo game (Spider-Man, Justice)
 * at the first player turn, with the Chief Tactical Officer's two Setup secret counters taken off so the end-of-phase
 * Response (MC50 p. 18) can be taken at once: it needs a Board Member environment with none. Everything after that is
 * played by hand through the real prompts (gain evidence, advance to stage 2A, the accusation). Dev builds only:
 * `boot.ts` reaches this through a dynamic import behind `import.meta.env.DEV`.
 *
 * The counters come off by state surgery on a game the app's own host built, as the Four Horsemen jump does
 * (`dev-mission-game.ts`); the game then goes on in a `DevStateHost`, so it keeps no storage and cannot be resumed.
 * `?bare=all` bares all three environments, `?bare=none` leaves Setup's counters as dealt. `?minions=N` engages the
 * encounter deck's first N minions with the seat, for the phone's Enemies tab with three environments (issue #635).
 *
 * The state handed to the `DevStateHost` is that host's authority, so it must hold the evidence envelopes' cards. The
 * store's own `game` does not (it is sealed for the table, `sealForTable`: a pile is its size there), so the full state
 * is read where a save reads it: the first host's log, replayed.
 */

import { applyCommands, type GameState } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import type { SessionConfig } from "../engine/host.js";
import { appSession, useDevHost } from "../session.js";
import { nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** The three Board Member environments' front faces: Chief Medical, Chief Surveillance, Chief Tactical. */
const ENVIRONMENTS = ["50181a", "50182a", "50183a"] as const;

const CONFIG = {
  scenarioId: "baron-zemo",
  difficulty: "standard" as const,
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 1,
};

/**
 * The fixture's state: a Zemo game played through `store` to the first player turn (setup choices answered with their
 * minimum), with the counters off the environments `bare` names and the encounter deck's first `minions` minions
 * engaged with the seat. Exported for `dev-zemo-game.test.ts`.
 */
export async function zemoFixtureState(
  store: SessionStore,
  bare: "tactical" | "all" | "none" = "tactical",
  minions = 0,
): Promise<{ readonly config: SessionConfig; readonly state: GameState }> {
  await store.start(CONFIG);
  await nextTurn(store);
  if (!store.state.game) throw new Error("the Baron Zemo game did not start");
  const saved = await store.save();
  const replayed = applyCommands(saved.initialState, saved.commands, POOL_DEPS);
  if (!replayed.ok) throw new Error(`the Baron Zemo game does not replay: ${replayed.error.message}`);
  const game = replayed.state;
  const wanted: readonly string[] = bare === "all" ? ENVIRONMENTS : bare === "tactical" ? ["50183a"] : [];
  const instances = Object.fromEntries(
    Object.entries(game.instances).map(([id, instance]) => {
      if (!wanted.includes(instance.cardId as string)) return [id, instance];
      const { secret: _secret, ...counters } = instance.counters ?? {};
      return [id, { ...instance, counters }];
    }),
  );
  const state: GameState = { ...game, instances };
  return { config: CONFIG, state: minions > 0 ? engageMinions(state, minions) : state };
}

/** The first `count` minions in the encounter deck, moved out of it, faceup and engaged with the first seat. */
function engageMinions(state: GameState, count: number): GameState {
  const deckId = state.encounterDeckOrder[0]!;
  const deck = state.encounterDecks[deckId]!;
  const moved = deck.deck
    .filter((id) => state.cardPool[state.instances[id]!.cardId]?.type === "minion")
    .slice(0, count);
  const seat = state.players[0]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...deck, deck: deck.deck.filter((id) => !moved.includes(id)) },
    },
    players: [{ ...seat, playArea: [...seat.playArea, ...moved] }, ...state.players.slice(1)],
    instances: {
      ...state.instances,
      ...Object.fromEntries(
        moved.map((id) => [id, { ...state.instances[id]!, faceup: true, engagedWith: seat.playerId }]),
      ),
    },
  };
}

export async function startDevZemoGame(bare: "tactical" | "all" | "none" = "tactical", minions = 0): Promise<void> {
  const { config, state } = await zemoFixtureState(appSession().store, bare, minions);
  useDevHost(new DevStateHost(state, POOL_DEPS));
  // The host swap makes a new store: the one before it is stale.
  (window as unknown as { __mcZemo?: unknown }).__mcZemo = { store: appSession().store };
  await appSession().store.start(config);
}

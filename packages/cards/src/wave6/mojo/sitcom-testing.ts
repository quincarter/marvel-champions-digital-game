import {
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { firstLegal, settle, stackEncounterDeck, P1, type Picker } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles, inPlay } from "../mut_gen/magneto-testing.js";

/** Treacheries with no boost icons and no surge, to fill the boost and reveal slots of a villain phase. */
export const NO_BOOST = "01187";
export const FILLER_2 = "01186";

/**
 * A Rhino game with the Sitcom set as its modular set (Core hero by default), past setup. Rhino stands in for the Mojo
 * scenarios, which `wave6Scenario` does not build yet; the Sitcom set is the same cards either way. Its main scheme
 * has room for incite 3 without advancing.
 */
export function sitcomGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["sitcom"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/**
 * Every player ends their turn with `reveal` stacked as the card the villain phase reveals (after one boost card per
 * attack and then `before`); returns the state back in the next player phase with the events along the way.
 */
export function revealInVillainPhase(
  state: GameState,
  reveal: string | readonly string[],
  opts: {
    readonly before?: readonly string[];
    readonly after?: readonly string[];
    readonly pick?: Picker;
    readonly deps?: EngineDeps;
  } = {},
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const stacked = stackEncounterDeck(
    state,
    ...(opts.before ?? (state.players.length === 1 ? [NO_BOOST] : [NO_BOOST, FILLER_2])),
    ...(typeof reveal === "string" ? [reveal] : reveal),
    ...(opts.after ?? []),
  );
  return driveEventsPicking(
    opts.deps ?? WAVE6_DEPS,
    stacked,
    opts.pick ?? firstLegal,
    ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })),
  );
}

/** `player`'s play area (the cards in it, in order). */
export const playAreaOf = (state: GameState, player: PlayerId = P1): readonly InstanceId[] =>
  state.players.find((p) => p.playerId === player)!.playArea;

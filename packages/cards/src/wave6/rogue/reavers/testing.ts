import { cardsInPlay, createGame, type GameState, type InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  instancesOf,
  P1,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

export const PIERCE = "38029";
export const SKULLBUSTER = "38030";
export const BONEBREAKER = "38031";
export const WADE = "38032";
export const MURRAY = "38033";
export const REAVERS_SCHEME = "38034";
export const CYBERNETICS = "38035";
export const ADVANCE = "01186";

/** A Rhino game (Core hero by default) with the Reavers modular set, past setup. */
export function reaversGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["reavers"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

export const piles = (state: GameState) => Object.values(state.encounterDecks)[0]!;
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  instancesOf(state, code).filter((id) => cardsInPlay(state).includes(id));
export const resolved = (events: readonly { type: string }[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [(e as unknown as { abilityId: string }).abilityId] : []));

/** The villain stunned and confused (it skips its attack or scheme, draws no boost): `top` is dealt next, in order. */
export function reveal(state: GameState, ...top: string[]) {
  const villain = state.activeVillainId!;
  const confused = patchInstance(state, villain, {
    statuses: { ...state.instances[villain]!.statuses, confused: 1, stunned: 1 },
  });
  return driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(confused, ...top), firstLegal, endTurn(P1));
}

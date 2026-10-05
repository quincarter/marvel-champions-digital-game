import { createGame } from "@mc/engine";
import {
  PLAYABLE_ENCOUNTER_SETS,
  PLAYABLE_SCENARIO_RECORDS,
  isModularChoice,
  modularPickProblem,
} from "../modular-pool.js";
import { WAVE7_ENCOUNTER_SETS, WAVE7_SCENARIOS } from "@mc/content";
import { WAVE7_DEPS } from "./index.js";
import { wave7Scenario } from "./setup.js";

/**
 * Dreadpool (44037-44042) is in a game exactly when a player chose the 'Pool aspect (Deadpool insert, "Using the 'Pool
 * Aspect"; RRG 1.8 FAQ p. 64; docs/phase7-wave7.md §3.74, Q44): one Crisis of Infinite Deadpools in the encounter deck,
 * the other six cards set aside.
 */
const game = (deck: string, second?: string) => {
  const config = wave7Scenario("morlock-siege", {
    seed: 7,
    players: [{ starterDeckId: deck }, ...(second ? [{ starterDeckId: second }] : [])],
  });
  const result = createGame(config, WAVE7_DEPS);
  if (!result.ok) throw new Error(result.error.message);
  return result;
};
const codeOf = (state: ReturnType<typeof game>["state"], id: string) => state.instances[id]!.cardId as string;
const dreadpool = (ids: readonly string[], state: ReturnType<typeof game>["state"]) =>
  ids.map((id) => codeOf(state, id)).filter((code) => code >= "44037" && code <= "44042");

describe("the Dreadpool set, included by the 'Pool aspect", () => {
  it("a 'Pool deck: 1 Crisis of Infinite Deadpools (44037) in the encounter deck and the other 6 cards set aside", () => {
    const { state, events } = game("deadpool-pool");
    const decks = Object.values(state.encounterDecks).flatMap((d) => [...d.deck, ...d.discard]);
    expect(dreadpool(decks, state)).toEqual(["44037"]);
    expect(dreadpool(state.encounterSetAside, state)).toHaveLength(6);
    expect(dreadpool(state.encounterSetAside, state)).not.toContain("44037");
    const logged = events.filter((e) => e.type === "encounterSetAutoIncluded");
    expect(logged).toHaveLength(1);
  });

  it("two players, one of them 'Pool: still one copy of the set", () => {
    const { state } = game("cable-leadership", "deadpool-pool");
    const everywhere = Object.keys(state.instances);
    expect(dreadpool(everywhere, state)).toHaveLength(7);
  });

  it("no 'Pool deck: none of the set's cards exist and nothing is logged", () => {
    const { state, events } = game("cable-leadership");
    expect(dreadpool(Object.keys(state.instances), state)).toEqual([]);
    expect(events.filter((e) => e.type === "encounterSetAutoIncluded")).toEqual([]);
  });

  it("is never a modular choice, in any scenario of the pool or the box", () => {
    const set = WAVE7_ENCOUNTER_SETS.find((s) => s.id === "dreadpool")!;
    const sets = [...PLAYABLE_ENCOUNTER_SETS, ...WAVE7_ENCOUNTER_SETS];
    for (const scenario of [...PLAYABLE_SCENARIO_RECORDS, ...WAVE7_SCENARIOS]) {
      expect(isModularChoice(set, scenario)).toBe(false);
      expect(modularPickProblem(scenario, "dreadpool", sets)).toBe(
        "dreadpool is included by a setup condition, never chosen (wave 7 Q44)",
      );
    }
  });
});

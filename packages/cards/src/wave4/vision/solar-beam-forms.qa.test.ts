import { activeVillain, type GameState } from "@mc/engine";
import { firstLegal, inst, instancesOf, patchInstance, runWith, toHero, type Picker } from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { startWave4Game } from "../testing.js";
import { visionScenario } from "./support.js";
import { playFromHandTyped } from "./test-helpers.js";

/**
 * QA: Solar Beam (26008) has two Action abilities (attack / thwart), each gated to a mass form inside its effect with
 * `ifThen` (not with a trigger `while`). The engine reads only the first Action ability for play legality and cost
 * (`eventActionAbility`, actions.ts) and resolves both (`resolve/play-card.ts` "abilities"), so the in-effect gating
 * is what keeps this card correct. RRG 1.8 "Event" (p. 19): the player chooses one ability; the other must not
 * resolve. These cases pin the observable outcome in both forms with exact numbers.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const setMass = (state: GameState, to: "Intangible" | "Dense"): GameState =>
  patchInstance(state, instancesOf(state, "26002")[0]!, { flipped: to === "Dense" });

const start = (seed: number): GameState =>
  runWith(WAVE4_DEPS, startWave4Game(visionScenario("rhino", { seed })), toHero());

describe("Solar Beam (26008) by mass form: RRG Event p. 19", () => {
  it("Dense: 7 damage to the villain and the scheme's threat is untouched", () => {
    const hero = patchInstance(setMass(start(21), "Dense"), start(21).mainScheme.instanceId, { threat: 10 });
    const villain = activeVillain(hero).instanceId;
    const { state } = playFromHandTyped(hero, "26008", 3, "26025", accepting(villain));
    expect(inst(state, villain).damage).toBe(inst(hero, villain).damage + 7);
    expect(inst(state, hero.mainScheme.instanceId).threat).toBe(10);
  });

  it("Intangible: playable, removes 5 threat (10 to 5) and deals 0 damage to the villain", () => {
    const base = setMass(start(22), "Intangible");
    const hero = patchInstance(base, base.mainScheme.instanceId, { threat: 10 });
    const villain = activeVillain(hero).instanceId;
    const { state } = playFromHandTyped(hero, "26008", 3, "26025", accepting(hero.mainScheme.instanceId));
    expect(inst(state, hero.mainScheme.instanceId).threat).toBe(5);
    expect(inst(state, villain).damage).toBe(inst(hero, villain).damage);
  });
});

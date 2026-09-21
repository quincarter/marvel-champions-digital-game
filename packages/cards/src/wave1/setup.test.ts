/**
 * Wave 1 is where the mode set meets the one difficulty value that *isn't* a mode: Breakout's `"extreme"`
 * (docs/phase7-wave1.md §2.3 — version A in play with version B underneath). RRG 1.8 pp. 28–29 has no such
 * mode; it's The Wrecking Crew's per-villain version choice, so it stays out of `PlayModes` and is read off
 * `difficulty` by `buildMultiVillain` alone. These tests pin that split, because the tempting simplification
 * (fold `"extreme"` into the mode set as a third difficulty) would make every other scenario's stage range
 * depend on a value only one scenario understands.
 */
import { campaignId } from "@mc/content";
import { wave1Scenario, type Wave1ScenarioOptions } from "./setup.js";

const players = [{ starterDeckId: "cap-leadership" }];
const scenario = (id: string, extra: Omit<Partial<Wave1ScenarioOptions>, "players" | "seed">) =>
  wave1Scenario(id, { players, seed: 7, ...extra });

describe("wave1Scenario and the mode set", () => {
  test("a single-villain wave 1 scenario reads modes exactly as it read difficulty", () => {
    expect(scenario("risky-business", { modes: { expert: true } })).toEqual(
      scenario("risky-business", { difficulty: "expert" }),
    );
    expect(scenario("risky-business", { modes: {} })).toEqual(scenario("risky-business", {}));
  });

  test("campaign mode changes nothing about a wave 1 setup", () => {
    const campaign = { campaignId: campaignId("trors") } as const;
    expect(scenario("risky-business", { modes: { campaign } })).toEqual(scenario("risky-business", {}));
  });

  test("Breakout's per-villain versions still follow difficulty, and expert can be said either way", () => {
    const viaDifficulty = scenario("breakout", { difficulty: "expert" });
    const viaModes = scenario("breakout", { modes: { expert: true } });
    expect(viaModes).toEqual(viaDifficulty);
    expect(viaDifficulty.villains?.map((v) => v.version)).toEqual(["B", "B", "B", "B"]);
    expect(scenario("breakout", {}).villains?.map((v) => v.version)).toEqual(["A", "A", "A", "A"]);
  });

  test('"extreme" is not an RRG mode: it survives alongside an empty mode set', () => {
    const extreme = scenario("breakout", { difficulty: "extreme", modes: {} });
    expect(extreme.villains?.map((v) => v.version)).toEqual(["extreme", "extreme", "extreme", "extreme"]);
    expect(extreme).toEqual(scenario("breakout", { difficulty: "extreme" }));
  });

  test('"extreme" with modes.expert still throws, because the two disagree about expert mode', () => {
    expect(() => scenario("breakout", { difficulty: "extreme", modes: { expert: true } })).toThrow(
      /disagree about expert mode/,
    );
  });

  test("a Core scenario reached through wave 1's fallback carries the mode set too", () => {
    expect(scenario("rhino", { modes: { expert: true } })).toEqual(scenario("rhino", { difficulty: "expert" }));
  });
});

import { cardsInPlay, createGame, traitsOf, type GameState } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  P1,
} from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const absorbingManVsHeroes = () =>
  startWave2Game(wave2Scenario("absorbing-man", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));
/** A neutral boost card in the shared "standard" set (0 boost icons, no `[star] Boost:` line). */
const ADVANCE = "01186";
const ENVIRONMENTS = ["04080", "04081", "04082", "04083"] as const;
/** Each environment's own printed trait (Dense Forest/Snowy Hillside/Rocky Outcrop/Abandoned Facility). */
const ENVIRONMENT_TRAIT: Record<string, string> = {
  "04080": "WOOD",
  "04081": "ICE",
  "04082": "STONE",
  "04083": "METAL",
};

const environmentInPlay = (state: GameState): string | undefined =>
  cardsInPlay(state)
    .map((id) => state.instances[id]?.cardId as string | undefined)
    .find((code) => !!code && (ENVIRONMENTS as readonly string[]).includes(code));

describe("Absorbing Man scenario", () => {
  it("standalone setup: exactly one environment enters play, the villain and main scheme are legal", () => {
    const config = wave2Scenario("absorbing-man", {
      players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
      seed: 2026,
    });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const environments = cardsInPlay(created.state).filter((id) =>
      (ENVIRONMENTS as readonly string[]).includes(created.state.instances[id]?.cardId ?? ""),
    );
    expect(environments).toHaveLength(1);
    expect(created.state.villains).toHaveLength(1);
    expect(created.state.outcome).toBeNull();
  });

  it("Absorbing Man (I): gains the trait of the environment in play at setup", () => {
    const start = absorbingManVsHeroes();
    const villain = start.villains[0]!.instanceId;
    const environmentCode = environmentInPlay(start);
    expect(environmentCode).toBeDefined();
    const expectedTrait = ENVIRONMENT_TRAIT[environmentCode!]!;
    expect(traitsOf(start, villain, WAVE2_DEPS).map(String)).toContain(expectedTrait);
  });

  // None Shall Pass — Forced Interrupt: when an environment enters play, discard each other environment card in
  // play. Was in `KNOWN_SKIPPED` pending `cardEntersPlay` becoming interruptible and `TargetQuery.excluding`
  // (docs/phase7-wave2.md §3.13.10); both landed, so revealing a second environment now replaces the first instead
  // of leaving both in play.
  it("None Shall Pass: revealing a second environment discards the first, leaving only the new one in play", () => {
    const start = absorbingManVsHeroes();
    const before = environmentInPlay(start)!;
    const nextEnvironment = ENVIRONMENTS.find((code) => code !== before)!;
    const stacked = stackEncounterDeck(start, ADVANCE, nextEnvironment);
    const revealed = settle(runWave2(stacked, toHero(), endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const after = cardsInPlay(revealed).filter((id) =>
      (ENVIRONMENTS as readonly string[]).includes(revealed.instances[id]?.cardId ?? ""),
    );
    expect(after.map((id) => revealed.instances[id]?.cardId)).toEqual([nextEnvironment]);
  });

  it("None Shall Pass: places 1 delay counter after resolving step one of the villain phase, every round", () => {
    const start = absorbingManVsHeroes();
    const scheme = start.mainScheme.instanceId;
    expect(inst(start, scheme).counters.delay ?? 0).toBe(0);
    const afterRound1 = settle(runWave2(start, toHero(), endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(afterRound1, scheme).counters.delay ?? 0).toBeGreaterThanOrEqual(1);
  });

  // Every villain phase also runs the villain's own normal step-4 activation and step-1 acceleration threat,
  // regardless of which encounter card is revealed — so a card's own contribution is isolated with a differential
  // (Metal vs. non-Metal) rather than an exact delta, which would otherwise have to account for that baseline too.
  it("Steel Kick: places more threat in alter-ego form with the Metal trait in play than without", () => {
    const withMetalStart = stackEncounterDeck(absorbingManVsHeroes(), ADVANCE, "04083");
    const withMetal = settle(runWave2(withMetalStart, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(traitsOf(withMetal, withMetal.villains[0]!.instanceId, WAVE2_DEPS).map(String)).toContain("METAL");
    const metalScheme = withMetal.mainScheme.instanceId;
    const metalBefore = inst(withMetal, metalScheme).threat;
    const metalAfter = inst(
      settle(runWave2(stackEncounterDeck(withMetal, ADVANCE, "04087"), endTurn()), firstLegal, undefined, WAVE2_DEPS),
      metalScheme,
    ).threat;

    // Whichever environment setup happened to place has only 1 copy, so a non-Metal comparison must use a
    // different one to leave a copy in the deck for `stackEncounterDeck` to find.
    const nonMetalEnvironment = ENVIRONMENTS.find(
      (code) => code !== "04083" && code !== environmentInPlay(absorbingManVsHeroes()),
    )!;
    const withWoodStart = stackEncounterDeck(absorbingManVsHeroes(), ADVANCE, nonMetalEnvironment);
    const withWood = settle(runWave2(withWoodStart, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(traitsOf(withWood, withWood.villains[0]!.instanceId, WAVE2_DEPS).map(String)).not.toContain("METAL");
    const woodScheme = withWood.mainScheme.instanceId;
    const woodBefore = inst(withWood, woodScheme).threat;
    const woodAfter = inst(
      settle(runWave2(stackEncounterDeck(withWood, ADVANCE, "04087"), endTurn()), firstLegal, undefined, WAVE2_DEPS),
      woodScheme,
    ).threat;

    expect(metalAfter - metalBefore).toBe(woodAfter - woodBefore + 1);
  });

  it("Steel Kick: deals more indirect damage in hero form with the Metal trait in play than without", () => {
    const withMetalStart = stackEncounterDeck(absorbingManVsHeroes(), ADVANCE, "04083");
    const withMetal = runWave2(
      settle(runWave2(withMetalStart, endTurn()), firstLegal, undefined, WAVE2_DEPS),
      toHero(),
    );
    expect(traitsOf(withMetal, withMetal.villains[0]!.instanceId, WAVE2_DEPS).map(String)).toContain("METAL");
    const metalIdentity = identityOf(withMetal);
    const metalBefore = inst(withMetal, metalIdentity).damage;
    const metalAfter = inst(
      settle(runWave2(stackEncounterDeck(withMetal, ADVANCE, "04087"), endTurn()), firstLegal, undefined, WAVE2_DEPS),
      metalIdentity,
    ).damage;

    const nonMetalEnvironment = ENVIRONMENTS.find(
      (code) => code !== "04083" && code !== environmentInPlay(absorbingManVsHeroes()),
    )!;
    const withWoodStart = stackEncounterDeck(absorbingManVsHeroes(), ADVANCE, nonMetalEnvironment);
    const withWood = runWave2(settle(runWave2(withWoodStart, endTurn()), firstLegal, undefined, WAVE2_DEPS), toHero());
    expect(traitsOf(withWood, withWood.villains[0]!.instanceId, WAVE2_DEPS).map(String)).not.toContain("METAL");
    const woodIdentity = identityOf(withWood);
    const woodBefore = inst(withWood, woodIdentity).damage;
    const woodAfter = inst(
      settle(runWave2(stackEncounterDeck(withWood, ADVANCE, "04087"), endTurn()), firstLegal, undefined, WAVE2_DEPS),
      woodIdentity,
    ).damage;

    expect(metalAfter - metalBefore).toBe(woodAfter - woodBefore + 1);
  });

  it("Piercing Thorns: discards 1 card at random from your hand", () => {
    const start = stackEncounterDeck(absorbingManVsHeroes(), ADVANCE, "04088");
    const before = playerOf(start, P1).hand.length;
    const settled = settle(runWave2(start, toHero(), endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(playerOf(settled, P1).hand.length).toBeLessThan(before);
  });

  it("Icy Grip: stuns you, with the Ice trait in play", () => {
    const start = stackEncounterDeck(absorbingManVsHeroes(), ADVANCE, "04081"); // Snowy Hillside, Ice
    const withIce = settle(runWave2(start, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(traitsOf(withIce, withIce.villains[0]!.instanceId, WAVE2_DEPS).map(String)).toContain("ICE");
    const settled = settle(
      runWave2(stackEncounterDeck(withIce, ADVANCE, "04090"), endTurn()),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(settled, identityOf(settled)).statuses.stunned).toBeGreaterThan(0);
  });

  it("Ball and Chain: a Hero Action and a Boost ability are both scripted", () => {
    expect(WAVE2_DEPS.abilities["04084.ball-and-chain-action"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04084.boost"]).toBeDefined();
  });

  it("Super Absorbing Power: grants Absorbing Man all four traits at once", () => {
    expect(WAVE2_DEPS.abilities["04092.super-absorbing-power-constant"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04077.when-revealed"]).toBeDefined();
  });

  it("Omni-Morph Duplication and its data-artifact refs (module docblock) all resolve", () => {
    for (const id of [
      "04089.when-revealed",
      "04089.omni-morph-duplication-constant",
      "04089.omni-morph-duplication-constant-2",
      "04089.omni-morph-duplication-constant-3",
      "04089.omni-morph-duplication-constant-4",
    ] as const) {
      expect(WAVE2_DEPS.abilities[id], id).toBeDefined();
    }
  });
});

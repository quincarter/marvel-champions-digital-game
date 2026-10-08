/** Wording for lasting-effect durations and wave 8's rule kinds (docs/phase7-wave8.md §3.10, §3.13, §3.21, §3.34, §3.42, §3.43, §3.63). */

import type { LastingDuration, LastingEffect, RuleSpec } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { lastingDurationWords, lastingEffectWords, ruleKindWords, ruleWords } from "./rule-words.js";

const rule = (spec: unknown): RuleSpec => spec as RuleSpec;

describe("lastingDurationWords", () => {
  test("the villain phase beginning has its own words", () => {
    expect(lastingDurationWords({ kind: "nextVillainPhaseBegins" })).toBe("until the villain phase begins");
  });

  test("the older durations still read as phrases", () => {
    expect(lastingDurationWords({ kind: "endOfRound" })).toBe("until the end of the round");
    expect(lastingDurationWords({ kind: "endOfPhase" })).toBe("until the end of the phase");
    expect(lastingDurationWords({ kind: "endOfTurn" })).toBe("until the end of the turn");
  });

  test("no duration prints its own id", () => {
    const durations = [
      { kind: "endOfPhase" },
      { kind: "endOfRound" },
      { kind: "nextVillainPhaseBegins" },
      { kind: "endOfTurn" },
      { kind: "endOfEvent", frameId: "f1" },
      { kind: "awaitingAttack", frameId: "f1" },
      { kind: "endOfCardResolution", instanceId: "i1" },
      { kind: "endOfPaidFor", frameId: "f1" },
      { kind: "untilCardPlayed", playerId: "p1" },
      { kind: "endOfPlayerTurn", playerId: "p1" },
      { kind: "nextBasicPower", characterIds: [], powers: ["attack", "thwart"] },
    ] as unknown as LastingDuration[];
    for (const duration of durations) {
      expect(lastingDurationWords(duration), duration.kind).not.toMatch(/[a-z][A-Z]/);
    }
    expect(durations[10] && lastingDurationWords(durations[10])).toBe("for the next basic attack or thwart");
    expect(lastingDurationWords({ kind: "nextBasicPower", characterIds: [], powers: ["thwart"] })).toBe(
      "for the next basic thwart",
    );
  });
});

describe("rule kinds", () => {
  test("every wave 8 kind, and cannotBeDefeated beside them, has words", () => {
    for (const kind of [
      "cannotBeDefeated",
      "consideredRemainingHp",
      "consideredResourceIcon",
      "ignoreAbilities",
      "cannotEnterPlay",
      "playDestination",
      "formChangeCost",
    ]) {
      expect(ruleKindWords(kind), kind).not.toBeNull();
    }
    expect(ruleKindWords("somethingElse")).toBeNull();
  });

  test("each rule reads with its numbers and names", () => {
    expect(ruleWords(rule({ kind: "consideredRemainingHp", target: {}, atLeast: 1 }))).toBe(
      "Considered to have at least 1 hit point",
    );
    expect(ruleWords(rule({ kind: "consideredRemainingHp", target: {}, atLeast: 3 }))).toBe(
      "Considered to have at least 3 hit points",
    );
    expect(ruleWords(rule({ kind: "consideredResourceIcon", target: {}, resource: "wild" }))).toBe(
      "Considered to have an extra wild resource icon",
    );
    expect(ruleWords(rule({ kind: "ignoreAbilities", on: {}, abilities: ["a"] }))).toBe("Ignores 1 ability");
    expect(ruleWords(rule({ kind: "ignoreAbilities", on: {}, abilities: ["a", "b"] }))).toBe("Ignores 2 abilities");
    expect(ruleWords(rule({ kind: "cannotEnterPlay", cards: {} }))).toBe("Can't enter play");
    expect(ruleWords(rule({ kind: "cannotBeDefeated", target: {} }))).toBe("Can't be defeated");
    expect(ruleWords(rule({ kind: "playDestination", cards: {}, area: "mission" }))).toBe(
      "Can be played to the mission area",
    );
    expect(ruleWords(rule({ kind: "formChangeCost", player: {}, cost: {} }))).toBe("Changing form costs extra");
    expect(ruleWords(rule({ kind: "formChangeCost", player: {}, to: "alterEgo", cost: {} }))).toBe(
      "Changing to alter-ego form costs extra",
    );
  });

  test("a rule with no wording is null, not an id", () => {
    expect(ruleWords(rule({ kind: "cannotFlip", target: {} }))).toBeNull();
  });
});

describe("lastingEffectWords", () => {
  const lasting = (body: unknown, duration: LastingDuration): LastingEffect =>
    ({ id: "l1", duration, ...(body as object) }) as unknown as LastingEffect;

  test("a rule with a clock reads as the rule, then the clock", () => {
    expect(
      lastingEffectWords(
        lasting(
          { kind: "ruleGrant", rule: { kind: "cannotEnterPlay", cards: {} } },
          { kind: "nextVillainPhaseBegins" },
        ),
      ),
    ).toBe("Can't enter play, until the villain phase begins");
  });

  test("a card-effect bonus for matching cards names what it adds", () => {
    expect(
      lastingEffectWords(
        lasting({ kind: "cardEffectBonusFor", cards: {}, damage: 1, threatRemoved: 0 }, { kind: "endOfPhase" }),
      ),
    ).toBe("Matching cards get +1 damage, until the end of the phase");
    expect(
      lastingEffectWords(
        lasting({ kind: "cardEffectBonusFor", cards: {}, damage: 2, threatRemoved: 1 }, { kind: "endOfRound" }),
      ),
    ).toBe("Matching cards get +2 damage, +1 threat removed, until the end of the round");
  });

  test("a bonus of nothing and a kind with no wording are null", () => {
    expect(
      lastingEffectWords(
        lasting({ kind: "cardEffectBonusFor", cards: {}, damage: 0, threatRemoved: 0 }, { kind: "endOfPhase" }),
      ),
    ).toBeNull();
    expect(lastingEffectWords(lasting({ kind: "blankTextBox", targets: [] }, { kind: "endOfPhase" }))).toBeNull();
  });
});

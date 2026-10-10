import { describe, expect, it } from "vitest";
import {
  aScheme,
  anEnemy,
  chooseOne,
  chosen,
  countOf,
  dealDamage,
  heroAction,
  option,
  query,
  removeThreat,
  repeatTimes,
  validateDefinition,
} from "./index.js";

const SUPPORTS = query("support", { controller: "you" });
const threatOrDamage = chooseOne(
  option("Remove 1 threat from a scheme", aScheme(), removeThreat(1, chosen("scheme"))),
  option("Deal 1 damage to an enemy", anEnemy(), dealDamage(1, chosen("enemy"))),
);

describe("repeatTimes: 'For each …, choose' (All-Points Bulletin, aos 50003; RRG 1.8 \"'For Each'\", p. 20)", () => {
  it("builds the effect: a live count and the repeated effects, flattened", () => {
    expect(repeatTimes(countOf(SUPPORTS), aScheme(), [removeThreat(1, chosen("scheme"))])).toEqual({
      kind: "repeatTimes",
      times: { kind: "count", query: SUPPORTS },
      effects: [aScheme(), removeThreat(1, chosen("scheme"))],
    });
  });

  it("a literal count becomes a constant value", () => {
    expect(repeatTimes(3, threatOrDamage)).toMatchObject({ times: { kind: "const", value: 3 } });
  });

  it("validates: each pass reads what it chose itself", () => {
    expect(validateDefinition(heroAction(repeatTimes(countOf(SUPPORTS), threatOrDamage)))).toEqual([]);
    expect(
      validateDefinition(heroAction(repeatTimes(countOf(SUPPORTS), anEnemy(), dealDamage(1, chosen("enemy"))))),
    ).toEqual([]);
  });

  it("a pass reads what the ability bound before the repetition", () => {
    expect(validateDefinition(heroAction(anEnemy(), repeatTimes(2, dealDamage(1, chosen("enemy")))))).toEqual([]);
  });

  it("refuses an effect after the repetition that reads what a pass chose", () => {
    const problems = validateDefinition(
      heroAction(repeatTimes(2, anEnemy(), dealDamage(1, chosen("enemy"))), dealDamage(1, chosen("enemy"))),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/enemy/);
  });

  it("refuses a slot nothing binds inside a pass, a constant count below 1 or a fraction, and no effects", () => {
    expect(validateDefinition(heroAction(repeatTimes(2, dealDamage(1, chosen("nobody")))))).not.toEqual([]);
    for (const times of [0, -1, 1.5]) {
      const problems = validateDefinition(heroAction(repeatTimes(times, threatOrDamage)));
      expect(problems, String(times)).toHaveLength(1);
      expect(problems[0]).toMatch(/times must be a whole number of at least 1/);
    }
    expect(validateDefinition(heroAction(repeatTimes(2)))[0]).toMatch(/repeats no effects/);
  });
});

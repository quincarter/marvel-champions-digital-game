/**
 * Which modular sets a competitive scenario may name (MC56 p. 5: "in competitive mode only registration or resistance
 * sets are legal"; p. 4: sides are not mixed; owner decision N6, 2026-11-20: Synthezoid Smackdown's sided sets join the
 * pool locked to their side).
 */
import { describe, expect, it } from "vitest";
import { civilWarCompetitive, competitiveModularSetProblem } from "./competitive.js";

const teams = (registrationSets: readonly string[], resistanceSets: readonly string[]) =>
  [
    {
      leaderScenarioId: "registration-iron-man",
      scenario: { modularSetIds: registrationSets },
      players: [{ starterDeckId: "tigra-aggression" }],
    },
    {
      leaderScenarioId: "resistance-captain-america",
      scenario: { modularSetIds: resistanceSets },
      players: [{ starterDeckId: "hulkling-protection" }],
    },
  ] as const;

describe("competitive modular sets", () => {
  it("accepts a set of the team's own side", () => {
    expect(competitiveModularSetProblem("registration", "martial_law")).toBeNull();
    expect(competitiveModularSetProblem("resistance", "new_avengers")).toBeNull();
  });

  it("refuses a set of the other side", () => {
    expect(competitiveModularSetProblem("registration", "new_avengers")).toMatch(/resistance set/);
  });

  it("refuses a neutral set from another product, which is cooperative only", () => {
    expect(competitiveModularSetProblem("registration", "bomb_scare")).toMatch(/only registration and resistance sets/);
  });

  it("civilWarCompetitive throws for a neutral or opposite set and builds with sided ones", () => {
    const sided = civilWarCompetitive({
      seed: 1,
      teams: teams(["martial_law", "mighty_avengers", "paladin"], ["new_avengers", "namor_modular", "secret_avengers"]),
    });
    expect(sided.gameMode).toBe("competitive");
    expect(() =>
      civilWarCompetitive({
        seed: 1,
        teams: teams(["martial_law", "bomb_scare", "paladin"], ["new_avengers", "namor_modular", "secret_avengers"]),
      }),
    ).toThrow(/only registration and resistance sets/);
    expect(() =>
      civilWarCompetitive({
        seed: 1,
        teams: teams(["martial_law", "new_avengers", "paladin"], ["new_avengers", "namor_modular", "secret_avengers"]),
      }),
    ).toThrow(/resistance set/);
  });
});

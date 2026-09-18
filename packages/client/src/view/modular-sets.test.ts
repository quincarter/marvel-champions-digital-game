import { describe, expect, test } from "vitest";
import { modularSetCandidateIdsFor, modularSetOptionsFor, toggleModularSet } from "./modular-sets.js";
import { initialSetupDraft } from "./setup-draft.js";
import { POOL_SCENARIOS } from "../content/pool.js";

const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const riskyBusiness = POOL_SCENARIOS.find((s) => (s.id as string) === "risky-business")!;
const breakout = POOL_SCENARIOS.find((s) => (s.id as string) === "breakout")!;

function draftFor(scenarioId: string) {
  return initialSetupDraft({ scenarioId, seatDeckId: "precon:core-spider-man-justice", seed: 1 });
}

describe("modularSetCandidateIdsFor", () => {
  test("Rhino: the five Core modulars, its own recommendation already among them", () => {
    const ids = modularSetCandidateIdsFor(rhino);
    expect(ids).toContain("bomb_scare");
    expect(ids.length).toBe(5);
  });

  test("a wave 1 scenario's own recommended set is added to the five Core modulars", () => {
    const ids = modularSetCandidateIdsFor(riskyBusiness);
    expect(ids).toContain("power_drain");
    expect(ids).toContain("bomb_scare");
    expect(ids.length).toBe(6);
  });
});

describe("modularSetOptionsFor", () => {
  test("the recommended set is selected by default (draft hasn't overridden it)", () => {
    const options = modularSetOptionsFor(draftFor("rhino"), rhino);
    const bombScare = options.find((o) => o.id === "bomb_scare")!;
    expect(bombScare.selected).toBe(true);
    expect(bombScare.recommended).toBe(true);
    expect(options.filter((o) => o.selected).length).toBe(1);
  });

  test("Breakout offers the five Core modulars, none selected, none recommended", () => {
    const options = modularSetOptionsFor(draftFor("breakout"), breakout);
    expect(options.length).toBe(5);
    expect(options.every((o) => !o.selected && !o.recommended)).toBe(true);
  });
});

describe("toggleModularSet", () => {
  test("picking a non-recommended set at cap 1 swaps it in", () => {
    const draft = toggleModularSet(draftFor("rhino"), rhino, "under_attack");
    const options = modularSetOptionsFor(draft, rhino);
    expect(options.find((o) => o.id === "under_attack")?.selected).toBe(true);
    expect(options.find((o) => o.id === "bomb_scare")?.selected).toBe(false);
    expect(options.filter((o) => o.selected).length).toBe(1);
  });

  test("toggling the same set off leaves nothing selected", () => {
    const chosen = toggleModularSet(draftFor("rhino"), rhino, "under_attack");
    const cleared = toggleModularSet(chosen, rhino, "under_attack");
    expect(modularSetOptionsFor(cleared, rhino).some((o) => o.selected)).toBe(false);
  });

  test("Breakout (cap 0) never gains a modular set from a toggle", () => {
    const draft = toggleModularSet(draftFor("breakout"), breakout, "bomb_scare");
    expect(modularSetOptionsFor(draft, breakout).some((o) => o.selected)).toBe(false);
  });
});

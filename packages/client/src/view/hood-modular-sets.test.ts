import { describe, expect, test } from "vitest";
import {
  effectiveIncludedSetIds,
  hasSetAsideModularChoice,
  hoodModularSetOptionsFor,
  includedCountFor,
  setAsideCandidateIdsFor,
  toggleHoodIncludedSet,
} from "./hood-modular-sets.js";
import { initialSetupDraft, setSetAsideModularSetIds } from "./setup-draft.js";
import { CARDS_BY_ID, POOL_SCENARIOS } from "../content/pool.js";

const theHood = POOL_SCENARIOS.find((s) => (s.id as string) === "the-hood")!;
const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;

function draftFor(scenarioId: string) {
  return initialSetupDraft({ scenarioId, seatDeckId: "precon:core-spider-man-justice", seed: 1 });
}

describe("hasSetAsideModularChoice", () => {
  test("true only for The Hood", () => {
    expect(hasSetAsideModularChoice(theHood)).toBe(true);
    expect(hasSetAsideModularChoice(rhino)).toBe(false);
    expect(hasSetAsideModularChoice(undefined)).toBe(false);
  });
});

describe("setAsideCandidateIdsFor", () => {
  test("The Hood has exactly nine candidates — its own modular sets, minus its villain's required set and Standard/Expert II", () => {
    const ids = setAsideCandidateIdsFor(theHood);
    expect(ids).toHaveLength(9);
    expect(ids).not.toContain("the_hood");
    expect(ids).not.toContain("standard_ii");
    expect(ids).not.toContain("expert_ii");
  });
});

describe("includedCountFor", () => {
  test("9 candidates minus 7 set aside leaves 2 included", () => {
    expect(includedCountFor(theHood, 9)).toBe(2);
  });
});

describe("effectiveIncludedSetIds / hoodModularSetOptionsFor", () => {
  test("the default is the last two candidates in declaration order (the scenario builder's own default sets aside the first seven)", () => {
    const candidates = setAsideCandidateIdsFor(theHood);
    const draft = draftFor(theHood.id as string);
    expect(effectiveIncludedSetIds(draft, theHood)).toEqual(candidates.slice(7));
  });

  test("options report card counts/descriptors and mark exactly the included two", () => {
    const draft = draftFor(theHood.id as string);
    const options = hoodModularSetOptionsFor(draft, theHood, CARDS_BY_ID);
    expect(options).toHaveLength(9);
    expect(options.filter((o) => o.included)).toHaveLength(2);
    for (const option of options) expect(option.cardCount).toBeGreaterThan(0);
  });

  test("an explicit draft choice is read back correctly", () => {
    const candidates = setAsideCandidateIdsFor(theHood);
    let draft = draftFor(theHood.id as string);
    const setAside = candidates.slice(0, 7); // aside every candidate but the first two
    draft = setSetAsideModularSetIds(draft, setAside);
    expect([...effectiveIncludedSetIds(draft, theHood)].sort()).toEqual([...candidates.slice(7)].sort());
  });
});

describe("toggleHoodIncludedSet", () => {
  test("toggling a set into the included pair drops the oldest one (rolling window, cap 2)", () => {
    const candidates = setAsideCandidateIdsFor(theHood);
    let draft = draftFor(theHood.id as string);
    const beforeIncluded = effectiveIncludedSetIds(draft, theHood);
    expect(beforeIncluded).toHaveLength(2);

    draft = toggleHoodIncludedSet(draft, theHood, candidates[0]!);
    const afterIncluded = effectiveIncludedSetIds(draft, theHood);
    expect(afterIncluded).toHaveLength(2);
    expect(afterIncluded).toContain(candidates[0]);
    // The set-aside list is the complement — nine candidates minus the two included.
    expect(draft.setAsideModularSetIds).toHaveLength(7);
    expect(draft.setAsideModularSetIds).not.toContain(candidates[0]);
  });

  test("toggling an included set out removes it, shrinking the included count", () => {
    let draft = draftFor(theHood.id as string);
    const included = effectiveIncludedSetIds(draft, theHood);
    draft = toggleHoodIncludedSet(draft, theHood, included[0]!);
    expect(effectiveIncludedSetIds(draft, theHood)).toEqual([included[1]]);
    expect(draft.setAsideModularSetIds).toHaveLength(8);
  });
});

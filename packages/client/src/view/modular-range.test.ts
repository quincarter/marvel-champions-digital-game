import { describe, expect, test } from "vitest";
import { CW_SCENARIOS } from "@mc/content";
import { OTHER_SIDE_GROUP_ID, OWN_SIDE_GROUP_ID, modularCandidatesFor, otherSideReason } from "./modular-candidates.js";
import {
  modularAtMaxReason,
  modularPickRangeFor,
  modularPickStatus,
  modularSectionsFor,
  modularSetOptionsFor,
  toggleModularSet,
} from "./modular-sets.js";
import { initialSetupDraft } from "./setup-draft.js";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";

// The client pool holds the cw records (C10), so its own sets are what a table setup would offer.
const SETS = POOL_ENCOUNTER_SETS;
const ironMan = CW_SCENARIOS.find((s) => (s.id as string) === "registration-iron-man")!;
const captainAmerica = CW_SCENARIOS.find((s) => (s.id as string) === "resistance-captain-america")!;
const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const context = { encounterSets: SETS };

function draftWith(ids: readonly string[] | null) {
  const draft = initialSetupDraft({ scenarioId: "registration-iron-man", seatDeckId: "x", seed: 1 });
  return { ...draft, modularSetIds: ids };
}

describe("a Civil War scenario pick range", () => {
  test("3 to 4, and a fixed scenario is n to n", () => {
    expect(modularPickRangeFor(ironMan, 1)).toEqual({ min: 3, max: 4 });
    expect(modularPickRangeFor(rhino, 1)).toEqual({ min: 1, max: 1 });
  });

  test("status words: how many are chosen, how many more are needed or allowed", () => {
    expect(modularPickStatus(ironMan, 2, 1)).toEqual({
      rangeLabel: "3 or 4 sets",
      line: "3 to 4 sets. Chosen: 2.",
      needed: 1,
      allowedMore: 2,
      hint: "Pick 1 more",
      problem: `${ironMan.name} uses 3 to 4 modular sets, got 2`,
    });
    const three = modularPickStatus(ironMan, 3, 1);
    expect([three.needed, three.allowedMore, three.hint, three.problem]).toEqual([0, 1, "Room for 1 more", null]);
    const four = modularPickStatus(ironMan, 4, 1);
    expect([four.line, four.needed, four.allowedMore, four.hint, four.problem]).toEqual([
      "3 to 4 sets. Chosen: 4.",
      0,
      0,
      null,
      null,
    ]);
  });

  test("a fixed count reads as a plain number", () => {
    expect(modularPickStatus(rhino, 0, 1).rangeLabel).toBe("1 set");
    expect(modularPickStatus(rhino, 0, 1).hint).toBe("Pick 1 more");
  });

  test("the at-most reason appears only for a full range", () => {
    expect(modularAtMaxReason({ min: 3, max: 4 }, 3)).toBeNull();
    expect(modularAtMaxReason({ min: 3, max: 4 }, 4)).toBe("Four is the most (MC56 p. 4)");
    expect(modularAtMaxReason({ min: 1, max: 1 }, 1)).toBeNull();
  });
});

describe("candidates for a sided scenario", () => {
  const candidates = modularCandidatesFor(ironMan, undefined, SETS);
  const group = (id: string) => candidates.filter((c) => c.groupId === id).map((c) => c.id);

  test("leader four first, its side next, neutral sets, then the other side last", () => {
    expect(group("recommended")).toEqual([
      "mighty_avengers",
      "the_initiative",
      "maria_hill_modular",
      "dangerous_recruits",
    ]);
    expect(group(OWN_SIDE_GROUP_ID)).toEqual([
      "cape_killer",
      "heroes_for_hire",
      "martial_law",
      "paladin",
      "deadly_duo",
      "shield_ops",
      "taskmaster_modular",
      "thunderbolts_modular",
    ]);
    expect(group(OTHER_SIDE_GROUP_ID)).toEqual([
      "atlanteans",
      "cloak_and_dagger_modular",
      "defenders",
      "hells_kitchen",
      "namor_modular",
      "new_avengers",
      "secret_avengers",
      "spider_man_modular",
      "moon_knight_modular",
      "royal_guard",
      "scarlet_twins",
      "young_avengers",
    ]);
    expect(candidates.slice(-12).map((c) => c.groupId)).toEqual(Array(12).fill(OTHER_SIDE_GROUP_ID));
  });

  test("other products sets are offered with no reason; leader sets never are", () => {
    const ids = candidates.map((c) => c.id);
    expect(ids).toContain("bomb_scare");
    expect(candidates.find((c) => c.id === "bomb_scare")!.disabledReason).toBeUndefined();
    expect(ids).not.toContain("iron_man_leader");
    expect(ids).not.toContain("captain_america_leader");
  });

  test("the other side is disabled with the reason, never omitted", () => {
    expect(candidates.find((c) => c.id === "atlanteans")).toEqual({
      id: "atlanteans",
      recommended: false,
      groupId: "other-side",
      groupLabel: "Other side",
      disabledReason: "Atlanteans is a resistance set; this scenario is registration (MC56 p. 4)",
    });
    const resistance = modularCandidatesFor(captainAmerica, undefined, SETS);
    expect(resistance.find((c) => c.id === "paladin")!.disabledReason).toBe(
      "Paladin is a registration set; this scenario is resistance (MC56 p. 4)",
    );
    expect(resistance.filter((c) => c.groupId === OTHER_SIDE_GROUP_ID)).toHaveLength(12);
  });

  test("the seam: a neutral set or a matching side has no side reason", () => {
    const set = (id: string) => SETS.find((s) => (s.id as string) === id)!;
    expect(otherSideReason(ironMan, set("bomb_scare"))).toBeNull();
    expect(otherSideReason(ironMan, set("paladin"))).toBeNull();
    expect(otherSideReason(rhino, set("paladin"))).toBeNull();
  });

  test("a fixed-count scenario gains no side group", () => {
    expect(modularCandidatesFor(rhino).some((c) => c.groupId === OTHER_SIDE_GROUP_ID || c.disabledReason)).toBe(false);
  });
});

describe("options and toggling at a range", () => {
  const optionsFor = (ids: readonly string[] | null) =>
    modularSetOptionsFor(draftWith(ids), ironMan, CARDS_BY_ID, context);
  const option = (ids: readonly string[] | null, id: string) => optionsFor(ids).find((o) => o.id === id)!;
  const three = ["mighty_avengers", "the_initiative", "maria_hill_modular"];
  const four = [...three, "dangerous_recruits"];

  test("below the maximum an unchosen neutral set is open; the other side stays disabled", () => {
    expect(option(three, "bomb_scare").disabledReason).toBeNull();
    expect(option(three, "defenders").disabledReason).toBe(
      "Defenders is a resistance set; this scenario is registration (MC56 p. 4)",
    );
  });

  test("at four, every unchosen tile reads the most-reason and chosen ones stay open", () => {
    expect(option(four, "bomb_scare").disabledReason).toBe("Four is the most (MC56 p. 4)");
    expect(option(four, "paladin").disabledReason).toBe("Four is the most (MC56 p. 4)");
    expect(option(four, "mighty_avengers").disabledReason).toBeNull();
    expect(option(four, "mighty_avengers").selected).toBe(true);
    expect(option(four, "defenders").disabledReason).toContain("resistance set");
  });

  test("the recommendation (null picks) counts as the four chosen", () => {
    expect(option(null, "bomb_scare").disabledReason).toBe("Four is the most (MC56 p. 4)");
  });

  test("the other side is a section of its own, last", () => {
    const sections = modularSectionsFor(0, optionsFor(null));
    expect(sections[0]).toEqual({ id: "recommended", label: "Recommended · 4", itemCount: 4 });
    expect(sections.at(-1)).toEqual({ id: "other-side", label: "Other side · 12", itemCount: 12 });
  });

  test("a set of a fixed scenario is unchanged: no disabled reason from a count", () => {
    const draft = initialSetupDraft({ scenarioId: "rhino", seatDeckId: "x", seed: 1 });
    const options = modularSetOptionsFor({ ...draft, modularSetIds: ["bomb_scare"] }, rhino, CARDS_BY_ID);
    expect(options.filter((o) => o.disabledReason !== null)).toEqual([]);
  });

  test("toggle adds up to four, never rolls a pick out, then removes", () => {
    const added = toggleModularSet(draftWith(three), ironMan, "bomb_scare", 1);
    expect(added.modularSetIds).toEqual([...three, "bomb_scare"]);
    expect(toggleModularSet(draftWith(four), ironMan, "bomb_scare", 1).modularSetIds).toEqual(four);
    expect(toggleModularSet(draftWith(four), ironMan, "dangerous_recruits", 1).modularSetIds).toEqual(three);
  });

  test("a fixed scenario still replaces its single pick", () => {
    const draft = initialSetupDraft({ scenarioId: "rhino", seatDeckId: "x", seed: 1 });
    const next = toggleModularSet({ ...draft, modularSetIds: ["bomb_scare"] }, rhino, "under_attack", 1);
    expect(next.modularSetIds).toEqual(["under_attack"]);
  });
});

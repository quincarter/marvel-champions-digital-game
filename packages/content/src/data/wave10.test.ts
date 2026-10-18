import { describe, expect, it } from "vitest";
import {
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateScenarioMainSchemeStages,
} from "../schema/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/index.js";
import {
  CAMPAIGNS,
  CORE_CARDS,
  CW_CARDS,
  CW_ENCOUNTER_SETS,
  CW_SCENARIOS,
  CW_STARTER_DECKS,
  DATA_ONLY_CARDS,
  DATA_ONLY_ENCOUNTER_SETS,
  HERCULES_CARDS,
  HERCULES_ENCOUNTER_SETS,
  HERCULES_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE9_CARDS,
  WONDER_MAN_CARDS,
  WONDER_MAN_ENCOUNTER_SETS,
  WONDER_MAN_STARTER_DECKS,
  WAVE10_CARDS,
  WAVE10_ENCOUNTER_SETS,
  WAVE10_SCENARIOS,
  WAVE10_STARTER_DECKS,
  WAVE11_CARDS,
} from "./index.js";

/**
 * Wave 10 (cycle 10, docs/phase7-wave10.md): pool wiring. `cw` (Civil War, MC56), `wonder_man` and `hercules` (the
 * cycle's hero packs) are in; none has a scripted kit yet. What each pack contains is `cw.test.ts`, `wonder_man.test.ts`
 * and `hercules.test.ts`.
 */
describe("wave 10 data: pool wiring", () => {
  it("WAVE10_CARDS is Core plus cw, wonder_man and hercules, with no duplicate ids", () => {
    expect(WAVE10_CARDS).toHaveLength(
      CORE_CARDS.length + CW_CARDS.length + WONDER_MAN_CARDS.length + HERCULES_CARDS.length,
    );
    expect(WAVE10_CARDS.slice(0, CORE_CARDS.length)).toEqual(CORE_CARDS);
    expect(WAVE10_CARDS.slice(CORE_CARDS.length)).toEqual([...CW_CARDS, ...WONDER_MAN_CARDS, ...HERCULES_CARDS]);
    expect(new Set(WAVE10_CARDS.map((c) => c.id)).size).toBe(WAVE10_CARDS.length);
  });

  it("the wave adds 34 Wonder Man cards and 45 Hercules cards, and Wonder Man left the data-only pool", () => {
    expect(WONDER_MAN_CARDS).toHaveLength(34);
    expect(HERCULES_CARDS).toHaveLength(45);
    expect(DATA_ONLY_CARDS).toEqual([]);
    expect(DATA_ONLY_ENCOUNTER_SETS).toEqual([]);
  });

  it("PLAYABLE_CARDS carries every wave 10 card exactly once, after the wave 9 cards, in pack order", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    const wave10 = [...CW_CARDS, ...WONDER_MAN_CARDS, ...HERCULES_CARDS];
    for (const c of wave10)
      expect(
        ids.filter((id) => id === (c.id as string)),
        c.id as string,
      ).toHaveLength(1);
    const wave9Last = ids.lastIndexOf(WAVE9_CARDS[WAVE9_CARDS.length - 1]!.id as string);
    expect(ids.indexOf(CW_CARDS[0]!.id as string)).toBeGreaterThan(wave9Last);
    // Wave 11 (`fne`) follows wave 10 in the pool; wave10's cards are the block just before it.
    const tail = ids.length - (WAVE11_CARDS.length - CORE_CARDS.length);
    expect(ids.slice(tail - wave10.length, tail)).toEqual(wave10.map((c) => c.id as string));
  });

  it("every wave 10 card passes validateCard()", () => {
    const failures = WAVE10_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("every wave 10 card id is its MarvelCDB code (no clash with another pack's id), and all three packs are cycle10", () => {
    const others = new Set(WAVE9_CARDS.map((c) => c.id as string));
    for (const c of [...CW_CARDS, ...WONDER_MAN_CARDS, ...HERCULES_CARDS]) {
      expect(others.has(c.id as string), c.id as string).toBe(false);
      expect(c.cycleId as string, c.id as string).toBe("cycle10");
    }
  });
});

describe("wave 10 data: encounter sets, scenarios and starter decks", () => {
  it("29 encounter sets (26 cw, 1 wonder_man, 2 hercules), unique, and every card's sets exist", () => {
    expect(WAVE10_ENCOUNTER_SETS).toHaveLength(29);
    expect(WAVE10_ENCOUNTER_SETS.slice(0, 26)).toEqual(CW_ENCOUNTER_SETS);
    expect(WAVE10_ENCOUNTER_SETS.slice(26)).toEqual([...WONDER_MAN_ENCOUNTER_SETS, ...HERCULES_ENCOUNTER_SETS]);
    const known = new Set(WAVE10_ENCOUNTER_SETS.map((s) => s.id as string));
    expect(known.size).toBe(29);
    for (const c of [...CW_CARDS, ...WONDER_MAN_CARDS, ...HERCULES_CARDS])
      for (const id of (c as { encounterSetIds?: readonly unknown[] }).encounterSetIds ?? [])
        expect(known.has(id as string), `${c.id}: ${String(id)}`).toBe(true);
  });

  it("four scenarios, one per leader, each valid with its sets and main scheme stages resolving", () => {
    expect(WAVE10_SCENARIOS).toEqual(CW_SCENARIOS);
    expect(WAVE10_SCENARIOS.map((s) => s.id as string)).toEqual([
      "registration-iron-man",
      "registration-captain-marvel",
      "resistance-captain-america",
      "resistance-spider-woman",
    ]);
    const sets = [...CORE_ENCOUNTER_SETS, ...WAVE10_ENCOUNTER_SETS];
    for (const s of WAVE10_SCENARIOS) {
      expect(validateScenario(s).errors, s.id as string).toEqual([]);
      expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
      expect(validateScenarioMainSchemeStages(s, WAVE10_CARDS, sets).errors, s.id as string).toEqual([]);
    }
  });

  it("four playable starter decks (Tigra, Hulkling, Wonder Man, Hercules)", () => {
    expect(WAVE10_STARTER_DECKS).toEqual([...CW_STARTER_DECKS, ...WONDER_MAN_STARTER_DECKS, ...HERCULES_STARTER_DECKS]);
    expect(WAVE10_STARTER_DECKS.map((d) => d.id as string)).toEqual([
      "tigra-aggression",
      "hulkling-protection",
      "wonder-man-justice",
      "hercules-leadership",
    ]);
  });

  it("every wave 10 hero's nemesis set has exactly one nemesis minion, the set's own minion", () => {
    type Flagged = { id: string; type: string; nemesisMinion?: boolean; encounterSetIds?: string[] };
    const cards = WAVE10_CARDS as unknown as readonly Flagged[];
    const expected: Record<string, string> = {
      tigra_nemesis: "56024",
      hulkling_nemesis: "56055",
      wonder_man_nemesis: "58026",
      hercules_nemesis: "59036",
    };
    for (const [set, minion] of Object.entries(expected)) {
      const inSet = cards.filter((c) => c.encounterSetIds?.includes(set));
      expect(
        inSet.filter((c) => c.nemesisMinion === true).map((c) => c.id),
        set,
      ).toEqual([minion]);
      expect(inSet.find((c) => c.id === minion)?.type, set).toBe("minion");
    }
  });

  it("Civil War has no campaign (MC56 p. 3)", () => {
    expect(CAMPAIGNS.some((c) => (c.packCode as string) === "cw")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { validateCard } from "../schema/index.js";
import type { AttachmentCard, MainSchemeCard, VillainCard } from "../schema/index.js";
import { MUT_GEN_CARDS } from "./mut_gen/cards.js";
import { MUT_GEN_ENCOUNTER_SETS } from "./mut_gen/encounterSets.js";
import { MUT_GEN_CYCLE, MUT_GEN_PACK } from "./mut_gen/packs.js";

/**
 * Wave 6 (cycle 6, docs/phase7-wave6.md): `mut_gen` (Mutant Genesis, MC32) card data, pass 1 (cards only). Scenario
 * records, starter decks, the campaign record and the pool wiring are later passes and are not asserted here. The
 * pack is deliberately not wired into `DATA_ONLY_*` or any pool.
 */
describe("wave 6 mut_gen data — card integrity", () => {
  it("every card passes validateCard()", () => {
    const failures = MUT_GEN_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("every card belongs to mut_gen and cycle6, with no duplicate ids", () => {
    for (const c of MUT_GEN_CARDS) {
      expect(c.setCode, c.id as string).toBe("mut_gen");
      expect(c.cycleId, c.id as string).toBe("cycle6");
    }
    const ids = MUT_GEN_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers encounter sets with no duplicate ids, and every card's sets exist", () => {
    const ids = MUT_GEN_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of MUT_GEN_CARDS) {
      const sets = "encounterSetIds" in c ? (c.encounterSetIds as readonly string[] | undefined) : undefined;
      for (const id of sets ?? []) expect(ids, c.id as string).toContain(id);
    }
  });

  it("names the cycle Mutant Genesis and dates the pack 2022-09-30", () => {
    expect(MUT_GEN_PACK.releaseDate).toBe("2022-09-30");
    expect(MUT_GEN_CYCLE.name).toBe("Mutant Genesis");
  });

  it("the three main scheme B sides print dashed target threat (32063b, 32087b) or all dashes (32125b)", () => {
    const stage = (id: string, n: number) =>
      (MUT_GEN_CARDS.find((c) => c.id === id) as MainSchemeCard).stages.find((s) => s.stageNumber === n);
    expect(stage("32063a", 1)?.dashedValues).toEqual(["targetThreat"]);
    expect(stage("32087a", 1)?.dashedValues).toEqual(["targetThreat"]);
    expect(stage("32125a", 1)?.dashedValues).toEqual(["startingThreat", "targetThreat", "acceleration"]);
  });

  it("Mansion Attack's four villains are each two one-stage cards (standard A, expert B)", () => {
    for (const n of [32121, 32122, 32123, 32124]) {
      for (const face of ["a", "b"]) {
        const v = MUT_GEN_CARDS.find((c) => c.id === `${n}${face}`) as VillainCard | undefined;
        expect(v?.type, `${n}${face}`).toBe("villain");
        expect(
          v?.sides.flatMap((s) => s.stages),
          `${n}${face}`,
        ).toHaveLength(1);
      }
    }
  });

  it("curated corrections landed: name, text and attach hosts", () => {
    const byId = (id: string) => MUT_GEN_CARDS.find((c) => c.id === id);
    expect(byId("32174b")?.name).toBe("Reactivate Defenses");
    expect(JSON.stringify(byId("32153"))).toContain("Place 1 magnet counter on the main scheme");
    const attach = (id: string) => (byId(id) as AttachmentCard).attachesTo;
    expect(attach("32077")).toEqual({ kind: "minion" });
    expect(attach("32103")).toEqual({
      kind: "qualified",
      category: "minion",
      trait: "SENTINEL",
      withoutAttachmentNamed: "Energy Barrier",
    });
    expect(attach("32107")).toEqual({ kind: "yourIdentity", withoutAttachmentNamed: "Targeted for Elimination" });
    expect(attach("32170")).toBeUndefined();
  });

  it("errata keep the printed text beside the current text (Mutants at the Mall, Asteroid M)", () => {
    const mall = byIdText("32088a");
    expect(mall.printed).toContain("discarding any other version of Jubilee");
    expect(mall.current).toContain("discarding any other ally version of Jubilee");
    const rock = byIdText("32141a");
    expect(rock.printed).toContain("Reveal that card, then remove 3 magnet counters from this scheme.");
    expect(rock.current).toContain("remove 3 of them and discard cards");
  });
});

function byIdText(id: string): { printed: string; current: string } {
  const card = MUT_GEN_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`no card ${id}`);
  const stack: unknown[] = [card];
  while (stack.length > 0) {
    const x = stack.pop();
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const t = o.text as { printed?: string; current?: string } | undefined;
      if (t && typeof t.printed === "string" && t.printed.includes("Forced Response") && id === "32141a") {
        return { printed: t.printed, current: t.current ?? "" };
      }
      if (t && typeof t.printed === "string" && id === "32088a" && t.printed.includes("Jubilee")) {
        return { printed: t.printed, current: t.current ?? "" };
      }
      stack.push(...Object.values(o));
    }
  }
  throw new Error(`no text for ${id}`);
}

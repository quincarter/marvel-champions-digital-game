import { describe, expect, it } from "vitest";
import {
  validateCampaign,
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateStarterDeck,
} from "../schema/index.js";
import type { AllyCard, AttachmentCard, MainSchemeCard, UpgradeCard, VillainCard } from "../schema/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { MUT_GEN_CAMPAIGN } from "./mut_gen/campaign.js";
import { MUT_GEN_CARDS } from "./mut_gen/cards.js";
import { MUT_GEN_SCENARIOS } from "./mut_gen/scenarios.js";
import { MUT_GEN_STARTER_DECKS } from "./mut_gen/starterDecks.js";
import { MUT_GEN_ENCOUNTER_SETS } from "./mut_gen/encounterSets.js";
import { MUT_GEN_CYCLE, MUT_GEN_PACK } from "./mut_gen/packs.js";

/**
 * Wave 6 (cycle 6, docs/phase7-wave6.md): `mut_gen` (Mutant Genesis, MC32) card data, pass 1 (cards), pass 2 (scenario records,
 * starter decks, `MUT_GEN_CAMPAIGN`). The pool wiring is a later pass and is not asserted here. The
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

describe("wave 6 mut_gen data — scenarios (MC32 pp. 7-19, docs/phase7-wave6.md §2.2)", () => {
  const scenario = (id: string) => {
    const s = MUT_GEN_SCENARIOS.find((x) => x.id === id);
    if (!s) throw new Error(`no scenario ${id}`);
    return s;
  };
  const ids = (xs: readonly unknown[] | undefined) => (xs ?? []).map((x) => x as string);
  const cardIds = new Set(MUT_GEN_CARDS.map((c) => c.id as string));

  it("five scenarios in box order, all in mut_gen, each valid", () => {
    expect(MUT_GEN_SCENARIOS.map((s) => s.id as string)).toEqual([
      "sabretooth",
      "project-wideawake",
      "master-mold",
      "mansion-attack",
      "magneto",
    ]);
    for (const s of MUT_GEN_SCENARIOS) {
      expect(s.packCode as string).toBe("mut_gen");
      expect(validateScenario(s).errors, s.id as string).toEqual([]);
    }
  });

  it("encounter sets validate against Core's and this pack's sets, with Core's Standard and Expert", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...MUT_GEN_ENCOUNTER_SETS];
    for (const s of MUT_GEN_SCENARIOS) {
      expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
      expect(ids(s.standardEncounterSetIds)).toEqual(["standard"]);
      expect(ids(s.expertEncounterSetIds)).toEqual(["expert"]);
    }
  });

  it("every card a scenario names exists", () => {
    for (const s of MUT_GEN_SCENARIOS) {
      const named = [
        s.villainCardId,
        s.mainSchemeCardId,
        ...(s.setAsideVillainCardIds ?? []),
        ...(s.setAsideCardIds ?? []),
        ...(s.expertVillains ? [s.expertVillains.villainCardId, ...s.expertVillains.setAsideVillainCardIds] : []),
      ];
      for (const id of named) expect(cardIds.has(id as string), `${s.id}: ${id}`).toBe(true);
    }
  });

  it("required and modular sets match MC32 (required sets in encounterSetIds, removable ones modular)", () => {
    const shape = (id: string) => [ids(scenario(id).encounterSetIds), ids(scenario(id).recommendedModularSetIds)];
    expect(shape("sabretooth")).toEqual([["sabretooth"], ["brotherhood", "mystique"]]);
    expect(shape("project-wideawake")).toEqual([["project_wideawake", "zero_tolerance"], ["sentinels"]]);
    expect(shape("master-mold")).toEqual([["master_mold", "sentinels"], ["zero_tolerance"]]);
    expect(shape("mansion-attack")).toEqual([["mansion_attack", "brotherhood"], ["mystique"]]);
    expect(shape("magneto")).toEqual([["magneto_villain"], ["acolytes"]]);
    expect(scenario("sabretooth").modularSetCount).toBe(2);
  });

  it("villain and main scheme ids; villain decks I-II standard, II-III expert", () => {
    const pairs: [string, string, string][] = [
      ["sabretooth", "32060", "32063a"],
      ["project-wideawake", "32084", "32087a"],
      ["master-mold", "32109", "32112a"],
      ["mansion-attack", "32121a", "32125a"],
      ["magneto", "32138", "32141a"],
    ];
    for (const [id, villain, scheme] of pairs) {
      expect(scenario(id).villainCardId as string).toBe(villain);
      expect(scenario(id).mainSchemeCardId as string).toBe(scheme);
      expect(scenario(id).villainStages.standard).toEqual(id === "mansion-attack" ? [1, 1] : [1, 2]);
      expect(scenario(id).villainStages.expert).toEqual(id === "mansion-attack" ? [1, 1] : [2, 3]);
    }
  });

  it("Mansion Attack: four one-stage villains, random start, expert (B) villains, win by card ability (§1.4)", () => {
    const m = scenario("mansion-attack");
    expect(ids(m.setAsideVillainCardIds)).toEqual(["32122a", "32123a", "32124a"]);
    expect(m.expertVillains?.villainCardId as string).toBe("32121b");
    expect(ids(m.expertVillains?.setAsideVillainCardIds)).toEqual(["32122b", "32123b", "32124b"]);
    expect(m.startingVillain).toBe("random");
    expect(m.victory).toBe("cardAbility");
    expect(m.victoryCondition).toEqual({ skirmish: 1, standard: 2, expert: 3, heroic: 4 });
    expect(m.multipleVillains).toBeUndefined();
    for (const id of ["32121a", "32121b", "32122a", "32122b", "32123a", "32123b", "32124a", "32124b"]) {
      expect((MUT_GEN_CARDS.find((c) => c.id === id) as VillainCard).sides).toHaveLength(1);
    }
  });

  it("only Master Mold sets aside a non-villain card: the Magneto ally 172B (§1.8)", () => {
    for (const s of MUT_GEN_SCENARIOS) {
      expect(ids(s.setAsideCardIds), s.id as string).toEqual(s.id === "master-mold" ? ["32172b"] : []);
    }
  });
});

describe("wave 6 mut_gen data — starter decks (MC32 p. 22)", () => {
  const cardsById = new Map(MUT_GEN_CARDS.map((c) => [c.id as string, c]));
  const size = (d: (typeof MUT_GEN_STARTER_DECKS)[number]) => d.cards.reduce((n, e) => n + e.quantity, 0);

  it("Colossus / Protection (40) and Shadowcat / Aggression (41), valid and verified", () => {
    expect(MUT_GEN_STARTER_DECKS.map((d) => d.id as string)).toEqual(["colossus-protection", "shadowcat-aggression"]);
    expect(MUT_GEN_STARTER_DECKS.map(size)).toEqual([40, 41]);
    for (const d of MUT_GEN_STARTER_DECKS) {
      expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
      expect(d.provenance.verified).toBe(true);
      expect(d.packCode as string).toBe("mut_gen");
    }
    expect(MUT_GEN_STARTER_DECKS.map((d) => d.identityCardId as string)).toEqual(["32001a", "32030a"]);
    expect(MUT_GEN_STARTER_DECKS.map((d) => d.aspects)).toEqual([["protection"], ["aggression"]]);
  });

  it("each card is in the box at least as many times as the deck lists it", () => {
    for (const d of MUT_GEN_STARTER_DECKS) {
      for (const e of d.cards) {
        const card = cardsById.get(e.cardId as string) as { quantityInSet?: number } | undefined;
        expect(card, e.cardId as string).toBeDefined();
        expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(card?.quantityInSet ?? 0);
      }
    }
  });

  it("Shadowcat's Solid / Phased is one double-sided mass form upgrade, listed once as 32031a (Vision's shape)", () => {
    const solid = cardsById.get("32031a") as UpgradeCard;
    expect(solid.flipSide).toBeDefined();
    expect(solid.keywords).toContainEqual({ name: "form", formType: "mass" });
    expect(solid.keywords).toContainEqual({ name: "permanent" });
    const shadowcat = MUT_GEN_STARTER_DECKS[1]!;
    expect(shadowcat.cards.filter((e) => (e.cardId as string).startsWith("32031"))).toEqual([
      { cardId: "32031a", quantity: 1 },
    ]);
  });
});

describe("wave 6 mut_gen data — MUT_GEN_CAMPAIGN (MC32 pp. 4-5, §1.7)", () => {
  it("passes validateCampaign()", () => {
    const outcome = validateCampaign(MUT_GEN_CAMPAIGN);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("MC32, five registered scenarios in the printed order, all in mut_gen", () => {
    expect(MUT_GEN_CAMPAIGN.boxCode).toBe("MC32");
    expect(MUT_GEN_CAMPAIGN.packCode as string).toBe("mut_gen");
    expect(MUT_GEN_CAMPAIGN.scenarioIds.map((id) => id as string)).toEqual(
      MUT_GEN_SCENARIOS.map((s) => s.id as string),
    );
  });

  it("campaign sets are registered, campaignSpecific, and exclude Future Past; no prohibited, no per-seat sets", () => {
    const byId = new Map(MUT_GEN_ENCOUNTER_SETS.map((s) => [s.id as string, s]));
    expect(MUT_GEN_CAMPAIGN.campaignSetIds.map((id) => id as string)).toEqual([
      "mut_gen_campaign",
      "brawler",
      "commander",
      "defender",
      "peacekeeper",
    ]);
    for (const id of MUT_GEN_CAMPAIGN.campaignSetIds) expect(byId.get(id as string)?.campaignSpecific, id).toBe(true);
    expect(byId.get("future_past")?.campaignSpecific).toBeFalsy();
    expect(MUT_GEN_CAMPAIGN.prohibited).toBeUndefined();
    expect(MUT_GEN_CAMPAIGN.perSeatSetIds).toBeUndefined();
  });

  it("four roles with their MC32 p. 5 aspect pairs, each tied to a campaign set of five upgrades", () => {
    const roles = MUT_GEN_CAMPAIGN.roles ?? [];
    expect(roles.map((r) => [r.id, r.aspects])).toEqual([
      ["brawler", ["aggression", "protection"]],
      ["commander", ["aggression", "leadership"]],
      ["defender", ["justice", "protection"]],
      ["peacekeeper", ["justice", "leadership"]],
    ]);
    for (const r of roles) {
      expect(MUT_GEN_CAMPAIGN.campaignSetIds.map((id) => id as string)).toContain(r.encounterSetId as string);
      const upgrades = MUT_GEN_CARDS.filter(
        (c) => "specificTo" in c && (c as UpgradeCard).specificTo?.encounterSetId === r.encounterSetId,
      );
      expect(upgrades, r.id).toHaveLength(5);
      for (const u of upgrades) {
        expect(u.type, u.id as string).toBe("upgrade");
        expect((u as UpgradeCard).specificTo?.kind, u.id as string).toBe("campaign");
      }
    }
  });

  it("the campaign cards 171-175 are encounter-set cards of mut_gen_campaign, a faces side schemes", () => {
    for (const n of [171, 172, 173, 174, 175]) {
      const a = MUT_GEN_CARDS.find((c) => c.id === `${n + 32000}a`);
      expect(a?.type, `${n}a`).toBe("side_scheme");
      expect((a as { encounterSetIds: readonly unknown[] }).encounterSetIds.map((x) => x as string)).toEqual([
        "mut_gen_campaign",
      ]);
    }
    const logSheet = MUT_GEN_CAMPAIGN.logSheetReference;
    expect(logSheet).toBe("docs/campaign-modes/log-sheets/mc32_mutant_genesis_campaign_log.pdf");
  });
});

describe("wave 6 mut_gen data — spec §1.9 checks against the scans", () => {
  it("Captive allies 32089-32092 cost 2 and carry CAPTIVE; Jubilee 32088b has Victory -1", () => {
    for (const id of ["32089", "32090", "32091", "32092"]) {
      const a = MUT_GEN_CARDS.find((c) => c.id === id) as AllyCard;
      expect(a.cost, id).toBe(2);
      expect(
        a.traits.map((t) => t as string),
        id,
      ).toContain("CAPTIVE");
    }
    const jubilee = MUT_GEN_CARDS.find((c) => c.id === "32088b") as AllyCard;
    expect(jubilee.keywords).toContainEqual({ name: "victory", value: -1 });
  });

  it("Magneto's Fortress 175a prints the crisis icon (not amplify) and three boost icons", () => {
    const f = MUT_GEN_CARDS.find((c) => c.id === "32175a") as unknown as {
      icons: string[];
      amplifyIcons?: number;
      boostIcons: number;
    };
    expect(f.icons).toEqual(["crisis"]);
    expect(f.amplifyIcons).toBeUndefined();
    expect(f.boostIcons).toBe(3);
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

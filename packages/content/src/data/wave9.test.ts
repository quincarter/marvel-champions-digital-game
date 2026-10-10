import { describe, expect, it } from "vitest";
import { validateCard, validateScenario, validateScenarioEncounterSets, validateStarterDeck } from "../schema/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/index.js";
import {
  AOS_CARDS,
  AOS_ENCOUNTER_SETS,
  AOS_SCENARIOS,
  AOS_STARTER_DECKS,
  BP_CARDS,
  BP_STARTER_DECKS,
  CORE_CARDS,
  FALCON_CARDS,
  FALCON_STARTER_DECKS,
  PLAYABLE_CARDS,
  SILK_CARDS,
  SILK_STARTER_DECKS,
  TT_CARDS,
  TT_ENCOUNTER_SETS,
  TT_SCENARIOS,
  TT_STARTER_DECKS,
  WAVE9_CARDS,
  WAVE9_ENCOUNTER_SETS,
  WAVE9_SCENARIOS,
  WAVE9_STARTER_DECKS,
  WINTER_CARDS,
  WINTER_STARTER_DECKS,
} from "./index.js";

/**
 * Wave 9 (cycle 9, docs/phase7-wave9.md): `aos` (Agents of S.H.I.E.L.D., MC50), the four hero packs (`bp`, `silk`,
 * `falcon`, `winter`) and `tt` (Trickster Takeover, MC55). The `aos` Campaign record is a later step, not asserted.
 */
const PACKS = [
  { code: "aos", cards: AOS_CARDS },
  { code: "bp", cards: BP_CARDS },
  { code: "silk", cards: SILK_CARDS },
  { code: "falcon", cards: FALCON_CARDS },
  { code: "winter", cards: WINTER_CARDS },
  { code: "tt", cards: TT_CARDS },
] as const;

const byType = (cards: readonly { type: string }[]) => {
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.type] = (counts[c.type] ?? 0) + 1;
  return counts;
};
const find = (cards: readonly { id: unknown }[], id: string) => cards.find((c) => (c.id as string) === id);

describe("wave 9 data: pool wiring", () => {
  it("WAVE9_CARDS is Core plus the six packs in release order, with no duplicate ids", () => {
    const own = PACKS.reduce((n, p) => n + p.cards.length, 0);
    expect(own).toBe(196 + 42 + 38 + 42 + 37 + 63);
    expect(WAVE9_CARDS).toHaveLength(CORE_CARDS.length + own);
    expect(new Set(WAVE9_CARDS.map((c) => c.id)).size).toBe(WAVE9_CARDS.length);
  });

  it("PLAYABLE_CARDS carries every wave 9 card exactly once", () => {
    const playable = new Set(PLAYABLE_CARDS.map((c) => c.id));
    for (const c of WAVE9_CARDS) expect(playable.has(c.id), c.id as string).toBe(true);
    expect(new Set(PLAYABLE_CARDS.map((c) => c.id)).size).toBe(PLAYABLE_CARDS.length);
  });

  it("every card passes validateCard()", () => {
    const failures = WAVE9_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("every card belongs to its own pack and cycle9", () => {
    for (const p of PACKS)
      for (const c of p.cards) {
        expect(c.setCode as string, c.id as string).toBe(p.code);
        expect(c.cycleId as string, c.id as string).toBe("cycle9");
      }
  });
});

describe("wave 9 data: card counts by type", () => {
  it("aos: 196 cards", () => {
    expect(AOS_CARDS).toHaveLength(196);
    expect(byType(AOS_CARDS)).toEqual({
      hero_identity: 2,
      ally: 15,
      event: 9,
      resource: 5,
      support: 14,
      upgrade: 13,
      obligation: 4,
      minion: 26,
      side_scheme: 22,
      environment: 14,
      treachery: 29,
      villain: 6,
      main_scheme: 5,
      attachment: 23,
      evidence: 9,
    });
  });

  it("bp: 42 cards", () => {
    expect(byType(BP_CARDS)).toEqual({
      hero_identity: 1,
      ally: 6,
      event: 5,
      resource: 4,
      support: 5,
      upgrade: 9,
      player_side_scheme: 3,
      obligation: 1,
      minion: 3,
      side_scheme: 2,
      treachery: 2,
      attachment: 1,
    });
    expect(BP_CARDS).toHaveLength(42);
  });

  it("silk: 38 cards", () => {
    expect(byType(SILK_CARDS)).toEqual({
      hero_identity: 1,
      event: 8,
      player_side_scheme: 1,
      support: 3,
      upgrade: 8,
      ally: 6,
      resource: 3,
      obligation: 1,
      minion: 2,
      side_scheme: 2,
      treachery: 3,
    });
    expect(SILK_CARDS).toHaveLength(38);
  });

  it("falcon: 42 cards", () => {
    expect(byType(FALCON_CARDS)).toEqual({
      hero_identity: 1,
      ally: 8,
      event: 4,
      support: 6,
      upgrade: 9,
      resource: 4,
      obligation: 1,
      minion: 3,
      side_scheme: 2,
      treachery: 2,
      attachment: 2,
    });
    expect(FALCON_CARDS).toHaveLength(42);
  });

  it("winter: 37 cards", () => {
    expect(byType(WINTER_CARDS)).toEqual({
      hero_identity: 1,
      upgrade: 10,
      ally: 5,
      event: 8,
      support: 1,
      resource: 3,
      obligation: 1,
      minion: 3,
      side_scheme: 2,
      attachment: 2,
      treachery: 1,
    });
    expect(WINTER_CARDS).toHaveLength(37);
  });

  it("tt: 63 cards", () => {
    expect(byType(TT_CARDS)).toEqual({
      villain: 6,
      main_scheme: 3,
      side_scheme: 9,
      attachment: 14,
      minion: 16,
      treachery: 7,
      environment: 4,
      ally: 4,
    });
    expect(TT_CARDS).toHaveLength(63);
  });
});

describe("wave 9 data: encounter sets", () => {
  it("31 encounter sets, unique, and every card's sets exist", () => {
    expect(WAVE9_ENCOUNTER_SETS).toHaveLength(31);
    expect(AOS_ENCOUNTER_SETS.length + TT_ENCOUNTER_SETS.length).toBeLessThan(31);
    const known = new Set(WAVE9_ENCOUNTER_SETS.map((s) => s.id as string));
    expect(known.size).toBe(31);
    for (const p of PACKS)
      for (const c of p.cards) {
        const ids = (c as { encounterSetIds?: readonly unknown[] }).encounterSetIds ?? [];
        for (const id of ids) expect(known.has(id as string), `${c.id}: ${String(id)}`).toBe(true);
      }
  });

  it("the nine evidence cards are the Executive Board Evidence set", () => {
    const evidence = AOS_CARDS.filter((c) => c.type === "evidence");
    expect(evidence.map((c) => c.id as string)).toEqual([
      "50185",
      "50186",
      "50187",
      "50188",
      "50189",
      "50190",
      "50191",
      "50192",
      "50193",
    ]);
    for (const c of evidence)
      expect((c as { encounterSetIds?: readonly unknown[] }).encounterSetIds, c.id as string).toEqual([
        "executive_board_evidence",
      ]);
  });
});

describe("wave 9 data: scenarios", () => {
  it("seven scenarios: aos's five in box order, then tt's two", () => {
    expect(WAVE9_SCENARIOS.map((s) => s.id as string)).toEqual([
      "black-widow",
      "batroc",
      "modok",
      "thunderbolts",
      "baron-zemo",
      "enchantress",
      "god-of-lies",
    ]);
    expect(AOS_SCENARIOS).toHaveLength(5);
    expect(TT_SCENARIOS).toHaveLength(2);
    for (const s of AOS_SCENARIOS) expect(s.packCode as string).toBe("aos");
    for (const s of TT_SCENARIOS) expect(s.packCode as string).toBe("tt");
  });

  it("each scenario validates, its sets resolve and the cards it names exist", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...WAVE9_ENCOUNTER_SETS];
    const ids = new Set(WAVE9_CARDS.map((c) => c.id as string));
    for (const s of WAVE9_SCENARIOS) {
      expect(validateScenario(s).errors, s.id as string).toEqual([]);
      expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
      const named = [
        s.villainCardId,
        s.mainSchemeCardId,
        ...(s.setAsideVillainCardIds ?? []),
        ...(s.setAsideCardIds ?? []),
        ...(s.expertVillains ? [s.expertVillains.villainCardId, ...s.expertVillains.setAsideVillainCardIds] : []),
      ];
      for (const id of named) expect(ids.has(id as string), `${s.id}: ${id}`).toBe(true);
    }
  });
});

describe("wave 9 data: starter decks", () => {
  it("six decks, each valid and in its own pack's cards; tt has none", () => {
    expect(TT_STARTER_DECKS).toHaveLength(0);
    expect(WAVE9_STARTER_DECKS.map((d) => [d.id as string, d.packCode as string, d.identityCardId as string])).toEqual([
      ["maria-hill-leadership", "aos", "50001a"],
      ["nick-fury-justice", "aos", "50034a"],
      ["bp-justice", "bp", "51001a"],
      ["silk-protection", "silk", "52001a"],
      ["falcon-leadership", "falcon", "53001a"],
      ["winter-aggression", "winter", "54001a"],
    ]);
    const own: Record<string, readonly { id: unknown }[]> = {
      aos: AOS_CARDS,
      bp: BP_CARDS,
      silk: SILK_CARDS,
      falcon: FALCON_CARDS,
      winter: WINTER_CARDS,
    };
    for (const d of [
      ...AOS_STARTER_DECKS,
      ...BP_STARTER_DECKS,
      ...SILK_STARTER_DECKS,
      ...FALCON_STARTER_DECKS,
      ...WINTER_STARTER_DECKS,
    ]) {
      expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
      for (const e of d.cards)
        expect(find(own[d.packCode as string]!, e.cardId as string), `${d.id}: ${e.cardId}`).toBeDefined();
    }
  });

  it("40 counted cards each; Nick Fury lists 41 entries (his Permanent Assault / Stealth does not count)", () => {
    const size = (d: (typeof WAVE9_STARTER_DECKS)[number]) => d.cards.reduce((n, e) => n + e.quantity, 0);
    expect(WAVE9_STARTER_DECKS.map(size)).toEqual([40, 41, 40, 40, 40, 40]);
  });
});

describe("wave 9 data: RRG 1.8 errata keep the print", () => {
  it("Radiation Exposure (50153): printed -1 SCH, current -1 THW", () => {
    const card = find(AOS_CARDS, "50153") as
      | { errata?: { currentVersion: string }; statModifiers?: unknown }
      | undefined;
    expect(card?.errata?.currentVersion).toBe("RRG 1.8");
    expect(card?.statModifiers).toEqual({ atk: -1, thw: -1 });
  });

  it("MACH-IV (50156): printed 'make basic defenses against', current 'defend against'", () => {
    const card = find(AOS_CARDS, "50156") as { text: { printed: string; current: string } } | undefined;
    expect(card?.text.printed).toContain("cannot make basic defenses against MACH-IV");
    expect(card?.text.current).toContain("cannot defend against MACH-IV");
    expect(card?.text.current).not.toContain("make basic defenses");
  });
});

describe("wave 9 data: printed keyword lines", () => {
  it("Monica Rappaccini (50126): Victory -1 and Vulnerable only; villainous comes from her text", () => {
    const card = find(AOS_CARDS, "50126") as
      | { keywords: unknown; text: { printed: string; current: string } }
      | undefined;
    expect(card?.keywords).toEqual([{ name: "victory", value: -1 }, { name: "vulnerable" }]);
    for (const text of [card?.text.printed, card?.text.current]) {
      expect(text?.startsWith("Victory -1. Vulnerable.")).toBe(true);
      expect(text).toContain("Monica Rappaccini gains villainous.");
    }
  });
});

describe("wave 9 data: scan corrections (docs/phase7-wave9.md section 1.14)", () => {
  it("Black Widow III (50066) has 20 hit points per player (scan)", () => {
    const card = find(AOS_CARDS, "50064") as
      | { sides: readonly { stages: readonly { stageNumber: number; hp: unknown }[] }[] }
      | undefined;
    const stage = card?.sides[0]?.stages.find((s) => s.stageNumber === 3);
    expect(stage?.hp).toEqual({ base: 0, perPlayer: 20 });
  });

  it("Leo Fitz (50056) prints 'search your deck'", () => {
    const card = find(AOS_CARDS, "50056") as { text: { printed: string; current: string } } | undefined;
    for (const text of [card?.text.printed, card?.text.current]) {
      expect(text).toContain("search your deck");
      expect(text).not.toContain("search you deck");
    }
  });

  it("The Douglass (50019) prints 'operation counter' in its Action", () => {
    const card = find(AOS_CARDS, "50019") as { text: { printed: string; current: string } } | undefined;
    for (const text of [card?.text.printed, card?.text.current]) {
      expect(text).toContain("remove 1 operation counter from it");
      expect(text).not.toContain("operational");
    }
  });

  it("Strong Inhuman (50108b) prints Forced Response, like the other Inhuman allies", () => {
    const card = find(AOS_CARDS, "50108b") as { text: { printed: string; current: string } } | undefined;
    for (const text of [card?.text.printed, card?.text.current]) {
      expect(text).toContain("Forced Response: After this card leaves play");
      expect(text).not.toContain("Forced Interrupt");
    }
  });

  it("Disavowed (50180) prints no trait line (the S.H.I.E.L.D. footer is the set name)", () => {
    const card = find(AOS_CARDS, "50180") as { traits: readonly unknown[] } | undefined;
    expect(card?.traits).toEqual([]);
  });

  it("Arrest Warrant (50179) keeps its printed S.H.I.E.L.D. trait", () => {
    const card = find(AOS_CARDS, "50179") as { traits: readonly unknown[] } | undefined;
    expect(card?.traits).toEqual(["S.H.I.E.L.D."]);
  });

  it("the M.O.D.O.K. set title keeps its last period", () => {
    expect(AOS_ENCOUNTER_SETS.find((e) => (e.id as string) === "m.o.d.o.k.")?.name).toBe("M.O.D.O.K.");
  });
});

describe("wave 9 data: Trickster Takeover per-group values (MC55 insert p. 4)", () => {
  it("Worlds Collide (55028a) target threat is 2 per group", () => {
    const card = find(TT_CARDS, "55028a") as { stages?: readonly { targetThreat?: unknown }[] } | undefined;
    const scaled = card?.stages?.map((s) => s.targetThreat).filter((t) => (t as { perGroup?: number }).perGroup);
    expect(scaled).toEqual([{ base: 0, perPlayer: 0, perGroup: 2 }]);
  });

  it("Door Between Worlds (55046) starts with 7 threat per group", () => {
    const card = find(TT_CARDS, "55046") as { startingThreat?: unknown } | undefined;
    expect(card?.startingThreat).toEqual({ base: 0, perPlayer: 0, perGroup: 7 });
  });

  it("The Mangog (55041) has 10 hit points per group", () => {
    const card = find(TT_CARDS, "55041") as { hp?: number; hpPerGroup?: boolean } | undefined;
    expect(card?.hp).toBe(10);
    expect(card?.hpPerGroup).toBe(true);
  });
});

describe("wave 9 data: obligations", () => {
  it.each([
    ["bp", BP_CARDS, "51031", 4, "doubt"],
    ["falcon", FALCON_CARDS, "53029", 3, "emergency"],
  ] as const)(
    "%s: obligation %s carries real Uses and Victory 0 keywords (no scripts exist yet to double-place counters)",
    (_pack, cards, id, count, counterType) => {
      const card = cards.find((c) => c.id === id);
      expect(card?.type).toBe("obligation");
      if (card?.type !== "obligation") return;
      expect(card.keywords).toEqual([
        { name: "uses", count, counterType },
        { name: "victory", value: 0 },
      ]);
    },
  );
});

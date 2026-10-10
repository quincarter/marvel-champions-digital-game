import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCard, validateScenario, validateScenarioEncounterSets, validateStarterDeck } from "../schema/index.js";
import type { AttachmentCard, EvidenceCard, HeroIdentityCard, UpgradeCard } from "../schema/index.js";
import { AOS_CARDS } from "./aos/cards.js";
import { AOS_ENCOUNTER_SETS } from "./aos/encounterSets.js";
import { AOS_CYCLE, AOS_PACK } from "./aos/packs.js";
import { AOS_SCENARIOS } from "./aos/scenarios.js";
import { AOS_STARTER_DECKS } from "./aos/starterDecks.js";
import { BP_ENCOUNTER_SETS } from "./bp/encounterSets.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { FALCON_ENCOUNTER_SETS } from "./falcon/encounterSets.js";
import { SILK_ENCOUNTER_SETS } from "./silk/encounterSets.js";
import { WINTER_ENCOUNTER_SETS } from "./winter/encounterSets.js";

interface RawRecord {
  readonly code: string;
  readonly type_code: string;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/aos.json", import.meta.url), "utf8")) as {
  cards: readonly RawRecord[];
};

const byId = new Map(AOS_CARDS.map((c) => [c.id as string, c]));
const count = (type: string) => AOS_CARDS.filter((c) => c.type === type).length;

describe("aos data (MC50, cycle 9): cards", () => {
  it("is the Agents of S.H.I.E.L.D. pack in cycle 9, released 2025-03-07", () => {
    expect(AOS_CYCLE.name).toBe("Agents of S.H.I.E.L.D.");
    expect(AOS_CYCLE.order).toBe(9);
    expect(AOS_PACK.name).toBe("Agents of S.H.I.E.L.D.");
    expect(AOS_PACK.releaseDate).toBe("2025-03-07");
  });

  it("passes validateCard() on every card, with no duplicate id", () => {
    for (const card of AOS_CARDS) expect(validateCard(card).errors, card.id as string).toEqual([]);
    expect(byId.size).toBe(AOS_CARDS.length);
  });

  it("covers the 195 raw top-level records (b faces and merged villain stages become separate cards or stages)", () => {
    expect(raw.cards.length).toBe(195);
    const rawByType = (prefix: string) => raw.cards.filter((r) => r.type_code.startsWith(prefix)).length;
    expect(rawByType("evidence_")).toBe(9);
    expect(count("evidence")).toBe(9);
    expect(count("hero_identity")).toBe(2);
    expect(count("minion")).toBe(rawByType("minion"));
    expect(count("side_scheme")).toBe(rawByType("side_scheme"));
    expect(count("treachery")).toBe(rawByType("treachery"));
    expect(count("environment")).toBe(rawByType("environment"));
    expect(count("obligation")).toBe(rawByType("obligation"));
    expect(count("event")).toBe(rawByType("event"));
    expect(count("resource")).toBe(rawByType("resource"));
    expect(count("support")).toBe(rawByType("support"));
    expect(count("upgrade")).toBe(rawByType("upgrade"));
    // Three single-card villains become one Black Widow card, the two-faced ones one card each (8 records, 6 cards);
    // nine main scheme records become five cards.
    expect(count("villain")).toBe(6);
    expect(count("main_scheme")).toBe(5);
    expect(AOS_CARDS.length).toBe(196);
  });

  it("emits the nine evidence cards, three per kind, each in the Executive Board Evidence set", () => {
    const evidence = AOS_CARDS.filter((c): c is EvidenceCard => c.type === "evidence");
    expect(evidence.map((c) => c.evidence).sort()).toEqual([
      "means",
      "means",
      "means",
      "motive",
      "motive",
      "motive",
      "opportunity",
      "opportunity",
      "opportunity",
    ]);
    for (const c of evidence) expect(c.encounterSetIds.map(String)).toEqual(["executive_board_evidence"]);
  });

  it("applies the hand corrections", () => {
    // "Attack to Black Widow." is "Attach to Black Widow." on the three Black Widow attachments.
    for (const code of ["50068", "50069", "50070"]) {
      const card = byId.get(code) as AttachmentCard;
      expect(card.text.current, code).not.toContain("Attack to");
      expect(card.attachesTo, code).toBeDefined();
    }
    // Authority prints "Aggression", twice.
    const authority = byId.get("50193") as EvidenceCard;
    expect(authority.text.current).not.toContain("Aggresion");
    expect(authority.text.current.match(/Aggression support/g)?.length).toBe(2);
    // Radiation Exposure: the print has -1 SCH; the RRG 1.8 erratum made it -1 THW (the current modifier is emitted).
    const exposure = byId.get("50153") as AttachmentCard;
    expect(exposure.statModifiers?.thw).toBe(-1);
    expect(exposure.statModifiers?.sch).toBeUndefined();
    expect(exposure.statModifiers?.atk).toBe(-1);
    expect(
      exposure.errata?.history?.some((h) => h.version === "RRG 1.8" && h.changedFields.includes("statModifiers")),
    ).toBe(true);
    // MACH-IV: printed "make basic defenses against", current "defend against" (RRG 1.8).
    const mach = byId.get("50156") as { text: { printed: string; current: string } };
    expect(mach.text.printed).toContain("cannot make basic defenses against MACH-IV's attacks");
    expect(mach.text.current).toContain(
      "Each character without the Aerial trait cannot defend against MACH-IV's attacks.",
    );
    // Batroc's Brigade in the Contents line of 50087a (a main scheme: the text sits on its stage side).
    expect(JSON.stringify(byId.get("50087a"))).toContain("Batroc's Brigade");
    expect(JSON.stringify(byId.get("50087a"))).not.toContain("Batrocs's");
  });

  it("keeps Nick Fury's suit form upgrade Permanent with a dash cost", () => {
    const suit = byId.get("50035a") as UpgradeCard;
    expect(suit.specialCost).toBe("dash");
    expect(suit.keywords.some((k) => k.name === "permanent")).toBe(true);
  });

  it("has Maria Hill and Nick Fury as the two hero identities, with Maria's off-aspect package", () => {
    const heroes = AOS_CARDS.filter((c): c is HeroIdentityCard => c.type === "hero_identity");
    expect(heroes.map((h) => h.id as string).sort()).toEqual(["50001a", "50034a"]);
    const maria = heroes.find((h) => (h.id as string) === "50001a");
    expect(maria?.deckbuilding?.offAspectPackages).toEqual([{ cardType: "support", trait: "S.H.I.E.L.D.", titles: 3 }]);
  });

  it("keeps the dotted encounter-set ids as raw codes, and each is a real set", () => {
    const ids = AOS_ENCOUNTER_SETS.map((s) => s.id as string);
    for (const id of [
      "m.o.d.o.k.",
      "a.i.m._abduction",
      "a.i.m._science",
      "s.h.i.e.l.d.",
      "s.h.i.e.l.d._executive_board",
    ])
      expect(ids).toContain(id);
    // Every card's set id is declared.
    const known = new Set(ids);
    for (const card of AOS_CARDS) {
      if (!("encounterSetIds" in card)) continue;
      for (const id of card.encounterSetIds as readonly string[]) expect(known.has(id), `${card.id}: ${id}`).toBe(true);
    }
    // They survive a JSON round trip (they are plain strings).
    expect(JSON.parse(JSON.stringify(AOS_ENCOUNTER_SETS)).map((s: { id: string }) => s.id)).toEqual(ids);
  });
});

describe("aos data: scenarios (MC50 pp. 9 to 18)", () => {
  it("declares the five scenarios in box order, each valid and resolving its sets", () => {
    expect(AOS_SCENARIOS.map((s) => s.id as string)).toEqual([
      "black-widow",
      "batroc",
      "modok",
      "thunderbolts",
      "baron-zemo",
    ]);
    // The Thunderbolts pool names the four hero packs' Elite, Thunderbolt sets too (MC50 p. 15, 50130a Setup).
    const sets = [
      ...CORE_ENCOUNTER_SETS,
      ...AOS_ENCOUNTER_SETS,
      ...BP_ENCOUNTER_SETS,
      ...SILK_ENCOUNTER_SETS,
      ...FALCON_ENCOUNTER_SETS,
      ...WINTER_ENCOUNTER_SETS,
    ];
    for (const s of AOS_SCENARIOS) {
      expect(s.packCode as string).toBe("aos");
      expect(validateScenario(s).errors, s.id as string).toEqual([]);
      expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
    }
  });

  it("names cards that exist", () => {
    for (const s of AOS_SCENARIOS) {
      const named = [
        s.villainCardId,
        s.mainSchemeCardId,
        ...(s.expertVillains ? [s.expertVillains.villainCardId] : []),
      ];
      for (const id of named) expect(byId.has(id as string), `${s.id}: ${id}`).toBe(true);
    }
  });

  it("Black Widow II/III and the A/B villains: stages per difficulty", () => {
    const stages = Object.fromEntries(AOS_SCENARIOS.map((s) => [s.id as string, s.villainStages]));
    expect(stages["black-widow"]).toEqual({ standard: [1, 2], expert: [2, 3] });
    for (const id of ["batroc", "modok", "thunderbolts"])
      expect(stages[id]).toEqual({ standard: [1, 1], expert: [2, 2] });
    const zemo = AOS_SCENARIOS.find((s) => (s.id as string) === "baron-zemo");
    expect(zemo?.villainCardId as string).toBe("50165a");
    expect(zemo?.expertVillains?.villainCardId as string).toBe("50166a");
  });

  it("Thunderbolts chooses 1 + 1 per hero of the ten Elite Thunderbolt sets", () => {
    const t = AOS_SCENARIOS.find((s) => (s.id as string) === "thunderbolts");
    expect(t?.modularSetCount).toBe(0);
    expect(t?.setAsideModularSetCount).toEqual({ base: 1, perPlayer: 1 });
    expect(t?.modularSetPool?.restricted).toBe(true);
    expect(t?.modularSetPool?.setIds.map(String).sort()).toEqual([
      "extreme_risk",
      "gravitational_pull",
      "growing_strong",
      "hard_sound",
      "pale_little_spider",
      "power_of_the_atom",
      "supersonic",
      "techno",
      "the_leaper",
      "whiteout",
    ]);
  });
});

describe("aos data: starter decks (MC50 p. 7)", () => {
  const size = (d: (typeof AOS_STARTER_DECKS)[number]) => d.cards.reduce((n, e) => n + e.quantity, 0);
  const qty = (d: (typeof AOS_STARTER_DECKS)[number], id: string) =>
    d.cards.find((e) => (e.cardId as string) === id)?.quantity;

  it("Maria Hill / Leadership and Nick Fury / Justice, valid, in aos", () => {
    expect(AOS_STARTER_DECKS.map((d) => d.id as string)).toEqual(["maria-hill-leadership", "nick-fury-justice"]);
    expect(AOS_STARTER_DECKS.map((d) => d.identityCardId as string)).toEqual(["50001a", "50034a"]);
    for (const d of AOS_STARTER_DECKS) {
      expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
      expect(d.packCode as string).toBe("aos");
      expect(d.provenance.verified).toBe(true);
      for (const e of d.cards) expect(byId.has(e.cardId as string), `${d.id}: ${e.cardId}`).toBe(true);
    }
  });

  it("Maria is 40 cards with her three off-aspect supports", () => {
    const maria = AOS_STARTER_DECKS[0]!;
    expect(size(maria)).toBe(40);
    for (const id of ["50018", "50019", "50020"]) expect(qty(maria, id)).toBe(1);
  });

  it("Nick is 40 cards plus Assault / Stealth, his Permanent suit form that starts in play", () => {
    const nick = AOS_STARTER_DECKS[1]!;
    expect(size(nick)).toBe(41);
    expect(qty(nick, "50035a")).toBe(1);
    expect(size(nick) - (qty(nick, "50035a") ?? 0)).toBe(40);
  });
});

describe("aos data: the S.H.I.E.L.D. Executive Board set (MC50 p. 6)", () => {
  const board = AOS_ENCOUNTER_SETS.find((set) => (set.id as string) === "s.h.i.e.l.d._executive_board");

  it("is an extra, uncounted modular set", () => {
    expect(board?.extraModular).toBe(true);
    expect(board?.classification).toBeUndefined();
    expect(board?.campaignSpecific).toBeUndefined();
  });

  it("is the only extra set of the pack, and Executive Board Evidence is not one", () => {
    const extras = AOS_ENCOUNTER_SETS.filter((set) => set.extraModular).map((set) => set.id as string);
    expect(extras).toEqual(["s.h.i.e.l.d._executive_board"]);
  });

  it("stays a required set of the Baron Zemo scenario (MC50 p. 18) and is no recommended modular set", () => {
    const zemo = AOS_SCENARIOS.find((scenario) => (scenario.id as string) === "baron-zemo");
    expect(zemo?.encounterSetIds.map(String)).toContain("s.h.i.e.l.d._executive_board");
    for (const scenario of AOS_SCENARIOS)
      expect(scenario.recommendedModularSetIds.map(String)).not.toContain("s.h.i.e.l.d._executive_board");
  });
});

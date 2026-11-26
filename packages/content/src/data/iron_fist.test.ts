import { describe, expect, it } from "vitest";
import { validateCard } from "../schema/index.js";
import type { AnyCard, HeroIdentityCard } from "../schema/index.js";
import { IRON_FIST_CARDS } from "./iron_fist/cards.js";
import { IRON_FIST_ENCOUNTER_SETS } from "./iron_fist/encounterSets.js";
import { IRON_FIST_CYCLE, IRON_FIST_PACK } from "./iron_fist/packs.js";
import { IRON_FIST_PROVENANCE } from "./iron_fist/provenance.js";
import { IRON_FIST_STARTER_DECKS } from "./iron_fist/starterDecks.js";
import { PLAYABLE_CARDS } from "./index.js";
import { readFileSync } from "node:fs";

/**
 * Iron Fist (`iron_fist`, cycle 11, MC64): MarvelCDB-sourced (raw/marvelcdb/iron_fist.json) with the corrections of
 * scripts/marvelcdb/curation/iron_fist.ts, checked against the official card images (identity faces, 64013, 64014, 64021,
 * 64026 to 64029, 64032). It replaced a hand transcription whose obligation and nemesis set used the placeholder codes
 * 64034 to 64037; those are the real 64026 to 64029.
 */
const byId = new Map(IRON_FIST_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const notes = (id: string) => IRON_FIST_PROVENANCE.find((p) => p.cardId === id)!.corrections.join(" | ");
const keywords = (id: string) => (get(id) as unknown as { keywords: unknown[] }).keywords;

describe("iron_fist: the pack", () => {
  it("is in cycle 11 and carries MarvelCDB's release date", () => {
    expect(IRON_FIST_CYCLE).toEqual({ id: "cycle11", name: "Fear No Evil", order: 11 });
    expect(IRON_FIST_PACK.releaseDate).toBe("2026-11-13");
  });

  it("is 33 records, counted by type, with the protection starter deck and one nemesis set", () => {
    expect(IRON_FIST_CARDS).toHaveLength(33);
    const counts: Record<string, number> = {};
    for (const c of IRON_FIST_CARDS) counts[c.type] = (counts[c.type] ?? 0) + 1;
    expect(counts).toEqual({
      hero_identity: 1,
      event: 9,
      support: 3,
      upgrade: 11,
      ally: 4,
      resource: 1,
      obligation: 1,
      minion: 2,
      side_scheme: 1,
    });
    expect(IRON_FIST_ENCOUNTER_SETS.map((s) => s.id as string)).toEqual(["iron_fist_nemesis"]);
    expect(IRON_FIST_STARTER_DECKS).toHaveLength(1);
    const deck = IRON_FIST_STARTER_DECKS[0]!;
    expect(deck.provenance.verified).toBe(false);
    expect(deck.identityCardId as string).toBe("64001a");
    expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    for (const { cardId, quantity } of deck.cards)
      expect(quantity, cardId as string).toBeLessThanOrEqual(
        (get(cardId as string) as unknown as { quantityInSet: number }).quantityInSet,
      );
  });

  it("every card has its bundled art wired, and the raw cache has the 33 MarvelCDB records", () => {
    for (const c of IRON_FIST_CARDS)
      expect((c as unknown as { images?: unknown }).images, c.id as string).toBeDefined();
    const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/iron_fist.json", import.meta.url), "utf8")) as {
      cards: unknown[];
    };
    expect(raw.cards).toHaveLength(33);
  });

  it("every card is iron_fist's own, carries cycle11 and passes validateCard()", () => {
    for (const c of IRON_FIST_CARDS) {
      expect(c.setCode as string, c.id as string).toBe("iron_fist");
      expect(c.cycleId as string, c.id as string).toBe("cycle11");
      expect(validateCard(c).errors, c.id as string).toEqual([]);
    }
  });

  it("every card has a provenance entry", () => {
    const covered = new Set(IRON_FIST_PROVENANCE.map((p) => p.cardId as string));
    for (const c of IRON_FIST_CARDS) expect(covered.has(c.id as string), c.id as string).toBe(true);
  });
});

describe("iron_fist: the identity", () => {
  const identity = get<HeroIdentityCard>("64001a");

  it("Iron Fist 1 / 2 / 2, 10 HP, hand 5; Danny Rand REC 4, hand 6", () => {
    expect([identity.hero.thw, identity.hero.atk, identity.hero.def, identity.hp]).toEqual([1, 2, 2, 10]);
    expect([identity.hero.handSize, identity.alterEgo.handSize, identity.alterEgo.rec]).toEqual([5, 6, 4]);
    expect(identity.hero.text.printed).toContain("place 1 chi counter here");
    expect(identity.alterEgo.text.printed).toContain("Your Technique cards lose temporary.");
  });

  it("links Lack of Chi and the nemesis set", () => {
    expect(identity.obligationCardId as string).toBe("64026");
    expect(identity.nemesisEncounterSetId as string).toBe("iron_fist_nemesis");
  });
});

describe("iron_fist: keywords and corrections", () => {
  it("the Techniques are Temporary; Helpful Bystander is Vulnerable with dash THW and ATK", () => {
    for (const id of ["64008", "64010", "64012"]) expect(keywords(id), id).toEqual([{ name: "temporary" }]);
    expect(keywords("64013")).toEqual([{ name: "vulnerable" }]);
    const bystander = get("64013") as unknown as {
      hp: number;
      atk: unknown;
      thw: unknown;
      consequentialDamage: unknown;
    };
    expect([bystander.hp, bystander.atk, bystander.thw]).toEqual([1, null, null]);
    // MarvelCDB sends no thwart_cost/attack_cost for the dashes; its star flags are cleared (clearStarFlags).
    expect(bystander.consequentialDamage).toEqual({ attack: 0, thwart: 0 });
    expect((bystander as { statStars?: unknown }).statStars).toBeUndefined();
    expect(notes("64013")).toContain("dash");
  });

  it("No Time to Bleed has Discount 1 (Martial Artist or Soldier), Temporary, Max 1 per player", () => {
    const card = get("64019") as unknown as {
      keywords: { name: string; traits?: string[] }[];
      playRestrictions: unknown;
      cost: number;
    };
    expect(card.keywords.map((k) => k.name)).toEqual(["discount", "temporary"]);
    expect(card.keywords[0]!.traits).toEqual(["MARTIAL ARTIST", "SOLDIER"]);
    expect(card.playRestrictions).toEqual({ maxPerPlayer: 1 });
    expect(card.cost).toBe(2);
  });

  it("quantities are MarvelCDB's: three of each aspect card and The Defenders", () => {
    const q = (id: string) => (get(id) as unknown as { quantityInSet: number }).quantityInSet;
    expect([q("64002"), q("64004"), q("64005")]).toEqual([3, 2, 2]);
    for (const id of ["64015", "64016", "64018", "64019", "64020", "64023", "64030", "64031", "64032", "64033"])
      expect(q(id), id).toBe(3);
    expect([q("64013"), q("64014"), q("64024"), q("64025")]).toEqual([1, 1, 1, 1]);
  });

  it("the printed consequential-damage icon is kept in Iron Fist (ally), Colleen Wing and Sensei", () => {
    for (const id of ["64014", "64021", "64032"]) {
      const card = get(id) as unknown as { text: { printed: string; current: string } };
      expect(card.text.printed, id).toContain("consequential damage ([cost])");
      expect(card.text.current, id).toBe(card.text.printed);
      expect(notes(id), id).toContain("consequential-damage icon");
    }
  });

  it("the obligation and nemesis set carry the printed codes, stats and art", () => {
    expect(byId.has("64034") || byId.has("64035") || byId.has("64036") || byId.has("64037")).toBe(false);
    const lack = get("64026") as unknown as { type: string; boostIcons: number; text: { printed: string } };
    expect([lack.type, lack.boostIcons]).toEqual(["obligation", 2]);
    expect(lack.text.printed).toContain("If there are at least 4 chi counters here, discard this card.");
    const davos = get("64027") as unknown as {
      atk: number;
      sch: number;
      hp: number;
      traits: string[];
      unique: boolean;
      nemesisMinion: boolean;
    };
    expect([davos.atk, davos.sch, davos.hp, davos.traits, davos.unique, davos.nemesisMinion]).toEqual([
      2,
      1,
      5,
      ["K'UN-LUN", "MARTIAL ARTIST"],
      true,
      true,
    ]);
    const daughter = get("64028") as unknown as {
      atk: number;
      sch: number;
      hp: number;
      quantityInSet: number;
      starIcon: boolean;
      boostIcons: number;
      keywords: unknown[];
    };
    expect([
      daughter.atk,
      daughter.sch,
      daughter.hp,
      daughter.quantityInSet,
      daughter.starIcon,
      daughter.boostIcons,
    ]).toEqual([2, 2, 3, 3, true, 2]);
    expect(daughter.keywords).toEqual([{ name: "vulnerable" }]);
    const serpent = get("64029") as unknown as { startingThreat: unknown; icons: string[]; boostIcons: number };
    expect([serpent.startingThreat, serpent.icons, serpent.boostIcons]).toEqual([
      { base: 0, perPlayer: 4 },
      ["acceleration"],
      2,
    ]);
  });
});

describe("iron_fist: signature aspects, reprints and keywords", () => {
  it("the signature cards carry the hero:64001a aspect", () => {
    for (const id of [
      "64002",
      "64003",
      "64004",
      "64005",
      "64006",
      "64007",
      "64008",
      "64009",
      "64010",
      "64011",
      "64012",
    ]) {
      expect((get(id) as unknown as { aspect: string }).aspect, id).toBe("hero:64001a");
    }
  });

  it("Team-Up names on Power Man and Iron Fist (64024) and Restricted on Tonfa (64020)", () => {
    expect(keywords("64024")).toEqual([{ name: "teamUp", names: ["Iron Fist", "Luke Cage"] }]);
    expect(keywords("64020")).toEqual([{ name: "restricted" }]);
  });

  it("verbatim reprints are recorded: 64024 of luke_cage 62023, 64015 of vision 26018, 64017 of drs 09019", () => {
    const dup = (id: string) =>
      IRON_FIST_PROVENANCE.find((p) => (p.cardId as string) === id)?.duplicateOfCardId as string | undefined;
    expect([dup("64024"), dup("64015"), dup("64017")]).toEqual(["62023", "26018", "09019"]);
  });

  it("the new Techniques are Temporary; Sensei has Discount 2 and Death by a Thousand Cuts Discount 1", () => {
    for (const id of ["64009", "64011"]) expect(keywords(id), id).toEqual([{ name: "temporary" }]);
    expect(keywords("64032")[0]).toMatchObject({ name: "discount", value: 2 });
    expect(keywords("64030")[0]).toMatchObject({ name: "discount", value: 1 });
  });

  it("the allies record their printed consequential damage", () => {
    const cd = (id: string) => (get(id) as unknown as { consequentialDamage: unknown }).consequentialDamage;
    expect(cd("64014")).toEqual({ attack: 2, thwart: 1 });
    expect(cd("64021")).toEqual({ attack: 1, thwart: 1 });
    expect(cd("64022")).toEqual({ attack: 1, thwart: 1 });
  });
});

describe("iron_fist: pool wiring", () => {
  it("PLAYABLE_CARDS carries each iron_fist card once", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id as string);
    for (const c of IRON_FIST_CARDS) expect(ids.filter((i) => i === (c.id as string))).toHaveLength(1);
  });
});

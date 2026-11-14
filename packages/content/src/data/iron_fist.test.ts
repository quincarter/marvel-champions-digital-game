import { describe, expect, it } from "vitest";
import { validateCard } from "../schema/index.js";
import type { AnyCard, HeroIdentityCard } from "../schema/index.js";
import { IRON_FIST_CARDS } from "./iron_fist/cards.js";
import { IRON_FIST_ENCOUNTER_SETS } from "./iron_fist/encounterSets.js";
import { IRON_FIST_CYCLE, IRON_FIST_PACK } from "./iron_fist/packs.js";
import { IRON_FIST_PROVENANCE } from "./iron_fist/provenance.js";
import { IRON_FIST_STARTER_DECKS } from "./iron_fist/starterDecks.js";
import { PLAYABLE_CARDS } from "./index.js";

/**
 * Iron Fist (`iron_fist`, cycle 11, MC64): a scan-only pack hand-transcribed from the Hall of Heroes page and the FFG
 * article "Way of the Iron Fist" (scripts/marvelcdb/curation/iron_fist.ts). The obligation 64034 and Davos 64035 come from a gameplay video;
 * Steel Serpent 64036 and Crane Daughter 64037 (the least certain) come from an unofficial fan preview. All carry PLACEHOLDER provenance.
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
  it("is in cycle 11 and carries the November 2026 stand-in date", () => {
    expect(IRON_FIST_CYCLE).toEqual({ id: "cycle11", name: "Fear No Evil", order: 11 });
    expect(IRON_FIST_PACK.releaseDate).toBe("2026-11-01");
  });

  it("is 33 records, counted by type, with no starter deck and one nemesis set", () => {
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
    expect(IRON_FIST_STARTER_DECKS).toEqual([]);
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

  it("links the provisional obligation and nemesis set", () => {
    expect(identity.obligationCardId as string).toBe("64034");
    expect(identity.nemesisEncounterSetId as string).toBe("iron_fist_nemesis");
  });
});

describe("iron_fist: keywords and transcription decisions", () => {
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
    expect(bystander.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
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

  it("quantities read from set positions are recorded as data decisions", () => {
    const q = (id: string) => (get(id) as unknown as { quantityInSet: number }).quantityInSet;
    expect([q("64002"), q("64004"), q("64005")]).toEqual([3, 2, 2]);
    for (const id of ["64002", "64004", "64005"]) expect(notes(id), id).toContain("Data decision");
  });

  it("the video-only cards are PLACEHOLDER and have no art; Davos records only K'un-Lun", () => {
    for (const id of ["64034", "64035", "64036", "64037"]) {
      expect(notes(id), id).toContain("PLACEHOLDER");
      expect((get(id) as unknown as { images?: unknown }).images, id).toBeUndefined();
    }
    expect(notes("64034")).toContain("unverified");
    expect(notes("64035")).toContain("K'un-Lun");
    const davos = get("64035") as unknown as { atk: number; sch: number; hp: number; traits: string[] };
    expect([davos.atk, davos.sch, davos.hp, davos.traits]).toEqual([2, 1, 5, ["K'UN-LUN"]]);
    expect((get("64037") as unknown as { quantityInSet: number }).quantityInSet).toBe(3);
    expect(notes("64037")).toContain("LEAST CERTAIN");
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

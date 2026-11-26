import { describe, expect, it } from "vitest";
import { validateCard } from "../schema/index.js";
import type { AnyCard, HeroIdentityCard } from "../schema/index.js";
import { ELEKTRA_CARDS } from "./elektra/cards.js";
import { ELEKTRA_ENCOUNTER_SETS } from "./elektra/encounterSets.js";
import { ELEKTRA_CYCLE, ELEKTRA_PACK } from "./elektra/packs.js";
import { ELEKTRA_PROVENANCE } from "./elektra/provenance.js";
import { ELEKTRA_STARTER_DECKS } from "./elektra/starterDecks.js";
import { IRON_FIST_CARDS } from "./iron_fist/cards.js";
import { JJ_CARDS } from "./jj/cards.js";
import { LUKE_CAGE_CARDS } from "./luke_cage/cards.js";
import { SHADOWLAND_CARDS } from "./shadowland/cards.js";
import { CORE_CARDS, FNE_CARDS, PLAYABLE_CARDS, WAVE11_CARDS } from "./index.js";

/**
 * Elektra (`elektra`, cycle 11, MC63): ingested from MarvelCDB's pack (raw/marvelcdb/elektra.json, 39 records) with
 * two corrections checked against the official card images (scripts/marvelcdb/curation/elektra.ts). It started as a
 * hand-transcribed scan-only pack with placeholder codes 63040 to 63045; the obligation is now 63028 and the nemesis
 * set 63029 to 63033.
 */
const byId = new Map(ELEKTRA_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};

describe("elektra: the pack", () => {
  it("is in cycle 11 and carries the November 13, 2026 release date", () => {
    expect(ELEKTRA_CYCLE).toEqual({ id: "cycle11", name: "Fear No Evil", order: 11 });
    expect(ELEKTRA_PACK.releaseDate).toBe("2026-11-13");
    expect(ELEKTRA_PACK.cycleId as string).toBe("cycle11");
  });

  it("is 39 records, counted by type, with one starter deck and one nemesis set", () => {
    expect(ELEKTRA_CARDS).toHaveLength(39);
    const counts: Record<string, number> = {};
    for (const c of ELEKTRA_CARDS) counts[c.type] = (counts[c.type] ?? 0) + 1;
    expect(counts).toEqual({
      hero_identity: 1,
      treachery: 6,
      ally: 6,
      event: 8,
      support: 2,
      upgrade: 6,
      resource: 3,
      player_side_scheme: 1,
      obligation: 1,
      minion: 3,
      side_scheme: 1,
      attachment: 1,
    });
    expect(ELEKTRA_ENCOUNTER_SETS.map((s) => s.id as string)).toEqual(["elektra_nemesis"]);
    expect(ELEKTRA_STARTER_DECKS).toHaveLength(1);
    const deck = ELEKTRA_STARTER_DECKS[0]!;
    expect(deck.provenance.verified).toBe(false);
    expect(deck.identityCardId as string).toBe("63001a");
    expect(deck.cards.reduce((a, c) => a + c.quantity, 0)).toBe(40);
  });

  it("every card is elektra's own, carries cycle11 and passes validateCard()", () => {
    for (const c of ELEKTRA_CARDS) {
      expect(c.setCode as string, c.id as string).toBe("elektra");
      expect(c.cycleId as string, c.id as string).toBe("cycle11");
      expect(validateCard(c).errors, c.id as string).toEqual([]);
    }
  });

  it("every card has a provenance entry", () => {
    const covered = new Set(ELEKTRA_PROVENANCE.map((p) => p.cardId as string));
    for (const c of ELEKTRA_CARDS) expect(covered.has(c.id as string), c.id as string).toBe(true);
  });
});

describe("elektra: the identity and the NINJA deck", () => {
  const identity = get<HeroIdentityCard>("63001a");

  it("Elektra is Villainous with starred stats; her alter-ego starts with the NINJA deck", () => {
    expect(identity.hero.keywords).toEqual([{ name: "villainous" }]);
    expect([identity.hero.thw, identity.hero.atk, identity.hero.def, identity.hp]).toEqual([0, 1, 1, 9]);
    expect([identity.hero.handSize, identity.alterEgo.handSize, identity.alterEgo.rec]).toEqual([5, 6, 3]);
    expect(identity.alterEgo.text.printed).toContain("begins the game with a Ninja deck");
  });

  it("links the obligation and nemesis set", () => {
    expect(identity.obligationCardId as string).toBe("63028");
    expect(identity.nemesisEncounterSetId as string).toBe("elektra_nemesis");
  });

  it("the NINJA deck is a facedown encounter-family separate deck of 2 + 2 + 2, like Hercules's Labor deck", () => {
    expect(identity.separateDecks).toEqual([
      {
        name: "Ninja",
        cards: [
          { cardId: "63002", quantity: 2 },
          { cardId: "63003", quantity: 2 },
          { cardId: "63004", quantity: 2 },
        ],
        topCardFaceup: false,
        discardPile: "none",
        whenEmpty: "stayEmpty",
        cardFamily: "encounter",
      },
    ]);
    for (const id of ["63002", "63003", "63004"]) {
      const card = get(id) as unknown as {
        type: string;
        separateDeck?: string;
        encounterSetIds: string[];
        starIcon?: boolean;
        keywords: unknown;
      };
      expect(card.type, id).toBe("treachery");
      expect(card.separateDeck, id).toBe("Ninja");
      expect(card.encounterSetIds, id).toEqual([]);
      expect(card.starIcon, id).toBe(true);
      expect(card.keywords, id).toEqual([{ name: "surge" }]);
    }
  });
});

describe("elektra: keywords and transcription decisions", () => {
  it("Black Cat is Villainous; Nerve Strike has Discount 1 and cost 3; Flow of Battle has a trait prerequisite", () => {
    const keywords = (id: string) => (get(id) as unknown as { keywords: unknown[] }).keywords;
    expect(keywords("63016")).toEqual([{ name: "villainous" }]);
    expect(keywords("63019")).toMatchObject([{ name: "discount", value: 1 }]);
    expect((get("63019") as unknown as { cost: number }).cost).toBe(3);
    expect(keywords("63020")).toMatchObject([{ name: "prerequisite" }]);
    expect(keywords("63013")).toEqual([{ name: "prerequisite", form: "hero" }]);
  });

  it("History with the Hand and Dance with the Devil carry the amplify icon as an icon, not as text (as fne 60031)", () => {
    for (const id of ["63013", "63027"]) {
      const card = get(id) as unknown as {
        amplifyIcons?: number;
        text: { printed: string };
        abilities: { id: string }[];
      };
      expect(card.amplifyIcons, id).toBe(1);
      expect(card.text.printed, id).not.toContain("[amplify]");
      expect(
        card.abilities.map((a) => a.id),
        id,
      ).not.toContain(`${id}.${id === "63013" ? "history-with-the-hand" : "dance-with-the-devil"}-constant-2`);
      if (id === "63027") expect(card.abilities.map((a) => a.id)).toEqual(["63027.dance-with-the-devil-action"]);
    }
  });

  it("Dance with the Devil (63027) is recorded as a verbatim reprint of fne 60031", () => {
    const dance = ELEKTRA_PROVENANCE.find((p) => (p.cardId as string) === "63027");
    expect(dance?.duplicateOfCardId as string | undefined).toBe("60031");
  });

  it("Aka and Hand Archer have Quickstrike; Hand Archer's Ranged is a starred constant ability, not a keyword", () => {
    expect((get("63029") as unknown as { keywords: unknown[] }).keywords).toEqual([{ name: "quickstrike" }]);
    const archer = get("63033") as unknown as { keywords: { name: string }[]; text: { printed: string } };
    expect(archer.keywords.map((k) => k.name)).toEqual(["quickstrike"]);
    expect(archer.text.printed).toContain("Hand Archer's attacks gain ranged");
  });

  it("the signature cards carry the hero:63001a aspect; Team-Up names and Restricted are keywords", () => {
    for (const id of ["63005", "63006", "63007", "63008", "63009", "63010", "63011", "63012", "63013", "63014"]) {
      expect((get(id) as unknown as { aspect: string }).aspect, id).toBe("hero:63001a");
    }
    expect((get("63027") as unknown as { keywords: unknown[] }).keywords).toEqual([
      { name: "teamUp", names: ["Daredevil", "Elektra"] },
    ]);
    expect((get("63012") as unknown as { keywords: unknown[] }).keywords).toEqual([{ name: "restricted" }]);
  });

  it("the allies record their printed consequential damage", () => {
    const cd = (id: string) => (get(id) as unknown as { consequentialDamage: unknown }).consequentialDamage;
    expect(cd("63005")).toEqual({ attack: 1, thwart: 1 });
    expect(cd("63022")).toEqual({ attack: 2, thwart: 1 });
    expect(cd("63039")).toEqual({ attack: 2, thwart: 2 });
  });

  it("Double-Cross is a justice player side scheme (2 per player) and its three treacheries are Linked to it, in no encounter set", () => {
    const dc = get("63034") as unknown as { type: string; aspect: string; startingThreat: unknown };
    expect([dc.type, dc.aspect, dc.startingThreat]).toEqual([
      "player_side_scheme",
      "justice",
      { base: 0, perPlayer: 2 },
    ]);
    for (const id of ["63035", "63036", "63037"]) {
      const card = get(id) as unknown as {
        type: string;
        encounterSetIds: string[];
        keywords: unknown[];
        starIcon?: boolean;
      };
      expect(card.type, id).toBe("treachery");
      expect(card.encounterSetIds, id).toEqual([]);
      expect(card.keywords, id).toEqual([{ name: "linked", cardTitle: "Double-Cross" }]);
      expect(card.starIcon, id).toBe(true);
    }
  });

  it("quantities come from MarvelCDB: the kit as inferred before, aspect cards in threes, Stone and the allies single", () => {
    const q = (id: string) => (get(id) as unknown as { quantityInSet: number }).quantityInSet;
    expect([q("63006"), q("63007"), q("63008"), q("63009"), q("63012"), q("63013")]).toEqual([2, 2, 2, 2, 2, 1]);
    expect(["63017", "63018", "63019", "63020", "63021", "63023"].map(q)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(["63015", "63016", "63022", "63024", "63025", "63026", "63027"].map(q)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it("Moondragon's printed consequential damage icon is restored in her text", () => {
    const text = (get("63038") as unknown as { text: { printed: string; current: string } }).text;
    expect(text.printed).toContain("consequential damage ([cost]) for this use");
    expect(text.current).toBe(text.printed);
  });
});

describe("elektra: the obligation and nemesis set (official card images)", () => {
  it("the obligation 63028 is Conditioned by the Hand with 2 boost icons, in no encounter set", () => {
    const o = get("63028") as unknown as { type: string; boostIcons: number; encounterSetIds: string[] };
    expect([o.type, o.boostIcons, o.encounterSetIds]).toEqual(["obligation", 2, []]);
  });

  it("Aka is the nemesis minion: SCH 2 / ATK 2 / HP 4, star boost", () => {
    const aka = get("63029") as unknown as {
      atk: number;
      sch: number;
      hp: number;
      nemesisMinion?: boolean;
      starIcon?: boolean;
      traits: string[];
    };
    expect([aka.atk, aka.sch, aka.hp, aka.nemesisMinion, aka.starIcon]).toEqual([2, 2, 4, true, true]);
    expect(aka.traits).toEqual(["HAND", "NINJA"]);
  });

  it("The Fist Fits in the Hand is 3 per hero with a hazard icon and 3 boost icons", () => {
    const s = get("63030") as unknown as { icons: string[]; boostIcons: number; startingThreat: unknown };
    expect(s.icons).toEqual(["hazard"]);
    expect(s.boostIcons).toBe(3);
    expect(s.startingThreat).toEqual({ base: 0, perPlayer: 3 });
  });

  it("Hand Katana is a Weapon attachment: +2 ATK, 2 boost icons, goes to the Hand minion with the highest base HP", () => {
    const k = get("63031") as unknown as {
      type: string;
      statModifiers: unknown;
      boostIcons: number;
      attachesTo: { kind: string };
      encounterSetIds: string[];
    };
    expect([k.type, k.statModifiers, k.boostIcons, k.attachesTo.kind, k.encounterSetIds]).toEqual([
      "attachment",
      { atk: 2 },
      2,
      "ifAble",
      ["elektra_nemesis"],
    ]);
  });

  it("Hand Blademaster and Hand Archer are SCH 1 / ATK 1 / HP 3 with 1 boost icon and the printed stat stars", () => {
    const m = (id: string) =>
      get(id) as unknown as {
        atk: number;
        sch: number;
        hp: number;
        boostIcons: number;
        statStars?: string[];
        traits: string[];
      };
    for (const id of ["63032", "63033"]) {
      expect([m(id).atk, m(id).sch, m(id).hp, m(id).boostIcons], id).toEqual([1, 1, 3, 1]);
      expect(m(id).traits, id).toEqual(["HAND", "NINJA"]);
    }
    expect(m("63032").statStars).toEqual(["atk", "sch"]);
    expect(m("63033").statStars).toEqual(["atk"]);
  });

  it("every card has official art wired, but the three basic resource reprints", () => {
    for (const c of ELEKTRA_CARDS) {
      if (["63024", "63025", "63026"].includes(c.id as string)) continue;
      expect((c as unknown as { images?: unknown }).images, c.id as string).toBeDefined();
    }
  });
});

describe("elektra: wave 11 pool wiring", () => {
  it("WAVE11_CARDS lists elektra after shadowland and before iron_fist, with no duplicate ids", () => {
    const start =
      CORE_CARDS.length + FNE_CARDS.length + JJ_CARDS.length + LUKE_CAGE_CARDS.length + SHADOWLAND_CARDS.length;
    expect(WAVE11_CARDS.slice(start, start + ELEKTRA_CARDS.length)).toEqual(ELEKTRA_CARDS);
    expect(WAVE11_CARDS.slice(start + ELEKTRA_CARDS.length)).toEqual(IRON_FIST_CARDS);
    expect(new Set(WAVE11_CARDS.map((c) => c.id)).size).toBe(WAVE11_CARDS.length);
  });

  it("PLAYABLE_CARDS carries each elektra card once", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of ELEKTRA_CARDS) expect(ids.filter((i) => i === (c.id as string))).toHaveLength(1);
  });
});

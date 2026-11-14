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
 * Elektra (`elektra`, cycle 11, MC63): a scan-only pack hand-transcribed from the Hall of Heroes page and the FFG
 * article "Killer Instinct" (scripts/marvelcdb/curation/elektra.ts). The obligation 63040 and nemesis minion Aka 63041
 * come from a gameplay video and carry PLACEHOLDER provenance.
 */
const byId = new Map(ELEKTRA_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const notes = (id: string) => ELEKTRA_PROVENANCE.find((p) => p.cardId === id)!.corrections.join(" | ");

describe("elektra: the pack", () => {
  it("is in cycle 11 and carries the November 2026 stand-in date", () => {
    expect(ELEKTRA_CYCLE).toEqual({ id: "cycle11", name: "Fear No Evil", order: 11 });
    expect(ELEKTRA_PACK.releaseDate).toBe("2026-11-01");
    expect(ELEKTRA_PACK.cycleId as string).toBe("cycle11");
  });

  it("is 35 records, counted by type, with no starter deck and one nemesis set", () => {
    expect(ELEKTRA_CARDS).toHaveLength(35);
    const counts: Record<string, number> = {};
    for (const c of ELEKTRA_CARDS) counts[c.type] = (counts[c.type] ?? 0) + 1;
    expect(counts).toEqual({
      hero_identity: 1,
      treachery: 6,
      ally: 6,
      event: 8,
      support: 2,
      upgrade: 6,
      player_side_scheme: 1,
      obligation: 1,
      minion: 3,
      side_scheme: 1,
    });
    expect(ELEKTRA_ENCOUNTER_SETS.map((s) => s.id as string)).toEqual(["elektra_nemesis"]);
    expect(ELEKTRA_STARTER_DECKS).toEqual([]);
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

  it("links the provisional obligation and nemesis set", () => {
    expect(identity.obligationCardId as string).toBe("63040");
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
    expect(notes("63002")).toContain("inferred");
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

  it("Aka has Quickstrike; Hand Archer has Quickstrike and Ranged", () => {
    expect((get("63041") as unknown as { keywords: unknown[] }).keywords).toEqual([{ name: "quickstrike" }]);
    expect((get("63045") as unknown as { keywords: { name: string }[] }).keywords.map((k) => k.name)).toEqual([
      "quickstrike",
      "ranged",
    ]);
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

  it("quantities read from set positions are recorded as data decisions", () => {
    const q = (id: string) => (get(id) as unknown as { quantityInSet: number }).quantityInSet;
    expect([q("63006"), q("63007"), q("63008"), q("63009"), q("63012"), q("63013")]).toEqual([2, 2, 2, 2, 2, 1]);
    for (const id of ["63003", "63004", "63006", "63007", "63008", "63009", "63012", "63013"]) {
      expect(notes(id), id).toContain("Data decision");
    }
  });

  it("the video-only cards are PLACEHOLDER, unverified and have no art", () => {
    for (const id of ["63040", "63041", "63042", "63044", "63045"]) {
      expect(notes(id), id).toContain("PLACEHOLDER");
      expect(notes(id), id).toMatch(/unverified|unofficial/);
      expect((get(id) as unknown as { images?: unknown }).images, id).toBeUndefined();
    }
    const aka = get("63041") as unknown as { atk: number; sch: number; hp: number; nemesisMinion?: boolean };
    expect([aka.atk, aka.sch, aka.hp, aka.nemesisMinion]).toEqual([2, 2, 4, true]);
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

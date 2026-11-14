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
 * article "Killer Instinct" (scripts/marvelcdb/curation/elektra.ts). The obligation 63028 and nemesis minion Aka 63029
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

  it("is 21 records, counted by type, with no starter deck and one nemesis set", () => {
    expect(ELEKTRA_CARDS).toHaveLength(21);
    const counts: Record<string, number> = {};
    for (const c of ELEKTRA_CARDS) counts[c.type] = (counts[c.type] ?? 0) + 1;
    expect(counts).toEqual({
      hero_identity: 1,
      treachery: 3,
      ally: 3,
      event: 8,
      upgrade: 4,
      obligation: 1,
      minion: 1,
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

  it("the amplify icon is kept in the text of History with the Hand and Dance with the Devil", () => {
    for (const id of ["63013", "63027"]) {
      expect((get(id) as unknown as { text: { printed: string } }).text.printed, id).toContain("[amplify]");
    }
  });

  it("quantities read from set positions are recorded as data decisions", () => {
    const q = (id: string) => (get(id) as unknown as { quantityInSet: number }).quantityInSet;
    expect([q("63006"), q("63007"), q("63008"), q("63009"), q("63012"), q("63013")]).toEqual([2, 2, 2, 1, 2, 1]);
    for (const id of ["63006", "63007", "63008", "63009", "63012", "63013"]) {
      expect(notes(id), id).toContain("Data decision");
    }
  });

  it("the video-only cards are PLACEHOLDER, unverified and have no art", () => {
    for (const id of ["63028", "63029"]) {
      expect(notes(id), id).toContain("PLACEHOLDER");
      expect(notes(id), id).toContain("unverified");
      expect((get(id) as unknown as { images?: unknown }).images, id).toBeUndefined();
    }
    const aka = get("63029") as unknown as { atk: number; sch: number; hp: number; nemesisMinion?: boolean };
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

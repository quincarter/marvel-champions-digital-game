import { describe, expect, it } from "vitest";
import {
  validateCampaign,
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateStarterDeck,
} from "../schema/index.js";
import type { AttachmentCard, SideSchemeCard } from "../schema/index.js";
import { AOA_CAMPAIGN } from "./aoa/campaign.js";
import { AOA_CARDS } from "./aoa/cards.js";
import { AOA_ENCOUNTER_SETS } from "./aoa/encounterSets.js";
import { AOA_SCENARIOS } from "./aoa/scenarios.js";
import { AOA_STARTER_DECKS } from "./aoa/starterDecks.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { ICEMAN_CARDS } from "./iceman/cards.js";
import { ICEMAN_STARTER_DECKS } from "./iceman/starterDecks.js";
import { JUBILEE_CARDS } from "./jubilee/cards.js";
import { JUBILEE_STARTER_DECKS } from "./jubilee/starterDecks.js";
import { MUT_GEN_CARDS } from "./mut_gen/cards.js";
import { MAGNETO_CARDS } from "./magneto/cards.js";
import { MAGNETO_STARTER_DECKS } from "./magneto/starterDecks.js";
import { NCRAWLER_CARDS } from "./ncrawler/cards.js";
import { NCRAWLER_STARTER_DECKS } from "./ncrawler/starterDecks.js";
import { WOLV_CARDS } from "./wolv/cards.js";

/** RRG 1.8 p. 69 errata for the Wave 8 hero packs: printed text is kept, current text follows the errata. */
const cases = [
  { cards: NCRAWLER_CARDS, id: "48012", printed: "printed THW and ATK", current: "base THW and ATK" },
  { cards: MAGNETO_CARDS, id: "49010", printed: "attached → deal 5 damage", current: "attached. Then, deal 5 damage" },
  {
    cards: MAGNETO_CARDS,
    id: "49028",
    printed: "equal to his total ATK.",
    current: "equal to his total ATK for that attack.",
  },
] as const;

describe("Wave 8 printed-versus-current errata (RRG 1.8 p. 69)", () => {
  for (const c of cases) {
    it(`${c.id} keeps the print and carries the errata'd text`, () => {
      const card = (c.cards as readonly { id: string; text: { printed: string; current: string } }[]).find(
        (x) => x.id === c.id,
      );
      expect(card).toBeDefined();
      expect(card!.text.printed).not.toBe(card!.text.current);
      expect(card!.text.printed).toContain(c.printed);
      expect(card!.text.current).toContain(c.current);
    });
  }

  it("records the non-text errata (48037 boost star, 49023 classification) as notes with unchanged text", () => {
    for (const [cards, id] of [
      [NCRAWLER_CARDS, "48037"],
      [MAGNETO_CARDS, "49023"],
    ] as const) {
      const card = (
        cards as readonly { id: string; text: { printed: string; current: string }; errata?: unknown }[]
      ).find((x) => x.id === id);
      expect(card?.errata).toBeDefined();
      expect(card!.text.printed).toBe(card!.text.current);
    }
  });
});

/** Printed decklist cards (owner's photos, 2026-10-07): section counts exclude identity, obligation and nemesis set. */
const deckCases = [
  {
    decks: NCRAWLER_STARTER_DECKS,
    cards: NCRAWLER_CARDS,
    id: "nightcrawler-protection",
    pack: "ncrawler",
    identity: "48001a",
    aspect: "protection",
    sections: { hero: 15, protection: 20, basic: 5 },
  },
  {
    decks: MAGNETO_STARTER_DECKS,
    cards: MAGNETO_CARDS,
    id: "magneto-leadership",
    pack: "magneto",
    identity: "49001a",
    aspect: "leadership",
    sections: { hero: 15, leadership: 17, basic: 8 },
  },
  {
    decks: JUBILEE_STARTER_DECKS,
    cards: JUBILEE_CARDS,
    id: "jubilee-justice",
    pack: "jubilee",
    identity: "47001a",
    aspect: "justice",
    sections: { hero: 15, justice: 14, basic: 11 },
  },
] as const;

describe("Wave 8 starter decks (printed decklist cards)", () => {
  for (const c of deckCases) {
    describe(c.id, () => {
      const cards = c.cards as readonly { id: string; aspect?: string; type?: string }[];
      const deck = c.decks[0]!;

      it("is the pack's only deck, valid, for the pack's identity", () => {
        expect(c.decks).toHaveLength(1);
        expect(deck.id as string).toBe(c.id);
        expect(deck.packCode as string).toBe(c.pack);
        expect(validateStarterDeck(deck).errors).toEqual([]);
        expect(deck.identityCardId as string).toBe(c.identity);
        expect(deck.aspects).toEqual([c.aspect]);
        expect(cards.some((x) => x.id === c.identity)).toBe(true);
      });

      it("has 40 cards, every id in the pack", () => {
        expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
        for (const e of deck.cards)
          expect(
            cards.some((x) => x.id === (e.cardId as string)),
            e.cardId as string,
          ).toBe(true);
      });

      it("has the printed section counts", () => {
        const counts: Record<string, number> = {};
        for (const e of deck.cards) {
          const a = cards.find((x) => x.id === (e.cardId as string))!.aspect ?? "?";
          const key = a.startsWith("hero:") ? "hero" : a;
          counts[key] = (counts[key] ?? 0) + e.quantity;
        }
        expect(counts).toEqual(c.sections);
      });
    });
  }
});

describe("Jubilee starter deck specifics", () => {
  const deck = JUBILEE_STARTER_DECKS[0]!;
  const qty = (id: string) => deck.cards.find((e) => (e.cardId as string) === id)?.quantity ?? 0;

  it("holds one Unlikely Duo (printed once; Max 1 per deck)", () => {
    expect(qty("47022")).toBe(1);
  });

  it("holds one copy of each a/b/c record of Firecracker, Flash of Light and Plasmoid Energy", () => {
    for (const n of ["47007", "47008", "47010"]) for (const v of ["a", "b", "c"]) expect(qty(n + v), n + v).toBe(1);
  });

  it("titles 47009 as the card prints it", () => {
    expect(JUBILEE_CARDS.find((c) => (c.id as string) === "47009")!.name).toBe("Grand Finale");
  });
});

/**
 * The basic Colossus ally prints "Piotr Rasputin" (scan 32048.png); MarvelCDB has no `subname`, so it is a curated
 * correction on `mut_gen` 32048 and its `wolv` reprint 35021. The unique rule (RRG 1.8 "Unique") needs it to match the
 * Colossus hero (alter-ego Piotr Rasputin) and Magik's Colossus 45031.
 */
describe("Basic Colossus ally subtitle (curated correction)", () => {
  it.each([
    ["mut_gen 32048", MUT_GEN_CARDS, "32048"],
    ["wolv 35021 (reprint)", WOLV_CARDS, "35021"],
  ] as const)("%s prints the subtitle Piotr Rasputin", (_label, cards, id) => {
    const card = cards.find((c) => c.id === id);
    expect(card?.name).toBe("Colossus");
    expect(card?.subtitle).toBe("Piotr Rasputin");
  });
});

/**
 * Wave 8 (cycle 8, docs/phase7-wave8.md): `aoa` (Age of Apocalypse, MC45) card data, scenario records, starter decks
 * and `AOA_CAMPAIGN`. The pool wiring (`WAVE8_*`, `PLAYABLE_CARDS`, `CAMPAIGNS`) is a later step, not asserted here.
 */
const aoaById = new Map(AOA_CARDS.map((c) => [c.id as string, c]));
const aoa = (id: string) => {
  const c = aoaById.get(id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const aoaSetIds = (c: unknown) => ((c as { encounterSetIds?: readonly unknown[] }).encounterSetIds ?? []).map(String);

describe("wave 8 aoa data: card integrity", () => {
  it("every card passes validateCard()", () => {
    const failures = AOA_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("194 cards by type, all in aoa and cycle8, with no duplicate ids", () => {
    expect(AOA_CARDS).toHaveLength(194);
    const byType: Record<string, number> = {};
    for (const c of AOA_CARDS) {
      byType[c.type] = (byType[c.type] ?? 0) + 1;
      expect(c.setCode, c.id as string).toBe("aoa");
      expect(c.cycleId, c.id as string).toBe("cycle8");
    }
    expect(byType).toEqual({
      hero_identity: 2,
      ally: 14,
      upgrade: 12,
      event: 15,
      resource: 6,
      support: 4,
      obligation: 5,
      minion: 39,
      side_scheme: 34,
      treachery: 23,
      villain: 12,
      main_scheme: 5,
      attachment: 19,
      environment: 4,
    });
    expect(new Set(AOA_CARDS.map((c) => c.id)).size).toBe(AOA_CARDS.length);
  });

  it("23 encounter sets with the card counts, and every card's sets exist", () => {
    const sizes: Record<string, number> = {};
    for (const c of AOA_CARDS) for (const id of aoaSetIds(c)) sizes[id] = (sizes[id] ?? 0) + 1;
    expect(AOA_ENCOUNTER_SETS).toHaveLength(23);
    expect(new Set(AOA_ENCOUNTER_SETS.map((s) => s.id)).size).toBe(23);
    expect(sizes).toEqual({
      age_of_apocalypse: 2,
      aoa_campaign: 2,
      aoa_mission: 10,
      apocalypse: 12,
      bishop_nemesis: 4,
      blue_moon: 8,
      celestial_tech: 3,
      clan_akkaba: 5,
      dark_beast: 7,
      dark_riders: 6,
      dystopian_nightmare: 3,
      en_sabah_nur: 9,
      four_horsemen: 20,
      genosha: 6,
      hounds: 4,
      infinites: 3,
      magik_nemesis: 5,
      overseer: 5,
      prelates: 5,
      savage_land: 6,
      standard_iii: 6,
      unus: 8,
    });
    const known = new Set(AOA_ENCOUNTER_SETS.map((s) => s.id as string));
    for (const c of AOA_CARDS) for (const id of aoaSetIds(c)) expect(known.has(id), `${c.id}: ${id}`).toBe(true);
  });

  it("every card has an image reference, none of them a bare undefined front", () => {
    const withFront = AOA_CARDS.filter((c) => c.images?.front).length;
    // The 17 multi-stage villains and main schemes carry their images per stage instead of on the card.
    expect(withFront).toBe(AOA_CARDS.length - 17);
  });

  it("the double-faced side schemes name each other (45104 and 45105)", () => {
    const of = (id: string) => (aoa(id) as { otherFaceId?: unknown }).otherFaceId;
    expect(of("45104a")).toBe("45104b");
    expect(of("45104b")).toBe("45104a");
    expect(of("45105a")).toBe("45105b");
    expect(of("45105b")).toBe("45105a");
    expect(aoa("45104b").images?.front).toBeDefined();
  });

  it("the five Overseers have no ATK or SCH; the five Prelates keep theirs", () => {
    const stats = (id: string) => {
      const c = aoa(id) as { atk?: unknown; sch?: unknown; hp?: unknown };
      return [c.atk, c.sch];
    };
    for (const id of ["45179a", "45180a", "45181a", "45182a", "45183a"]) {
      expect(aoaSetIds(aoa(id)), id).toEqual(["overseer"]);
      expect(stats(id), id).toEqual([null, null]);
    }
    const prelates: Record<string, [number, number]> = {
      "45179b": [1, 1],
      "45180b": [1, 3],
      "45181b": [2, 2],
      "45182b": [3, 1],
      "45183b": [2, 2],
    };
    for (const [id, expected] of Object.entries(prelates)) {
      expect(aoaSetIds(aoa(id)), id).toEqual(["prelates"]);
      expect(stats(id), id).toEqual(expected);
    }
  });

  it("Mission Team (45171a) keeps its printed text and its current text differs (this phase)", () => {
    const text = (aoa("45171a") as { text?: { printed: string; current: string } }).text;
    expect(text?.printed).toContain("to the mission by 2");
    expect(text?.current).toContain("to the mission this phase by 2");
    expect(text?.printed).not.toEqual(text?.current);
  });

  it("Cruel Experiment (45124) has no attachesTo", () => {
    const c = aoa("45124") as AttachmentCard;
    expect(c.name).toBe("Cruel Experiment");
    expect(c.attachesTo).toBeUndefined();
  });

  it("Sidekick (45015) attaches to an identity-specific ally you control", () => {
    expect((aoa("45015") as { attachesTo?: unknown }).attachesTo).toEqual({
      kind: "qualified",
      category: "ally",
      classification: "identitySpecific",
      controlledBy: "you",
    });
  });

  it("No Longer Worthy (45105b) attaches to the villain Apocalypse", () => {
    const c = aoa("45105b") as AttachmentCard;
    expect(c.name).toBe("No Longer Worthy");
    expect(c.attachesTo).toEqual({ kind: "namedVillain", name: "Apocalypse" });
    expect((aoa("45105a") as SideSchemeCard).type).toBe("side_scheme");
  });
});

describe("wave 8 aoa data: scenarios (MC45 pp. 8-20)", () => {
  it("five scenarios in box order, all in aoa, each valid", () => {
    expect(AOA_SCENARIOS.map((s) => s.id as string)).toEqual([
      "unus",
      "four-horsemen",
      "apocalypse",
      "dark-beast",
      "en-sabah-nur",
    ]);
    for (const s of AOA_SCENARIOS) {
      expect(s.packCode as string).toBe("aoa");
      expect(validateScenario(s).errors, s.id as string).toEqual([]);
    }
  });

  it("encounter sets validate against Core's and this pack's sets", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...AOA_ENCOUNTER_SETS];
    for (const s of AOA_SCENARIOS) {
      expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
    }
  });

  it("every card a scenario names exists", () => {
    for (const s of AOA_SCENARIOS) {
      const named = [
        s.villainCardId,
        s.mainSchemeCardId,
        ...(s.setAsideVillainCardIds ?? []),
        ...(s.setAsideCardIds ?? []),
        ...(s.expertVillains ? [s.expertVillains.villainCardId, ...s.expertVillains.setAsideVillainCardIds] : []),
      ];
      for (const id of named) expect(aoaById.has(id as string), `${s.id}: ${id}`).toBe(true);
    }
  });
});

describe("wave 8 aoa data: starter decks (MC45 p. 22)", () => {
  const size = (d: (typeof AOA_STARTER_DECKS)[number]) => d.cards.reduce((n, e) => n + e.quantity, 0);

  it("Bishop / Leadership and Magik / Aggression, valid, in aoa", () => {
    expect(AOA_STARTER_DECKS.map((d) => d.id as string)).toEqual(["bishop-leadership", "magik-aggression"]);
    expect(AOA_STARTER_DECKS.map((d) => d.identityCardId as string)).toEqual(["45001a", "45030a"]);
    expect(AOA_STARTER_DECKS.map(size)).toEqual([40, 40]);
    for (const d of AOA_STARTER_DECKS) {
      expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
      expect(d.packCode as string).toBe("aoa");
    }
  });
});

describe("wave 8 aoa data: AOA_CAMPAIGN (MC45 pp. 4-6)", () => {
  it("passes validateCampaign()", () => {
    const outcome = validateCampaign(AOA_CAMPAIGN);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("MC45, the five scenarios in the printed order, all in aoa", () => {
    expect(AOA_CAMPAIGN.boxCode).toBe("MC45");
    expect(AOA_CAMPAIGN.packCode as string).toBe("aoa");
    expect(AOA_CAMPAIGN.scenarioIds.map((id) => id as string)).toEqual(AOA_SCENARIOS.map((s) => s.id as string));
  });

  it("the five campaign sets are registered and campaignSpecific; nothing is prohibited", () => {
    const byId = new Map(AOA_ENCOUNTER_SETS.map((s) => [s.id as string, s]));
    expect(AOA_CAMPAIGN.campaignSetIds.map((id) => id as string)).toEqual([
      "age_of_apocalypse",
      "aoa_mission",
      "overseer",
      "aoa_campaign",
      "aoa_basic_campaign",
    ]);
    for (const id of AOA_CAMPAIGN.campaignSetIds) expect(byId.get(id as string)?.campaignSpecific, id).toBe(true);
    expect(AOA_ENCOUNTER_SETS.filter((s) => s.campaignSpecific)).toHaveLength(5);
    expect(AOA_CAMPAIGN.prohibited).toBeUndefined();
    expect(AOA_CAMPAIGN.roles).toBeUndefined();
    expect(AOA_CAMPAIGN.perSeatSetIds).toBeUndefined();
  });
});

describe("Iceman starter deck (Frostbite is Permanent, set aside, not counted)", () => {
  const deck = ICEMAN_STARTER_DECKS[0]!;
  type Loose = { keywords: readonly { name: string }[]; aspect?: string; text: { printed: string; current: string } };
  const card = (id: string) => ICEMAN_CARDS.find((c) => (c.id as string) === id)! as unknown as Loose;
  const counted = deck.cards.filter((e) => !card(e.cardId as string).keywords.some((k) => k.name === "permanent"));

  it("is the pack's only deck, valid, Iceman / Aggression", () => {
    expect(ICEMAN_STARTER_DECKS).toHaveLength(1);
    expect(deck.id as string).toBe("iceman-aggression");
    expect(deck.packCode as string).toBe("iceman");
    expect(validateStarterDeck(deck).errors).toEqual([]);
    expect(deck.identityCardId as string).toBe("46001a");
    expect(deck.aspects).toEqual(["aggression"]);
  });

  it("has 40 counted cards in sections 15 / 15 / 10, every id in the pack", () => {
    expect(counted.reduce((n, e) => n + e.quantity, 0)).toBe(40);
    const counts: Record<string, number> = {};
    for (const e of counted) {
      const a = card(e.cardId as string).aspect ?? "?";
      const key = a.startsWith("hero:") ? "hero" : a;
      counts[key] = (counts[key] ?? 0) + e.quantity;
    }
    expect(counts).toEqual({ hero: 15, aggression: 15, basic: 10 });
  });

  it("lists six Frostbite (46002), which are Permanent and not counted", () => {
    const entries = deck.cards.filter((e) => (e.cardId as string) === "46002");
    expect(entries.map((e) => e.quantity)).toEqual([6]);
    expect(counted.some((e) => (e.cardId as string) === "46002")).toBe(false);
    expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(46);
  });

  it("prints Cryokinetic Perception as the card does (the ICE trait)", () => {
    const t = card("46005").text;
    expect(t.current).toContain("the ICE trait");
    expect(t.printed).toContain("the ICE trait");
  });
});

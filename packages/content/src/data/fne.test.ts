import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateScenarioVillainOptions,
  validateStarterDeck,
} from "../schema/index.js";
import type { AnyCard, HeroIdentityCard, MainSchemeCard, VillainCard } from "../schema/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/index.js";
import { FNE_CAMPAIGN } from "./fne/campaign.js";
import { FNE_CARDS } from "./fne/cards.js";
import { FNE_ENCOUNTER_SETS } from "./fne/encounterSets.js";
import { FNE_CYCLE, FNE_PACK } from "./fne/packs.js";
import { FNE_PROVENANCE } from "./fne/provenance.js";
import { FNE_SCENARIOS } from "./fne/scenarios.js";
import { FNE_STARTER_DECKS } from "./fne/starterDecks.js";
import {
  CORE_CARDS,
  PLAYABLE_CARDS,
  WAVE10_CARDS,
  WAVE11_CARDS,
  WAVE11_ENCOUNTER_SETS,
  WAVE11_SCENARIOS,
  WAVE11_STARTER_DECKS,
} from "./index.js";

/**
 * Fear No Evil (`fne`, cycle 11, MC60): counts, the Sense separate deck, Photographic Reflexes' star cost, the two
 * a-face corrections and the two precons, each with its citation (`scripts/marvelcdb/curation/fne.ts`). Sources: the
 * MC60 rulebook p. 3, 25 and 26, RRG 1.8 (Star Icon p. 40), docs/phase7-wave11.md section 1 and
 * docs/phase7-wave11-data-survey.md sections 6 and 10. The scenario half (60065 to 60210) is transcribed data; its six
 * scenarios and the campaign record are at the end (MC60 pp. 5, 8, 9, 13 to 23; docs/phase7-wave11-scenarios.md S1).
 */
interface RawRecord {
  readonly code: string;
  readonly quantity: number;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/fne.json", import.meta.url), "utf8")) as {
  cards: readonly RawRecord[];
};

const byId = new Map(FNE_CARDS.map((c) => [c.id as string, c]));
const get = <T extends AnyCard>(id: string): T => {
  const card = byId.get(id);
  if (!card) throw new Error(`no card ${id}`);
  return card as T;
};
const typeCounts = (cards: readonly AnyCard[]) => {
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.type] = (counts[c.type] ?? 0) + 1;
  return counts;
};
const keywordNames = (id: string) =>
  (get(id) as unknown as { keywords: { name: string }[] }).keywords.map((k) => k.name);
const notes = (id: string) => FNE_PROVENANCE.find((p) => p.cardId === id)!.corrections.join(" | ");

describe("fne: the pack", () => {
  it("is in cycle 11, Fear No Evil, released July 24, 2026 (MarvelCDB pack list)", () => {
    expect(FNE_CYCLE).toEqual({ id: "cycle11", name: "Fear No Evil", order: 11 });
    expect(FNE_PACK.releaseDate).toBe("2026-07-24");
    expect(FNE_PACK.cycleId as string).toBe("cycle11");
  });

  it("is 203 cards (268 copies; the five Protection Racket schemes are five cards), counted by type", () => {
    expect(FNE_CARDS).toHaveLength(203);
    expect(FNE_CARDS.reduce((n, c) => n + c.quantityInSet, 0)).toBe(268);
    expect(typeCounts(FNE_CARDS)).toEqual({
      hero_identity: 2,
      upgrade: 22,
      ally: 8,
      event: 14,
      player_side_scheme: 3,
      support: 10,
      obligation: 7,
      minion: 36,
      side_scheme: 17,
      attachment: 30,
      treachery: 23,
      resource: 3,
      villain: 7,
      environment: 11,
      main_scheme: 10,
    });
  });

  it("every card is fne's own, carries cycle11 and passes validateCard()", () => {
    for (const c of FNE_CARDS) {
      expect(c.setCode as string, c.id as string).toBe("fne");
      expect(c.cycleId as string, c.id as string).toBe("cycle11");
      expect(validateCard(c).errors, c.id as string).toEqual([]);
    }
  });

  it("covers every MarvelCDB record in provenance", () => {
    const covered = new Set(FNE_PROVENANCE.flatMap((p) => p.marvelcdbCodes));
    for (const r of raw.cards) expect(covered.has(r.code), r.code).toBe(true);
  });

  it("has 20 encounter sets with both heroes' nemesis sets and the campaign set", () => {
    expect(FNE_ENCOUNTER_SETS).toHaveLength(20);
    const ids = FNE_ENCOUNTER_SETS.map((s) => s.id as string);
    for (const id of ["daredevil_nemesis", "echo_nemesis", "kingpin", "fne_campaign"]) expect(ids).toContain(id);
  });
});

describe("fne: Daredevil's identity (corrections owed by the survey, section 6)", () => {
  const daredevil = get<HeroIdentityCard>("60001a");

  it("the hero face prints THW 2, ATK 2, DEF 2 (scan 60001a; MC60 p. 2), not MarvelCDB's THW 1", () => {
    expect(daredevil.hero.thw).toBe(2);
    expect(daredevil.hero.atk).toBe(2);
    expect(daredevil.hero.def).toBe(2);
    expect(notes("60001a")).toContain("THW 1");
  });

  it("the hero face also prints the Sense Forced Interrupt, as the alter-ego face does (MC60 p. 26)", () => {
    const sentence =
      "Forced Interrupt: When a Sense upgrade would leave play, place it on the bottom of the Sense deck instead.";
    expect(daredevil.hero.text.current).toContain(sentence);
    expect(daredevil.hero.text.printed).toContain(sentence);
    expect(daredevil.alterEgo.text.current).toContain(sentence);
    expect(daredevil.hero.abilities).toHaveLength(2);
  });

  it("the Sense deck is five single copies, faceup, never discarded, fixed in order and open to its owner", () => {
    expect(daredevil.separateDecks).toEqual([
      {
        name: "Sense",
        cards: ["60002", "60003", "60004", "60005", "60006"].map((id) => ({ cardId: id, quantity: 1 })),
        topCardFaceup: true,
        discardPile: "none",
        whenEmpty: "stayEmpty",
        cardFamily: "player",
        fixedOrder: true,
        ownerMayLookThrough: true,
      },
    ]);
    for (const id of ["60002", "60003", "60004", "60005", "60006"]) {
      const card = get(id) as { separateDeck?: string; deckLimit?: number; aspect?: string };
      expect(card.separateDeck, id).toBe("Sense");
      expect(card.deckLimit, id).toBe(0);
      expect(card.aspect, id).toBe("hero:60001a");
    }
  });
});

describe("fne: Photographic Reflexes (spec section 1.2)", () => {
  it("is three printings of two copies, each a star cost of 0 and none a printed X", () => {
    for (const id of ["60040a", "60040b", "60040c"]) {
      const card = get(id) as { cost: number; specialCost?: string; quantityInSet: number; name: string };
      expect(card.name, id).toBe("Photographic Reflexes");
      expect(card.specialCost, id).toBe("star");
      expect(card.cost, id).toBe(0);
      expect(card.quantityInSet, id).toBe(2);
      expect(notes(id), id).toContain("star");
    }
  });
});

describe("fne: keywords, icons and threat the spec names (section 1.3)", () => {
  it("Discount, Starting, Team-Up, Temporary, Restricted, Guard and Victory 0 are parsed", () => {
    for (const id of ["60023", "60026", "60027"]) expect(keywordNames(id), id).toContain("discount");
    expect(keywordNames("60038")).toContain("starting");
    for (const id of ["60031", "60055"]) expect(keywordNames(id), id).toContain("teamUp");
    for (const id of ["60027", "60052"]) expect(keywordNames(id), id).toContain("temporary");
    for (const id of ["60017", "60045"]) expect(keywordNames(id), id).toContain("restricted");
    expect(keywordNames("60063")).toContain("guard");
    for (const id of ["60024", "60056"]) expect(keywordNames(id), id).toContain("victory");
  });

  it("player side scheme threat: 60012 and 60024 are 4 fixed, 60056 (the 40059 reprint) is 3 per player", () => {
    const start = (id: string) =>
      (get(id) as unknown as { startingThreat: { base: number; perPlayer: number } }).startingThreat;
    expect(start("60012")).toEqual({ base: 4, perPlayer: 0 });
    expect(start("60024")).toEqual({ base: 4, perPlayer: 0 });
    expect(start("60056")).toEqual({ base: 0, perPlayer: 3 });
  });

  it("Cloak has an acceleration icon; Dance with the Devil and Deadliest Man Alive an amplify icon", () => {
    expect((get("60020") as unknown as { schemeIcons?: string[] }).schemeIcons).toEqual(["acceleration"]);
    expect((get("60031") as { amplifyIcons?: number }).amplifyIcons).toBe(1);
    expect((get("60034") as { amplifyIcons?: number }).amplifyIcons).toBe(1);
  });
});

describe("fne: the two starter decks (MC60 rulebook p. 25)", () => {
  type Deck = (typeof FNE_STARTER_DECKS)[number];
  const sum = (deck: Deck) => deck.cards.reduce((n, e) => n + e.quantity, 0);
  const quantityOf = (deck: Deck, id: string) => deck.cards.find((e) => (e.cardId as string) === id)?.quantity ?? 0;
  const [daredevil, echo] = FNE_STARTER_DECKS;

  it("are Daredevil / Justice and Echo / Protection, verified against the printed list and valid", () => {
    expect(FNE_STARTER_DECKS.map((d) => [d.id as string, d.packCode as string, d.identityCardId as string])).toEqual([
      ["fne-daredevil-justice", "fne", "60001a"],
      ["fne-echo-protection", "fne", "60037a"],
    ]);
    expect(daredevil!.aspects).toEqual(["justice"]);
    expect(echo!.aspects).toEqual(["protection"]);
    for (const d of FNE_STARTER_DECKS) {
      expect(d.provenance.verified, d.id as string).toBe(true);
      expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
      expect(sum(d), d.id as string).toBe(40);
      for (const e of d.cards) {
        expect(e.quantity, `${d.id} ${e.cardId}`).toBeLessThanOrEqual(get(e.cardId as string).quantityInSet);
      }
    }
  });

  it("Daredevil's 40 are 15 hero, 20 Justice and 5 basic, with the Sense cards outside them", () => {
    const split = { hero: 0, justice: 0, basic: 0 };
    for (const e of daredevil!.cards) {
      const aspect = (get(e.cardId as string) as { aspect?: string }).aspect ?? "";
      split[aspect === "basic" ? "basic" : aspect.startsWith("hero") ? "hero" : "justice"] += e.quantity;
    }
    expect(split).toEqual({ hero: 15, justice: 20, basic: 5 });
    for (const id of ["60002", "60003", "60004", "60005", "60006", "60032", "60033"])
      expect(quantityOf(daredevil!, id), id).toBe(0);
  });

  it("Echo's 40 are 15 hero, 20 Protection and 5 basic, six Photographic Reflexes and Strength rather than Stick", () => {
    const split = { hero: 0, protection: 0, basic: 0 };
    for (const e of echo!.cards) {
      const aspect = (get(e.cardId as string) as { aspect?: string }).aspect ?? "";
      split[aspect === "basic" ? "basic" : aspect.startsWith("hero") ? "hero" : "protection"] += e.quantity;
    }
    expect(split).toEqual({ hero: 15, protection: 20, basic: 5 });
    expect(quantityOf(echo!, "60040a") + quantityOf(echo!, "60040b") + quantityOf(echo!, "60040c")).toBe(6);
    // MarvelCDB decklist 63934 swaps Strength (60059) for Stick (60029); the printed rulebook list wins.
    expect(quantityOf(echo!, "60059")).toBe(1);
    expect(quantityOf(echo!, "60029")).toBe(0);
    expect(quantityOf(echo!, "60038")).toBe(1);
  });
});

describe("fne: wave 11 pool wiring", () => {
  it("WAVE11_CARDS is Core, then fne, then the hero packs, with no duplicate ids and no id shared with wave 10", () => {
    expect(WAVE11_CARDS.slice(0, CORE_CARDS.length)).toEqual(CORE_CARDS);
    expect(WAVE11_CARDS.slice(CORE_CARDS.length, CORE_CARDS.length + FNE_CARDS.length)).toEqual(FNE_CARDS);
    expect(new Set(WAVE11_CARDS.map((c) => c.id)).size).toBe(WAVE11_CARDS.length);
    const wave10 = new Set(WAVE10_CARDS.map((c) => c.id as string));
    for (const c of FNE_CARDS) expect(wave10.has(c.id as string), c.id as string).toBe(false);
  });

  it("PLAYABLE_CARDS carries the fne cards as one block inside wave 11, each once", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    const start = ids.length - (WAVE11_CARDS.length - CORE_CARDS.length);
    expect(ids.slice(start, start + FNE_CARDS.length)).toEqual(FNE_CARDS.map((c) => c.id as string));
  });

  it("the wave exports begin with fne's encounter sets, scenarios and the two starter decks", () => {
    expect(WAVE11_ENCOUNTER_SETS.slice(0, FNE_ENCOUNTER_SETS.length)).toEqual(FNE_ENCOUNTER_SETS);
    expect(WAVE11_SCENARIOS.slice(0, FNE_SCENARIOS.length)).toEqual(FNE_SCENARIOS);
    expect(WAVE11_STARTER_DECKS.slice(0, FNE_STARTER_DECKS.length)).toEqual(FNE_STARTER_DECKS);
  });
});

describe("fne: the six scenarios and the campaign record (MC60 pp. 5, 8, 9, 13 to 23)", () => {
  const sets = [...CORE_ENCOUNTER_SETS, ...FNE_ENCOUNTER_SETS];
  const underling = FNE_SCENARIOS.filter((s) => s.id !== "kingpin");
  const scenario = (id: string) => FNE_SCENARIOS.find((s) => s.id === id)!;

  it("is one record per main scheme in log order, Kingpin last (MC60 p. 5, p. 28)", () => {
    expect(FNE_SCENARIOS.map((s) => s.id as string)).toEqual([
      "art-museum-heist",
      "the-getaway",
      "protection-racket",
      "the-raft-breakout",
      "stop-the-presses",
      "kingpin",
    ]);
    expect(FNE_CAMPAIGN.scenarioIds).toEqual(FNE_SCENARIOS.map((s) => s.id));
    expect(FNE_CAMPAIGN.campaignSetIds).toEqual(["fne_campaign"]);
    expect(FNE_CAMPAIGN.packCode).toBe("fne");
    expect(FNE_CAMPAIGN.boxCode).toBe("MC60");
  });

  it("passes the scenario, encounter set and villain option checks", () => {
    for (const s of FNE_SCENARIOS) {
      const id = s.id as string;
      expect(validateScenario(s).errors, id).toEqual([]);
      expect(validateScenarioEncounterSets(s, sets).errors, id).toEqual([]);
      expect(validateScenarioVillainOptions(s, FNE_CARDS, sets).errors, id).toEqual([]);
    }
  });

  it("offers the five underlings at each interchangeable scenario, Hammerhead the default (MC60 p. 5, p. 8)", () => {
    expect(underling).toHaveLength(5);
    for (const s of underling) {
      expect(s.villainOptions!.defaultSetId, s.id as string).toBe("hammerhead");
      expect(s.villainOptions!.options.map((o) => o.villainSetId as string)).toEqual([
        "hammerhead",
        "bullseye",
        "electro",
        "purple_man",
        "typhoid_mary",
      ]);
      expect(s.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
      expect(s.modularSetCount).toBe(2);
      expect(s.standardEncounterSetIds).toEqual(["standard"]);
      expect(s.expertEncounterSetIds).toEqual(["expert"]);
    }
  });

  it("Typhoid Mary is one card (60110b), stage 1 standard and stage 2 expert, won by Disturbed Psyche (MC60 p. 5)", () => {
    for (const s of underling) {
      const mary = s.villainOptions!.options.find((o) => o.villainSetId === "typhoid_mary")!;
      expect(mary.villainCardId).toBe("60110b");
      expect(mary.villainStages).toEqual({ standard: [1, 1], expert: [2, 2] });
      expect(mary.victory).toBe("cardAbility");
      for (const o of s.villainOptions!.options.filter((x) => x !== mary))
        expect(o.victory, `${s.id as string} ${o.villainSetId as string}`).toBeUndefined();
    }
    const card = get<VillainCard>("60110b");
    expect(card.sides.map((side) => side.stages.map((st) => st.stageNumber))).toEqual([
      [1, 2],
      [1, 2],
    ]);
  });

  it("names the printed main scheme set and the two recommended modular sets of each (MC60 pp. 13 to 21)", () => {
    const pages: Record<string, [string, readonly string[]]> = {
      "art-museum-heist": ["art_museum_heist", ["cops", "the_owl"]],
      "the-getaway": ["the_getaway", ["cops", "drive"]],
      "protection-racket": ["protection_racket", ["disasters", "tracksuit_mafia"]],
      "the-raft-breakout": ["the_raft_breakout", ["the_owl", "tombstone"]],
      "stop-the-presses": ["stop_the_presses", ["tombstone", "tracksuit_mafia"]],
    };
    for (const [id, [set, modular]] of Object.entries(pages)) {
      const s = scenario(id);
      expect(
        s.encounterSetIds.map((x) => x as string),
        id,
      ).toEqual(["hammerhead", set]);
      expect(s.recommendedModularSetIds, id).toEqual(modular);
    }
  });

  it("Protection Racket deals one of five single-stage main schemes to each player (MC60 p. 13)", () => {
    const s = scenario("protection-racket");
    expect(s.mainSchemeChoice).toEqual({
      kind: "perPlayer",
      cardIds: ["60134a", "60135a", "60136a", "60137a", "60138a"],
      expert: "random",
    });
    expect(s.mainSchemeCardId).toBe("60134a");
    const titles = s.mainSchemeChoice!.cardIds.map((id) => {
      const card = get<MainSchemeCard>(id as string);
      expect(card.stages, id as string).toHaveLength(1);
      expect(card.stages[0]!.stageNumber).toBe(1);
      return card.stages[0]!.name;
    });
    expect(titles).toEqual([
      "Battle in the Bodega",
      "Bull in a China Shop",
      "Hung Out to Dry",
      "Pawn Shop Showdown",
      "A Slice of the Pizza Dough",
    ]);
    for (const other of underling.filter((x) => x !== s)) expect(other.mainSchemeChoice).toBeUndefined();
  });

  it("Kingpin has no underling, no Standard set, the Expert set, and one double-sided card per mode (MC60 p. 23)", () => {
    const s = scenario("kingpin");
    expect(s.villainOptions).toBeUndefined();
    expect(s.encounterSetIds).toEqual(["kingpin"]);
    expect(s.standardEncounterSetIds).toEqual([]);
    expect(s.expertEncounterSetIds).toEqual(["expert"]);
    expect(s.villainCardId).toBe("60159a");
    expect(s.expertVillains).toEqual({ villainCardId: "60160a", setAsideVillainCardIds: [] });
    expect(s.villainStages).toEqual({ standard: [1, 1], expert: [1, 1] });
    expect(s.mainSchemeCardId).toBe("60161a");
    expect(s.recommendedModularSetIds).toEqual(["tombstone", "tracksuit_mafia"]);
    for (const id of ["60159a", "60160a"])
      expect(
        get<VillainCard>(id).sides.map((side) => side.stages.length),
        id,
      ).toEqual([1, 1]);
  });
});

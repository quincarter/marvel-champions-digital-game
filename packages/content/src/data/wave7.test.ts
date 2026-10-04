import { describe, expect, it } from "vitest";
import {
  validateCampaign,
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateStarterDeck,
} from "../schema/index.js";
import type { AttachmentCard, HeroIdentityCard } from "../schema/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { NEXT_EVOL_CAMPAIGN } from "./next_evol/campaign.js";
import { NEXT_EVOL_CARDS } from "./next_evol/cards.js";
import { NEXT_EVOL_ENCOUNTER_SETS } from "./next_evol/encounterSets.js";
import { NEXT_EVOL_SCENARIOS } from "./next_evol/scenarios.js";
import { NEXT_EVOL_STARTER_DECKS } from "./next_evol/starterDecks.js";

/**
 * Wave 7 (cycle 7, docs/phase7-wave7.md): `next_evol` (NeXt Evolution, MC40) card data, scenario records, starter decks
 * and `NEXT_EVOL_CAMPAIGN`. The pool wiring (`WAVE7_*`, `PLAYABLE_CARDS`) is a later step and is not asserted here.
 * Deck legality through the engine is in `@mc/cards`' `wave7-precon-legality.test.ts`.
 */
const cardsById = new Map(NEXT_EVOL_CARDS.map((c) => [c.id as string, c]));
const card = (id: string) => {
  const c = cardsById.get(id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};

describe("wave 7 next_evol data — card integrity", () => {
  it("every card passes validateCard()", () => {
    const failures = NEXT_EVOL_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("205 cards, all in next_evol and cycle7, with no duplicate ids", () => {
    expect(NEXT_EVOL_CARDS).toHaveLength(205);
    for (const c of NEXT_EVOL_CARDS) {
      expect(c.setCode, c.id as string).toBe("next_evol");
      expect(c.cycleId, c.id as string).toBe("cycle7");
    }
    expect(new Set(NEXT_EVOL_CARDS.map((c) => c.id)).size).toBe(NEXT_EVOL_CARDS.length);
  });

  it("19 encounter sets, no duplicates, and every card's sets exist", () => {
    const ids = NEXT_EVOL_ENCOUNTER_SETS.map((s) => s.id as string);
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(19);
    expect([...ids].sort()).toEqual(
      [
        "black_tom_cassidy",
        "cable_nemesis",
        "domino_nemesis",
        "extreme_measures",
        "flight",
        "hope_summers",
        "juggernaut",
        "marauders",
        "military_grade",
        "mister_sinister",
        "morlock_siege",
        "mutant_insurrection",
        "mutant_slayers",
        "nasty_boys",
        "next_evol_campaign",
        "on_the_run",
        "stryfe",
        "super_strength",
        "telepathy",
      ].sort(),
    );
    const known = new Set(ids);
    for (const c of NEXT_EVOL_CARDS) {
      for (const id of (c as { encounterSetIds?: readonly unknown[] }).encounterSetIds ?? []) {
        expect(known.has(id as string), `${c.id}: ${id}`).toBe(true);
      }
    }
  });

  it("every scenario obligation (not a hero kit's own) names an encounter set", () => {
    const heroObligations = new Set(
      NEXT_EVOL_CARDS.flatMap((c) => (c.type === "hero_identity" ? [String(c.obligationCardId)] : [])),
    );
    const scenarioObligations = NEXT_EVOL_CARDS.filter((c) => c.type === "obligation" && !heroObligations.has(c.id));
    expect(scenarioObligations.length).toBeGreaterThan(0);
    for (const o of scenarioObligations) {
      expect((o as { encounterSetIds: readonly unknown[] }).encounterSetIds.length, o.id as string).toBeGreaterThan(0);
    }
  });

  it("High Ground (40154) is a treachery", () => {
    expect(card("40154").type).toBe("treachery");
  });

  it("Inhibitor Collar's and Psychic Inertia's attachment stat modifiers (normalizer branches)", () => {
    expect((card("40092") as AttachmentCard).statModifiers).toEqual({ atk: -1 });
    const inertia = (card("40173") as AttachmentCard).statModifiers;
    expect(inertia).toEqual({ atk: -1, thw: -1 });
    expect(inertia).not.toHaveProperty("sch");
  });

  it("Inhibitor Collar keeps the printed parenthetical; current text drops it (RRG 1.8 erratum)", () => {
    const text = (card("40092") as AttachmentCard).text;
    expect(text?.printed).toContain("(Any player can do this.)");
    expect(text?.current).not.toContain("(Any player can do this.)");
    expect(text?.current).toContain("Any player can do this.");
  });

  it("Domino's hero text says 'your deck' and keeps the wild icon", () => {
    const domino = card("40037a") as HeroIdentityCard;
    expect(domino.hero.text?.current).toContain("your deck");
    expect(domino.hero.text?.current).toContain("[wild]");
    expect(domino.hero.text?.printed).toContain("[wild]");
  });

  it("Cable may include player side schemes of any aspect", () => {
    const cable = card("40001a") as HeroIdentityCard;
    expect(cable.deckbuilding?.offAspectAllowance).toEqual({ cardType: "player_side_scheme" });
  });
});

describe("wave 7 next_evol data — scenarios (MC40 pp. 9-18)", () => {
  const ids = (xs: readonly unknown[] | undefined) => (xs ?? []).map((x) => x as string);

  it("five scenarios in box order, all in next_evol, each valid", () => {
    expect(NEXT_EVOL_SCENARIOS.map((s) => s.id as string)).toEqual([
      "morlock-siege",
      "on-the-run",
      "juggernaut",
      "mister-sinister",
      "stryfe",
    ]);
    for (const s of NEXT_EVOL_SCENARIOS) {
      expect(s.packCode as string).toBe("next_evol");
      expect(validateScenario(s).errors, s.id as string).toEqual([]);
    }
  });

  it("encounter sets validate against Core's and this pack's sets, with Core's Standard and Expert", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...NEXT_EVOL_ENCOUNTER_SETS];
    for (const s of NEXT_EVOL_SCENARIOS) {
      expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
      expect(ids(s.standardEncounterSetIds)).toEqual(["standard"]);
      expect(ids(s.expertEncounterSetIds)).toEqual(["expert"]);
    }
  });

  it("every card a scenario names exists", () => {
    for (const s of NEXT_EVOL_SCENARIOS) {
      const named = [
        s.villainCardId,
        s.mainSchemeCardId,
        ...(s.setAsideVillainCardIds ?? []),
        ...(s.setAsideCardIds ?? []),
        ...(s.expertVillains ? [s.expertVillains.villainCardId, ...s.expertVillains.setAsideVillainCardIds] : []),
      ];
      for (const id of named) expect(cardsById.has(id as string), `${s.id}: ${id}`).toBe(true);
    }
  });
});

describe("wave 7 next_evol data — starter decks (MC40 p. 22)", () => {
  const size = (d: (typeof NEXT_EVOL_STARTER_DECKS)[number]) => d.cards.reduce((n, e) => n + e.quantity, 0);

  it("Cable / Leadership and Domino / Justice, 40 cards each, valid", () => {
    expect(NEXT_EVOL_STARTER_DECKS.map((d) => d.id as string)).toEqual(["cable-leadership", "domino-justice"]);
    expect(NEXT_EVOL_STARTER_DECKS.map(size)).toEqual([40, 40]);
    expect(NEXT_EVOL_STARTER_DECKS.map((d) => d.identityCardId as string)).toEqual(["40001a", "40037a"]);
    for (const d of NEXT_EVOL_STARTER_DECKS) {
      expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
      expect(d.packCode as string).toBe("next_evol");
    }
  });

  it("each card is in the box at least as many times as the deck lists it", () => {
    for (const d of NEXT_EVOL_STARTER_DECKS) {
      for (const e of d.cards) {
        const c = cardsById.get(e.cardId as string) as { quantityInSet?: number } | undefined;
        expect(c, e.cardId as string).toBeDefined();
        expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(c?.quantityInSet ?? 0);
      }
    }
  });
});

describe("wave 7 next_evol data — NEXT_EVOL_CAMPAIGN (MC40 pp. 6-7)", () => {
  it("passes validateCampaign()", () => {
    const outcome = validateCampaign(NEXT_EVOL_CAMPAIGN);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("MC40, the five scenarios in the printed order, all in next_evol", () => {
    expect(NEXT_EVOL_CAMPAIGN.boxCode).toBe("MC40");
    expect(NEXT_EVOL_CAMPAIGN.packCode as string).toBe("next_evol");
    expect(NEXT_EVOL_CAMPAIGN.scenarioIds.map((id) => id as string)).toEqual(
      NEXT_EVOL_SCENARIOS.map((s) => s.id as string),
    );
  });

  it("the campaign set is registered and campaignSpecific; Hope Summers (40204) is the one prohibited card", () => {
    const byId = new Map(NEXT_EVOL_ENCOUNTER_SETS.map((s) => [s.id as string, s]));
    expect(NEXT_EVOL_CAMPAIGN.campaignSetIds.map((id) => id as string)).toEqual(["next_evol_campaign"]);
    expect(byId.get("next_evol_campaign")?.campaignSpecific).toBe(true);
    expect(NEXT_EVOL_CAMPAIGN.prohibited?.cardIds?.map((id) => id as string)).toEqual(["40204"]);
    expect(NEXT_EVOL_CAMPAIGN.prohibited?.encounterSetIds).toBeUndefined();
    expect(cardsById.get("40204")?.name).toBe("Hope Summers");
    expect(NEXT_EVOL_CAMPAIGN.roles).toBeUndefined();
    expect(NEXT_EVOL_CAMPAIGN.perSeatSetIds).toBeUndefined();
  });
});

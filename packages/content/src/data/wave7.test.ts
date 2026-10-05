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
import { DEADPOOL_CARDS } from "./deadpool/cards.js";
import { ANGEL_CARDS } from "./angel/cards.js";
import { PSYLOCKE_CARDS } from "./psylocke/cards.js";
import { NEXT_EVOL_CAMPAIGN } from "./next_evol/campaign.js";
import { NEXT_EVOL_CARDS } from "./next_evol/cards.js";
import { NEXT_EVOL_ENCOUNTER_SETS } from "./next_evol/encounterSets.js";
import { NEXT_EVOL_SCENARIOS } from "./next_evol/scenarios.js";
import { NEXT_EVOL_STARTER_DECKS } from "./next_evol/starterDecks.js";

/**
 * Wave 7 (cycle 7, docs/phase7-wave7.md): `next_evol` (NeXt Evolution, MC40) card data, scenario records, starter decks
 * and `NEXT_EVOL_CAMPAIGN`. The pool wiring (`WAVE7_*`, `PLAYABLE_CARDS`) is exercised by data-only.test.ts and star-icon.test.ts.
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

  it("Technovirus Resurgence (40031) carries its printed acceleration icon", () => {
    expect((card("40031") as { schemeIcons?: unknown }).schemeIcons).toEqual(["acceleration"]);
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

describe("wave 7 next_evol data — curated text", () => {
  it('Malice (40199) says "Treat attached ally as a POSSESSED minion" (scan 40199.png; MarvelCDB reads "Threat")', () => {
    const malice = card("40199");
    if (malice.type !== "minion") throw new Error("Malice is a minion");
    expect(malice.text.printed).toContain("Treat attached ally as a POSSESSED minion");
    expect(malice.text.printed).not.toContain("Threat attached");
    expect(malice.text.current).toBe(malice.text.printed);
  });
});

describe("wave 7 data fixes (scan-confirmed curation and parser gaps)", () => {
  const angel = new Map(ANGEL_CARDS.map((c) => [c.id as string, c]));
  const psylocke = new Map(PSYLOCKE_CARDS.map((c) => [c.id as string, c]));
  interface Loose {
    readonly type: string;
    readonly text: { readonly printed: string; readonly current: string };
    readonly abilities: readonly { readonly id: unknown }[];
    readonly resourceIcons?: unknown;
    readonly schemeIcons?: unknown;
    readonly flipSide?: { readonly resourceIcons?: unknown };
  }
  const ne = (id: string): Loose => card(id) as unknown as Loose;
  const get = (m: Map<string, (typeof ANGEL_CARDS)[number]>, id: string): Loose => {
    const c = m.get(id);
    if (!c) throw new Error(`no card ${id}`);
    return c as unknown as Loose;
  };
  const restrictions = (c: object) => (c as { playRestrictions?: Record<string, unknown> }).playRestrictions;
  const abilityIds = (c: { abilities: readonly { id: unknown }[] }) => c.abilities.map((a) => a.id as string);

  it('The Painted Lady (40045) says "the top of your deck"', () => {
    const c = ne("40045");
    expect(c.text.printed).toContain("from the top of your deck, attach");
    expect(c.text.current).toBe(c.text.printed);
  });

  it("Telekinetic Force Field (40012) keeps the period and is hero form only", () => {
    const c = ne("40012");
    expect(c.text.printed.startsWith("Hero form only.\n")).toBe(true);
    expect(restrictions(c)).toEqual({ form: "hero" });
    expect(abilityIds(c)).toEqual(["40012.telekinetic-force-field-interrupt"]);
  });

  it("Overwatch (40055) is max 1 per host scheme, with no stray constant ability", () => {
    const c = ne("40055");
    expect(restrictions(c)).toEqual({ maxPerHost: 1 });
    expect(abilityIds(c)).toEqual(["40055.overwatch-interrupt"]);
  });

  it("Sharpshooter (40064) prints Max 1 per player and the Hero Interrupt as two paragraphs", () => {
    const c = ne("40064");
    expect(c.text.printed.split("\n")[0]).toBe("Max 1 per player.");
    expect(c.text.printed.split("\n")[1]?.startsWith("Hero Interrupt:")).toBe(true);
    expect(restrictions(c)).toEqual({ maxPerPlayer: 1 });
  });

  it("Containment Strategy (angel 42019) is max 1 per host side scheme", () => {
    const c = get(angel, "42019");
    expect(restrictions(c)).toEqual({ maxPerHost: 1 });
    expect(abilityIds(c)).toEqual(["42019.containment-strategy-response"]);
  });

  it('Warpath (angel 42013) says "(paying its costs)"', () => {
    const c = get(angel, "42013");
    expect(c.text.printed).toContain("(paying its costs).");
    expect(c.text.printed).not.toContain("its cost)");
  });

  it('Psi-Flail Strike and Telekinesis (psylocke 41032, 41033) say "identity" and require the PSIONIC identity trait', () => {
    for (const id of ["41032", "41033"]) {
      const c = get(psylocke, id);
      expect(c.text.printed, id).toContain("Play only if your identity has the PSIONIC trait.");
      expect(c.text.printed, id).not.toContain("your hero");
      expect(restrictions(c)?.requiresIdentityTrait, id).toBe("PSIONIC");
    }
    expect(restrictions(get(psylocke, "41033"))?.maxPerPlayer).toBe(1);
  });

  it("Psi-Katana (41002b) prints a [physical] resource icon on the flip side; Psi-Knife keeps [mental]", () => {
    const c = get(psylocke, "41002a");
    expect(c.type).toBe("upgrade");
    expect(c.resourceIcons).toEqual({ mental: 1 });
    expect(c.flipSide?.resourceIcons).toEqual({ physical: 1 });
  });

  it("Apocalyptic Influence (angel 42024) carries its printed hazard icon", () => {
    expect(get(angel, "42024").schemeIcons).toEqual(["hazard"]);
  });

  it("Deadpool's printed scheme icons match the scans (44013, 44015, 44024, 44043, 44044, 44045, 44051, 44054)", () => {
    const dp = new Map(DEADPOOL_CARDS.map((c) => [c.id as string, c]));
    const icons = (id: string) => (dp.get(id) as unknown as Loose | undefined)?.schemeIcons;
    expect(icons("44013")).toEqual(["acceleration"]);
    expect(icons("44015")).toEqual(["acceleration"]);
    expect(icons("44043")).toEqual(["acceleration"]);
    expect(icons("44044")).toEqual(["hazard"]);
    expect(icons("44045")).toEqual(["hazard"]);
    expect(icons("44051")).toEqual(["crisis"]);
    expect(icons("44054")).toEqual(["crisis"]);
    // Live Dangerously prints four icons: crisis, acceleration, amplify (its amplifyIcons) and hazard.
    expect(icons("44024")).toEqual(["crisis", "acceleration", "hazard"]);
    expect((dp.get("44024") as unknown as { amplifyIcons?: number }).amplifyIcons).toBe(1);
  });

  it("a per player icon on a cost is kept: Team Investigation (40053) 2, Break Time (44046) 3, and no other card", () => {
    const perPlayer = (cards: readonly { readonly id: unknown }[]) =>
      cards.flatMap((c) => {
        const costed = c as unknown as { id: string; cost?: number; costPerPlayer?: true };
        return costed.costPerPlayer ? [[costed.id, costed.cost]] : [];
      });
    expect(perPlayer(NEXT_EVOL_CARDS)).toEqual([["40053", 2]]);
    expect(perPlayer(DEADPOOL_CARDS)).toEqual([["44046", 3]]);
  });

  // Raw `cost_per_hero` is also set on Draw Their Fire (53011, 1) and Strength in Diversity (53019, 2). Re-emitting
  // `falcon` today changes more than this field (53020's restrictions and abilities, 53029's keywords and abilities,
  // scheme icons, image extensions), so the pack is left for its own data pass.
  it.todo("falcon 53011 and 53019 carry costPerPlayer once the pack is re-emitted");

  const dp44051 = (): Loose => DEADPOOL_CARDS.find((c) => c.id === "44051") as unknown as Loose;

  it("Ambush (44051) is max 1 per host side scheme, with no stray constant ability", () => {
    const c = dp44051();
    expect(restrictions(c)).toEqual({ maxPerHost: 1 });
    expect(abilityIds(c)).toEqual(["44051.ambush-interrupt"]);
  });
});

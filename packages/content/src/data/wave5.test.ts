import { describe, expect, it } from "vitest";
import {
  validateCampaign,
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateStarterDeck,
} from "../schema/index.js";
import type { AnyCard, EncounterSet, EnvironmentCard, MainSchemeCard } from "../schema/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { IRONHEART_CARDS } from "./ironheart/cards.js";
import { NOVA_CARDS } from "./nova/cards.js";
import { SM_CAMPAIGN } from "./sm/campaign.js";
import { SM_CARDS } from "./sm/cards.js";
import { SM_ENCOUNTER_SETS } from "./sm/encounterSets.js";
import { SM_SCENARIOS } from "./sm/scenarios.js";
import { SM_STARTER_DECKS } from "./sm/starterDecks.js";
import { SPDR_CARDS } from "./spdr/cards.js";
import { SPIDERHAM_CARDS } from "./spiderham/cards.js";

/**
 * Wave 5 (cycle 4, docs/phase7-wave5.md): `sm` (Sinister Motives) is new data this wave; `nova`/`ironheart`/
 * `spiderham`/`spdr` were emitted in earlier passes and are re-checked here as part of the same cycle. This is the
 * data-integrity half only (the wave 4 `wave4.test.ts` model) — no `WAVE5_*` aggregate, `PLAYABLE_CARDS` or
 * `CAMPAIGNS` entry exists yet (that's the wave's own client-wiring step, done once, later). Engine-level deck
 * legality (`validateDeck`/`requiredIdentitySet`) is `@mc/engine`'s/`@mc/cards`' own test, not `@mc/content`'s — it
 * cannot import `@mc/engine` (client → cards → engine → content dependency direction, CLAUDE.md).
 */

interface PackFixture {
  readonly code: string;
  readonly cards: readonly AnyCard[];
}

const CYCLE4_PACKS: readonly PackFixture[] = [
  { code: "sm", cards: SM_CARDS },
  { code: "nova", cards: NOVA_CARDS },
  { code: "ironheart", cards: IRONHEART_CARDS },
  { code: "spiderham", cards: SPIDERHAM_CARDS },
  { code: "spdr", cards: SPDR_CARDS },
];

describe("wave 5 (cycle 4) data — integrity", () => {
  it("every card in every cycle 4 pack passes validateCard()", () => {
    for (const pack of CYCLE4_PACKS) {
      const failures = pack.cards
        .map((c) => ({ id: c.id, errors: validateCard(c).errors }))
        .filter((f) => f.errors.length > 0);
      expect(failures, pack.code).toEqual([]);
    }
  });

  it.each(CYCLE4_PACKS.map((p) => [p.code, p] as const))("%s: every card belongs to its own pack", (code, pack) => {
    for (const c of pack.cards) expect(c.setCode, c.id as string).toBe(code);
  });

  it("sm has no duplicate card ids", () => {
    const ids = SM_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sm registers encounter sets with no duplicate ids", () => {
    const ids = SM_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Sinister Motives — five scenarios", () => {
  it("five scenarios: Sandman, Venom, Mysterio, The Sinister Six, Venom Goblin", () => {
    expect(SM_SCENARIOS.map((s) => s.id).sort()).toEqual(
      ["sandman", "venom", "mysterio", "sinister-six", "venom-goblin"].sort(),
    );
  });

  it("every scenario passes validateScenario()", () => {
    for (const s of SM_SCENARIOS) expect(validateScenario(s).errors, s.id as string).toEqual([]);
  });

  it("every scenario's named encounter sets are registered (sm's own plus Core's)", () => {
    const sets: readonly EncounterSet[] = [...CORE_ENCOUNTER_SETS, ...SM_ENCOUNTER_SETS];
    for (const s of SM_SCENARIOS) expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
  });

  it("every scenario's villainCardId/mainSchemeCardId resolve to a real card in SM_CARDS", () => {
    const ids = new Set(SM_CARDS.map((c) => c.id as string));
    for (const s of SM_SCENARIOS) {
      expect(ids.has(s.villainCardId as string), `${s.id as string} villain`).toBe(true);
      expect(ids.has(s.mainSchemeCardId as string), `${s.id as string} main scheme`).toBe(true);
    }
  });

  it("The Sinister Six is a set-aside, card-ability-win multipleVillains scenario (docs/phase7-wave5.md §1.5)", () => {
    const scenario = SM_SCENARIOS.find((s) => s.id === "sinister-six");
    expect(scenario?.multipleVillains?.winCondition).toBe("cardAbility");
    expect(scenario?.multipleVillains?.atSetup).toBe("setAside");
    expect(scenario?.multipleVillains?.villains).toHaveLength(6);
    expect(scenario?.multipleVillains?.encounterDecks).toBe("shared");
  });

  it("Venom Goblin's main scheme is a single 4-stage card whose stages flip to real environment cards (docs/phase7-wave5.md §1.1)", () => {
    const scenario = SM_SCENARIOS.find((s) => s.id === "venom-goblin");
    expect(scenario).toBeDefined();
    const cardsById = new Map(SM_CARDS.map((c) => [c.id as string, c]));
    const mainScheme = cardsById.get(scenario?.mainSchemeCardId as string) as MainSchemeCard | undefined;
    expect(mainScheme?.type).toBe("main_scheme");
    expect(mainScheme?.stages).toHaveLength(4);
    const letters = mainScheme?.stages.map((s) => s.stageLetter);
    expect(letters).toEqual(["A", "B", "C", "D"]);
    for (const stage of mainScheme?.stages ?? []) {
      expect(stage.otherFaceId, `stage ${stage.stageLetter as string}`).toBeDefined();
      const other = cardsById.get(stage.otherFaceId as string);
      expect(other, `stage ${stage.stageLetter as string} otherFaceId`).toBeDefined();
      expect(
        (other as EnvironmentCard | undefined)?.type,
        `stage ${stage.stageLetter as string} otherFaceId type`,
      ).toBe("environment");
      expect(
        (other as EnvironmentCard | undefined)?.otherFaceId,
        `stage ${stage.stageLetter as string} back-link`,
      ).toBe(mainScheme?.id);
    }
    // Stage A (Skies Over New York) never holds threat; stages B-D flip on completion (the p. 67 erratum).
    expect(mainScheme?.stages[0]?.dashedValues?.slice().sort()).toEqual(
      ["acceleration", "startingThreat", "targetThreat"].sort(),
    );
    expect(mainScheme?.stages[0]?.onCompletion).toBeUndefined();
    for (const stage of (mainScheme?.stages ?? []).slice(1)) {
      expect(stage.onCompletion, `stage ${stage.stageLetter as string}`).toBe("flipToOtherFace");
    }
  });

  it("nova, ironheart, spiderham and spdr (hero packs with no scenario of their own) are not among sm's scenarios", () => {
    for (const s of SM_SCENARIOS) expect(s.packCode as string).toBe("sm");
  });
});

describe("Sinister Motives — starter decks (content-level; see wave5.test.ts's own header comment)", () => {
  it("sm has two box precons: Ghost-Spider and Spider-Man (Miles Morales)", () => {
    expect(SM_STARTER_DECKS).toHaveLength(2);
    expect(SM_STARTER_DECKS.map((d) => d.id).sort()).toEqual(["ghost-spider", "spider-man-morales"].sort());
  });

  it("both precons validate as a StarterDeck", () => {
    for (const d of SM_STARTER_DECKS) expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
  });

  it("both precons are verified against MC27 p. 20 and are exactly 40 cards", () => {
    for (const d of SM_STARTER_DECKS) {
      expect(d.provenance.verified, d.id as string).toBe(true);
      expect(d.provenance.sources.length, d.id as string).toBeGreaterThan(0);
      expect(
        d.cards.reduce((n, e) => n + e.quantity, 0),
        d.id as string,
      ).toBe(40);
    }
  });

  it("both precons' identity cards resolve to a real sm hero identity, and each lists exactly one aspect", () => {
    const ids = new Set(SM_CARDS.map((c) => c.id as string));
    for (const d of SM_STARTER_DECKS) {
      expect(ids.has(d.identityCardId as string), d.id as string).toBe(true);
      expect(d.aspects, d.id as string).toHaveLength(1);
    }
  });

  // Precons for nova/ironheart/spiderham/spdr belong to a separate pass (docs/phase7-wave5-sources.md §5/§7.1) —
  // deliberately not asserted here, so this file doesn't need to change when they land.
});

describe("Sinister Motives — campaign record", () => {
  it("SM_CAMPAIGN passes validateCampaign()", () => {
    const outcome = validateCampaign(SM_CAMPAIGN);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("every scenario SM_CAMPAIGN names is registered and belongs to sm, in box order, no duplicates", () => {
    const byId = new Map(SM_SCENARIOS.map((s) => [s.id as string, s]));
    expect(SM_CAMPAIGN.scenarioIds.map((id) => id as string)).toEqual([
      "sandman",
      "venom",
      "mysterio",
      "sinister-six",
      "venom-goblin",
    ]);
    for (const scenarioId of SM_CAMPAIGN.scenarioIds) {
      const scenario = byId.get(scenarioId as string);
      expect(scenario, `scenario ${scenarioId} is not registered`).toBeDefined();
      expect(scenario?.packCode, `scenario ${scenarioId} pack`).toBe(SM_CAMPAIGN.packCode);
    }
    expect(new Set(SM_CAMPAIGN.scenarioIds).size).toBe(SM_CAMPAIGN.scenarioIds.length);
  });

  it("every set SM_CAMPAIGN names is registered and campaignSpecific, with no duplicates", () => {
    const byId = new Map(SM_ENCOUNTER_SETS.map((s) => [s.id as string, s]));
    for (const setId of SM_CAMPAIGN.campaignSetIds) {
      const set = byId.get(setId as string);
      expect(set, `set ${setId} is not registered`).toBeDefined();
      expect(set?.campaignSpecific, `set ${setId} must be campaignSpecific`).toBe(true);
    }
    expect(new Set(SM_CAMPAIGN.campaignSetIds).size).toBe(SM_CAMPAIGN.campaignSetIds.length);
  });

  it("SM_CAMPAIGN's prohibited cardIds/encounterSetIds resolve to real records (MC27 p. 4)", () => {
    const cardIds = new Set(SM_CARDS.map((c) => c.id as string));
    const setIds = new Set(SM_ENCOUNTER_SETS.map((s) => s.id as string));
    for (const id of SM_CAMPAIGN.prohibited?.cardIds ?? []) {
      expect(cardIds.has(id as string), `prohibited card ${id}`).toBe(true);
    }
    for (const id of SM_CAMPAIGN.prohibited?.encounterSetIds ?? []) {
      expect(setIds.has(id as string), `prohibited encounter set ${id}`).toBe(true);
    }
  });

  it("prohibited cards (Venom (Eddie Brock), Symbiote Suit) are not themselves campaign-specific", () => {
    const cardsById = new Map(SM_CARDS.map((c) => [c.id as string, c]));
    for (const id of SM_CAMPAIGN.prohibited?.cardIds ?? []) {
      const card = cardsById.get(id as string);
      expect(card, id as string).toBeDefined();
      expect(
        "specificTo" in (card as object) ? (card as { specificTo?: unknown }).specificTo : undefined,
        id as string,
      ).toBeUndefined();
    }
  });

  it("every campaign-specific encounter set's own cards belong only to campaign-specific sets", () => {
    const campaignSetIds = new Set(SM_ENCOUNTER_SETS.filter((s) => s.campaignSpecific).map((s) => s.id as string));
    for (const card of SM_CARDS) {
      if (!("encounterSetIds" in card)) continue;
      const setIds = (card as { encounterSetIds: readonly unknown[] }).encounterSetIds.map((id) => id as string);
      const inCampaignSet = setIds.some((id) => campaignSetIds.has(id));
      if (!inCampaignSet) continue;
      for (const id of setIds) {
        expect(campaignSetIds.has(id), `${card.id as string} mixes a campaign-specific and ordinary set`).toBe(true);
      }
    }
  });

  it("every S.H.I.E.L.D. Tech player card (182-189) is specificTo the campaign's own shield_tech set", () => {
    const shieldTechCards = SM_CARDS.filter(
      (c) => "specificTo" in c && (c as { specificTo?: { kind?: string } }).specificTo?.kind === "campaign",
    );
    expect(shieldTechCards.length).toBe(8);
    for (const card of shieldTechCards) {
      const specificTo = (card as { specificTo: { encounterSetId: unknown } }).specificTo;
      expect(specificTo.encounterSetId as string, card.id as string).toBe("shield_tech");
    }
  });
});

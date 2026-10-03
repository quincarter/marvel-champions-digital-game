import { describe, expect, it } from "vitest";
import {
  campaignId,
  cardId,
  encounterSetId,
  scenarioId,
  setCode,
  trait,
  validateAttachmentHost,
  validateCampaign,
  validateCard,
  validateScenario,
} from "./index.js";
import type { AnyCard, Campaign, CampaignRole, CardId, Scenario } from "./index.js";
import { WAVE6_CARDS } from "../data/index.js";

/**
 * docs/phase7-wave6.md §1: the schema additions the Mutant Genesis box (MC32) needs. Fixtures are trimmed to what each
 * rule needs; they are not curated data.
 *
 * Sources: MC32 pp. 4–5 (roles), Master Mold 1A (32112a) Setup, Targeted for Elimination (32107).
 */

describe("§1.1 Campaign.roles", () => {
  const role = (id: string, set: string, aspects: CampaignRole["aspects"]): CampaignRole => ({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    encounterSetId: encounterSetId(set),
    aspects,
  });
  const ROLES: readonly CampaignRole[] = [
    role("brawler", "brawler", ["aggression", "protection"]),
    role("commander", "commander", ["aggression", "leadership"]),
    role("defender", "defender", ["justice", "protection"]),
    role("peacekeeper", "peacekeeper", ["justice", "leadership"]),
  ];
  const campaign: Campaign = {
    id: campaignId("mut_gen"),
    name: "Mutant Genesis",
    boxCode: "MC32",
    packCode: setCode("mut_gen"),
    scenarioIds: [scenarioId("sabretooth")],
    campaignSetIds: ["mut_gen_campaign", "brawler", "commander", "defender", "peacekeeper"].map(encounterSetId),
    roles: ROLES,
    logSheetReference: "docs/campaign-modes/log-sheets/mc32_mutant_genesis_campaign_log.pdf",
  };
  const withRoles = (roles: unknown): Campaign => ({ ...campaign, roles: roles as readonly CampaignRole[] });

  it("MC32 p. 5's four roles validate, and a campaign without roles is unchanged", () => {
    expect(validateCampaign(campaign).errors).toEqual([]);
    const { roles: _roles, ...noRoles } = campaign;
    expect(validateCampaign(noRoles).errors).toEqual([]);
  });

  it("an empty campaignSetIds list is allowed (MojoMania names none), a missing one is not", () => {
    const { roles: _roles, ...noRoles } = campaign;
    expect(validateCampaign({ ...noRoles, campaignSetIds: [] }).errors).toEqual([]);
    expect(validateCampaign({ ...campaign, campaignSetIds: undefined as never }).errors).toContain(
      "campaign mut_gen must list its campaign-specific sets (an empty list for none)",
    );
  });

  it("an empty or non-array roles field is refused", () => {
    for (const bad of [[], "brawler"]) {
      expect(validateCampaign(withRoles(bad)).errors).toEqual([
        "campaign mut_gen roles must be a non-empty array when present",
      ]);
    }
  });

  it("a role's set must be one of the campaign's campaignSetIds", () => {
    expect(validateCampaign(withRoles([role("brawler", "future_past", ["aggression", "protection"])])).errors).toEqual([
      "campaign mut_gen role brawler encounterSetId future_past is not one of its campaignSetIds",
    ]);
  });

  it("role ids are unique, and id, name and set are required", () => {
    expect(validateCampaign(withRoles([ROLES[0], ROLES[0]])).errors).toEqual([
      "campaign mut_gen lists role brawler twice",
    ]);
    expect(validateCampaign(withRoles([{ aspects: ["aggression", "protection"] }])).errors).toEqual([
      "campaign mut_gen role #0 missing id",
      "campaign mut_gen role #0 missing name",
      "campaign mut_gen role #0 missing encounterSetId",
    ]);
  });

  it("a role pairs exactly two different choosable aspects", () => {
    expect(validateCampaign(withRoles([role("brawler", "brawler", ["aggression", "aggression"])])).errors).toEqual([
      "campaign mut_gen role brawler must pair two different aspects",
    ]);
    expect(
      validateCampaign(withRoles([{ ...ROLES[0], aspects: ["aggression", "protection", "justice"] }])).errors,
    ).toEqual(["campaign mut_gen role brawler must list exactly two aspects"]);
    expect(validateCampaign(withRoles([role("brawler", "brawler", ["aggression", "basic"])])).errors).toEqual([
      "campaign mut_gen role brawler aspect 'basic' must be Aggression, Justice, Leadership, Protection or 'Pool",
    ]);
  });
});

describe("§1.8 Scenario.setAsideCardIds", () => {
  const masterMold: Scenario = {
    id: scenarioId("master_mold"),
    name: "Master Mold",
    packCode: setCode("mut_gen"),
    villainCardId: cardId("32110"),
    mainSchemeCardId: cardId("32112a"),
    encounterSetIds: [encounterSetId("master_mold")],
    recommendedModularSetIds: [],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    setAsideCardIds: [cardId("32172b")],
  };
  const withIds = (ids: unknown): Scenario => ({ ...masterMold, setAsideCardIds: ids as readonly CardId[] });

  it("Master Mold's Magneto ally (172B) validates, and absent is unchanged", () => {
    expect(validateScenario(masterMold).errors).toEqual([]);
    const { setAsideCardIds: _ids, ...plain } = masterMold;
    expect(validateScenario(plain).errors).toEqual([]);
  });

  it("an empty list, a non-list or a blank id is refused", () => {
    for (const bad of [[], "32172b", [""]]) {
      expect(validateScenario(withIds(bad)).errors).toEqual([
        "scenario setAsideCardIds must be a non-empty list of card ids when present",
      ]);
    }
  });

  it("a card listed twice is refused", () => {
    expect(validateScenario(withIds(["32172b", "32172b"])).errors).toEqual([
      "scenario setAsideCardIds lists a card twice",
    ]);
  });

  it("the villains and the main scheme keep their own fields", () => {
    expect(validateScenario(withIds(["32110", "32112a"])).errors).toEqual([
      "scenario setAsideCardIds lists villain 32110; use setAsideVillainCardIds",
      "scenario setAsideCardIds lists the main scheme 32112a",
    ]);
    const kangLike: Scenario = {
      ...masterMold,
      setAsideVillainCardIds: [cardId("32111")],
      expertVillains: { villainCardId: cardId("32110b"), setAsideVillainCardIds: [cardId("32111b")] },
      setAsideCardIds: ["32111", "32110b", "32111b"].map(cardId),
    };
    expect(validateScenario(kangLike).errors).toEqual([
      "scenario setAsideCardIds lists villain 32111; use setAsideVillainCardIds",
      "scenario setAsideCardIds lists villain 32110b; use setAsideVillainCardIds",
      "scenario setAsideCardIds lists villain 32111b; use setAsideVillainCardIds",
    ]);
  });
});

describe("§1.3 the yourIdentity host's withoutAttachmentNamed qualifier", () => {
  it("Targeted for Elimination's host validates, with and without a form", () => {
    const host = { kind: "yourIdentity", withoutAttachmentNamed: "Targeted for Elimination" };
    expect(validateAttachmentHost(host, "32107")).toEqual([]);
    expect(validateAttachmentHost({ ...host, form: "hero" }, "32107")).toEqual([]);
  });

  it("a blank or non-string name is refused", () => {
    for (const bad of ["", 7]) {
      expect(validateAttachmentHost({ kind: "yourIdentity", withoutAttachmentNamed: bad }, "32107")).toEqual([
        "32107 yourIdentity host withoutAttachmentNamed must be a non-empty string when present",
      ]);
    }
  });
});

/**
 * docs/phase7-wave6.md §3.28: "Max 1 TRAINING upgrade per ally." / "Max 1 TEAM card per player." count cards with a
 * trait, not copies by title (RRG 1.8 "Max, Maximum", p. 28), so they are `playRestrictions.maxWithTrait`.
 */
describe("§3.28 PlayRestrictions.maxWithTrait", () => {
  const TRAINING_UPGRADES = ["32013", "32043", "33015", "34016"];

  it("is emitted on the four TRAINING upgrades, per host, and their only constant is the stat bonus", () => {
    for (const code of TRAINING_UPGRADES) {
      const card = WAVE6_CARDS.find((c) => c.id === cardId(code));
      expect(card?.type, code).toBe("upgrade");
      if (card?.type !== "upgrade") continue;
      expect(card.playRestrictions, code).toEqual({ maxWithTrait: { trait: trait("TRAINING"), per: "host", max: 1 } });
      expect(card.abilities, code).toHaveLength(1);
      expect(validateCard(card).errors, code).toEqual([]);
    }
  });

  it("validates its trait, per and max, and per host only on an upgrade", () => {
    const upgrade = WAVE6_CARDS.find((c) => c.id === cardId("33015"));
    if (upgrade?.type !== "upgrade") throw new Error("33015 is an upgrade");
    const restrict = (maxWithTrait: unknown): AnyCard =>
      ({ ...upgrade, playRestrictions: { maxWithTrait } }) as unknown as AnyCard;
    expect(validateCard(restrict({ trait: trait("TEAM"), per: "player", max: 1 })).errors).toEqual([]);
    expect(validateCard(restrict({ trait: "", per: "host", max: 1 })).errors).toContain(
      "playRestrictions.maxWithTrait.trait must be a trait",
    );
    expect(validateCard(restrict({ trait: trait("TRAINING"), per: "ally", max: 1 })).errors).toContain(
      "playRestrictions.maxWithTrait.per must be 'host' or 'player'",
    );
    expect(validateCard(restrict({ trait: trait("TRAINING"), per: "host", max: 0 })).errors).toContain(
      "playRestrictions.maxWithTrait.max must be a positive integer",
    );
    const support = WAVE6_CARDS.find((c) => c.type === "support");
    if (!support || support.type !== "support") throw new Error("no support");
    const perHostSupport = {
      ...support,
      playRestrictions: { maxWithTrait: { trait: trait("TEAM"), per: "host", max: 1 } },
    } as AnyCard;
    expect(validateCard(perHostSupport).errors).toContain(
      "playRestrictions.maxWithTrait per host is only for an upgrade",
    );
  });
});

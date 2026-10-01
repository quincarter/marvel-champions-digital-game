import { describe, expect, it } from "vitest";
import {
  campaignId,
  cardId,
  encounterSetId,
  scenarioId,
  setCode,
  validateAttachmentHost,
  validateCampaign,
  validateScenario,
} from "./index.js";
import type { Campaign, CampaignRole, CardId, Scenario } from "./index.js";

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

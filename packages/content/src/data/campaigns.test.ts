import { describe, expect, it } from "vitest";
import { validateCampaign } from "../schema/index.js";
import { CAMPAIGNS, WAVE2_ENCOUNTER_SETS, WAVE2_SCENARIOS, WAVE3_ENCOUNTER_SETS, WAVE3_SCENARIOS } from "./index.js";

/** Scenarios/encounter sets a campaign might reference, across every wave that has ingested a `Campaign` record. */
const ALL_SCENARIOS = [...WAVE2_SCENARIOS, ...WAVE3_SCENARIOS];
const ALL_ENCOUNTER_SETS = [...WAVE2_ENCOUNTER_SETS, ...WAVE3_ENCOUNTER_SETS];

/**
 * docs/campaign-mode-design.md §11 step 6, §9.1 row 1: every `Campaign` content record `@mc/content` emits must be
 * structurally valid and must reference only sets and scenarios that actually exist in the current data — a
 * `Campaign` naming a scenario or encounter set the pool doesn't have would be exactly the kind of bug this
 * package's ingestion discipline exists to catch before it reaches `@mc/cards` or the engine.
 */
describe("Campaign content records", () => {
  it("validateCampaign passes for every emitted campaign", () => {
    for (const campaign of CAMPAIGNS) {
      const outcome = validateCampaign(campaign);
      expect(outcome.errors, campaign.id as string).toEqual([]);
      expect(outcome.valid, campaign.id as string).toBe(true);
    }
  });

  it("every scenario a campaign names is registered and belongs to the campaign's own pack", () => {
    const byId = new Map(ALL_SCENARIOS.map((s) => [s.id as string, s]));
    for (const campaign of CAMPAIGNS) {
      for (const scenarioId of campaign.scenarioIds) {
        const scenario = byId.get(scenarioId as string);
        expect(scenario, `${campaign.id}: scenario ${scenarioId} is not registered`).toBeDefined();
        expect(scenario?.packCode, `${campaign.id}: scenario ${scenarioId} pack`).toBe(campaign.packCode);
      }
    }
  });

  it("every set a campaign names (campaignSetIds and perSeatSetIds) is registered and campaignSpecific", () => {
    const byId = new Map(ALL_ENCOUNTER_SETS.map((s) => [s.id as string, s]));
    for (const campaign of CAMPAIGNS) {
      for (const setId of [...campaign.campaignSetIds, ...(campaign.perSeatSetIds ?? [])]) {
        const set = byId.get(setId as string);
        expect(set, `${campaign.id}: set ${setId} is not registered`).toBeDefined();
        expect(set?.campaignSpecific, `${campaign.id}: set ${setId} must be campaignSpecific`).toBe(true);
      }
    }
  });

  it("scenarioIds and campaignSetIds have no duplicates", () => {
    for (const campaign of CAMPAIGNS) {
      expect(new Set(campaign.scenarioIds).size, campaign.id as string).toBe(campaign.scenarioIds.length);
      expect(new Set(campaign.campaignSetIds).size, campaign.id as string).toBe(campaign.campaignSetIds.length);
    }
  });

  it("only campaign boxes with data actually ingested are present (MC10, MC16 today; see data/index.ts CAMPAIGNS doc)", () => {
    expect(CAMPAIGNS.map((c) => c.id as string)).toEqual(["trors", "gmw"]);
  });
});

import { describe, expect, it } from "vitest";
import { matchesModes } from "@mc/content";
import { SYNTHETIC_CAMPAIGN, SYNTHETIC_CAMPAIGN_LOG, SYNTHETIC_EXTRAS_CAMPAIGN } from "./testing/campaign.js";
import type { CampaignDefinition, CampaignLog } from "./campaign.js";

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("campaign types are plain serializable data", () => {
  it("round-trips a campaign definition through JSON unchanged", () => {
    const after: CampaignDefinition = roundTrip(SYNTHETIC_CAMPAIGN);
    expect(after).toEqual(SYNTHETIC_CAMPAIGN);
  });

  it("round-trips the second definition, whose members the first has no reason to use, through JSON unchanged", () => {
    const after: CampaignDefinition = roundTrip(SYNTHETIC_EXTRAS_CAMPAIGN);
    expect(after).toEqual(SYNTHETIC_EXTRAS_CAMPAIGN);
  });

  it("round-trips a campaign log through JSON unchanged", () => {
    const after: CampaignLog = roundTrip(SYNTHETIC_CAMPAIGN_LOG);
    expect(after).toEqual(SYNTHETIC_CAMPAIGN_LOG);
  });

  it("keeps the history's pre-node snapshot, which a retry restores (RRG 1.8 p. 29)", () => {
    const after = roundTrip(SYNTHETIC_CAMPAIGN_LOG);
    const entry = after.history[0];
    expect(entry?.logBefore.rng).toEqual({ value: 4242, draws: 0 });
    // The card removed from the campaign is *not* in the baseline, so restoring the baseline cannot bring it back.
    expect(entry?.logBefore.removedFromCampaign).toEqual([]);
    expect(after.removedFromCampaign).toEqual([{ cardId: "syn-relic-b" }]);
  });

  it("carries the campaign RNG seed beside its advancing state", () => {
    expect(SYNTHETIC_CAMPAIGN_LOG.seed).toBe(SYNTHETIC_CAMPAIGN_LOG.rng.value);
    expect(SYNTHETIC_CAMPAIGN_LOG.rng.draws).toBeGreaterThan(0);
  });
});

describe("the synthetic fixture exercises the shapes the first box does not", () => {
  it("branches rather than running a fixed order", () => {
    expect(SYNTHETIC_CAMPAIGN.graph.kind).toBe("choice");
    expect(SYNTHETIC_CAMPAIGN.graph.nodes.map((node) => node.id)).toEqual(["alpha", "omega"]);
  });

  it("places instructions at windows other than the default", () => {
    const windows = SYNTHETIC_CAMPAIGN.graph.nodes
      .flatMap((node) => node.setup)
      .map((instruction) => (instruction.step.kind === "inGame" ? instruction.step.window : null));
    expect(windows).toContain("afterMulligans");
    expect(windows).toContain("beforePlayerSetup");
  });

  it("declares a per-seat number, a strike list and a hidden field", () => {
    const byId = Object.fromEntries(SYNTHETIC_CAMPAIGN.logFields.map((field) => [field.id, field]));
    expect(byId["stamina"]).toMatchObject({ scope: "perSeat", type: { kind: "number" } });
    expect(byId["errands"]?.type.kind).toBe("strikeList");
    expect(byId["saboteur"]?.hidden).toBe(true);
    // The hidden value lives only in `CampaignLog.hidden`, never in `shared` (design Q4; MC50 p. 5's envelope).
    expect(SYNTHETIC_CAMPAIGN_LOG.hidden["saboteur"]).toBeDefined();
    expect(SYNTHETIC_CAMPAIGN_LOG.shared["saboteur"]).toBeUndefined();
  });

  it("prints a defeat block, which seven of the nine boxes do not (MC50 p. 19; MC60 p. 13)", () => {
    expect(SYNTHETIC_CAMPAIGN.loss.retry).toBe("byInstruction");
    expect(SYNTHETIC_CAMPAIGN.graph.nodes.every((node) => (node.defeat?.length ?? 0) > 0)).toBe(true);
  });

  it("gates an instruction on expert campaign mode independently of expert mode (design Q1)", () => {
    const gated = SYNTHETIC_CAMPAIGN.graph.nodes
      .flatMap((node) => [...node.setup, ...node.victory, ...(node.defeat ?? [])])
      .filter((instruction) => instruction.whenModes?.expertCampaign === true);
    expect(gated.length).toBeGreaterThan(0);
    const gate = gated[0]?.whenModes;
    expect(matchesModes({ expert: true }, gate)).toBe(false);
    expect(matchesModes({ campaign: { campaignId: SYNTHETIC_CAMPAIGN.campaignId, expertCampaign: true } }, gate)).toBe(
      true,
    );
  });

  it("names a conditional instruction the log itself switches on (MC27 p. 22)", () => {
    const named = SYNTHETIC_CAMPAIGN_LOG.shared["favors"];
    expect(named?.kind).toBe("instructionList");
    const ids = named?.kind === "instructionList" ? named.ids : [];
    for (const id of ids) expect(SYNTHETIC_CAMPAIGN.conditionalInstructions?.[id]).toBeDefined();
  });

  it("names no real campaign, scenario or card", () => {
    const text = JSON.stringify([SYNTHETIC_CAMPAIGN, SYNTHETIC_CAMPAIGN_LOG]);
    for (const id of text.matchAll(/"(syn-[a-z-]+)"/g)) expect(id[1]).toMatch(/^syn-/);
    expect(text).not.toMatch(/"0[0-9]{4}[ab]?"/);
  });
});

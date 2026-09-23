import { describe, expect, test } from "vitest";
import { CAMPAIGN_LOG_SCHEMA, type CampaignDefinition } from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { CampaignSummary } from "../engine/campaign-storage.js";
import { campaignSagaRows, defaultFeaturedVolume, doneVolumeCount, openVolumeCount } from "./campaign-saga-model.js";

const trorsSummary = (overrides: Partial<CampaignSummary> = {}): CampaignSummary => ({
  id: "c1",
  campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId,
  recordSchema: 1,
  schema: CAMPAIGN_LOG_SCHEMA,
  definitionVersion: TRORS_CAMPAIGN_DEFINITION.version,
  name: "The Rise of Red Skull",
  box: "MC10",
  status: "active",
  modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
  position: {
    nextNodeId: "taskmaster",
    resolved: { crossbones: "completed", "absorbing-man": "completed" },
    progress: {},
  },
  seats: [
    { seatNumber: 1, identityCardId: "04001a" },
    { seatNumber: 2, identityCardId: "04031a" },
  ],
  createdAt: 1,
  updatedAt: 5,
  ...overrides,
});

const lookup = (id: string): CampaignDefinition | undefined =>
  id === (TRORS_CAMPAIGN_DEFINITION.campaignId as string) ? TRORS_CAMPAIGN_DEFINITION : undefined;
const nameOf = (id: string): string => ({ "04001a": "Hawkeye", "04031a": "Spider-Woman" })[id] ?? id;

describe("campaignSagaRows", () => {
  test("volume 1 is always open; the rest are sealed with no runs at all", () => {
    const rows = campaignSagaRows([], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows).toHaveLength(9);
    expect(rows[0]).toMatchObject({ status: "fresh", unlocked: true, hasDefinition: true, lockReason: null });
    for (const row of rows.slice(1)) {
      expect(row.status).toBe("sealed");
      expect(row.unlocked).toBe(false);
    }
    // Vol. 2 isn't unlocked yet either way, so the generic "Sealed" chip covers it — no need to say more.
    expect(rows[1]!.lockReason).toBeNull();
  });

  test("an active run reads live, with issue number and pips from the real graph", () => {
    const rows = campaignSagaRows([trorsSummary()], { definitionOf: lookup, identityNameOf: nameOf });
    const vol1 = rows[0]!;
    expect(vol1.status).toBe("live");
    expect(vol1.runId).toBe("c1");
    expect(vol1.issueNumber).toBe(3);
    expect(vol1.totalIssues).toBe(5);
    expect(vol1.pips).toEqual(["done", "done", "current", "empty", "empty"]);
    expect(vol1.rosterNames).toEqual(["Hawkeye", "Spider-Woman"]);
  });

  test("a won-on-standard run opens volume 2 — but it stays sealed for lack of a definition", () => {
    const won = trorsSummary({ id: "c2", status: "won", position: { nextNodeId: null, resolved: {}, progress: {} } });
    const rows = campaignSagaRows([won], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows[0]).toMatchObject({ status: "done", runId: "c2", wonStandard: true, wonExpert: false });
    expect(rows[0]!.pips).toEqual(["done", "done", "done", "done", "done"]);
    // Vol. 2's unlock rule is satisfied, but honesty about content wins: still "not in this build yet".
    expect(rows[1]).toMatchObject({ status: "sealed", unlocked: true, lockReason: "Not in this build yet" });
    expect(doneVolumeCount(rows)).toBe(1);
  });

  test("a won-on-expert run does not itself open the next volume — only Standard does", () => {
    const won = trorsSummary({
      id: "c3",
      status: "won",
      modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } },
      position: { nextNodeId: null, resolved: {}, progress: {} },
    });
    const rows = campaignSagaRows([won], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows[0]).toMatchObject({ wonStandard: false, wonExpert: true });
    expect(rows[1]!.unlocked).toBe(false);
    expect(rows[1]!.lockReason).toBeNull();
  });

  test("an incompatible active run is not resumable", () => {
    const stale = trorsSummary({ definitionVersion: "stale" });
    const rows = campaignSagaRows([stale], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows[0]!.status).toBe("live");
    expect(rows[0]!.canResume).toBe(false);
    expect(rows[0]!.incompatibleReason).toMatch(/version/);
  });

  test("defaultFeaturedVolume prefers a live run, then a fresh one, then Vol. 1", () => {
    expect(defaultFeaturedVolume(campaignSagaRows([], { definitionOf: lookup, identityNameOf: nameOf }))).toBe(1);
    expect(
      defaultFeaturedVolume(campaignSagaRows([trorsSummary()], { definitionOf: lookup, identityNameOf: nameOf })),
    ).toBe(1);
  });

  test("openVolumeCount is 1 with nothing played, in a build with only MC10", () => {
    const rows = campaignSagaRows([], { definitionOf: lookup, identityNameOf: nameOf });
    expect(openVolumeCount(rows)).toBe(1);
    expect(doneVolumeCount(rows)).toBe(0);
  });
});

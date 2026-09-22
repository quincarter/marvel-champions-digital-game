import { describe, expect, test } from "vitest";
import { campaignId } from "@mc/content";
import { CAMPAIGN_LOG_SCHEMA, type CampaignDefinition } from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { CampaignSummary } from "../engine/campaign-storage.js";
import { campaignListRows } from "./campaign-list-model.js";

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
  position: { nextNodeId: "crossbones", resolved: {}, progress: {} },
  seats: [
    { seatNumber: 1, identityCardId: "hawkeye" },
    { seatNumber: 2, identityCardId: "spider-woman" },
  ],
  createdAt: 1,
  updatedAt: 5,
  ...overrides,
});

const lookup = (id: string): CampaignDefinition | undefined =>
  id === (TRORS_CAMPAIGN_DEFINITION.campaignId as string) ? TRORS_CAMPAIGN_DEFINITION : undefined;

describe("campaignListRows: MC10's real definition", () => {
  test("a fresh campaign reads as scenario 1 of 5, resumable", () => {
    const [row] = campaignListRows([trorsSummary()], lookup);
    expect(row).toMatchObject({
      id: "c1",
      name: "The Rise of Red Skull",
      box: "MC10",
      positionLabel: "Scenario 1 of 5",
      canResume: true,
      canAbandon: true,
      incompatibleReason: null,
    });
  });

  test("mid-campaign position reads from the graph, not a stored index", () => {
    const summary = trorsSummary({
      position: {
        nextNodeId: "taskmaster",
        resolved: { crossbones: "completed", "absorbing-man": "completed" },
        progress: {},
      },
    });
    const [row] = campaignListRows([summary], lookup);
    expect(row?.positionLabel).toBe("Scenario 3 of 5");
  });

  test("a won campaign reads as completed, not resumable, still exportable", () => {
    const summary = trorsSummary({
      status: "won",
      position: {
        nextNodeId: null,
        resolved: Object.fromEntries(
          ["crossbones", "absorbing-man", "taskmaster", "zola", "red-skull"].map((id) => [id, "completed"]),
        ),
        progress: {},
      },
    });
    const [row] = campaignListRows([summary], lookup);
    expect(row).toMatchObject({
      positionLabel: "5 of 5 completed",
      status: "won",
      canResume: false,
      canAbandon: false,
    });
  });

  test("list order is preserved, not re-sorted", () => {
    const rows = campaignListRows(
      [trorsSummary({ id: "older", updatedAt: 1 }), trorsSummary({ id: "newer", updatedAt: 9 })],
      lookup,
    );
    expect(rows.map((row) => row.id)).toEqual(["older", "newer"]);
  });
});

describe("campaignListRows: incompatibility, checked against a synthetic lookup (never re-derived from rules)", () => {
  test("a campaign this build has no content for is flagged and not resumable", () => {
    const [row] = campaignListRows([trorsSummary({ campaignId: campaignId("unshipped-box") })], () => undefined);
    expect(row?.positionLabel).toBe("Unknown campaign");
    expect(row?.canResume).toBe(false);
    expect(row?.incompatibleReason).toMatch(/no "MC10" campaign content/);
  });

  test("a log-schema mismatch is flagged even though a matching definition exists", () => {
    const [row] = campaignListRows([trorsSummary({ schema: CAMPAIGN_LOG_SCHEMA + 1 })], lookup);
    expect(row?.canResume).toBe(false);
    expect(row?.incompatibleReason).toMatch(/older log format/);
  });

  test("a definitionVersion mismatch is flagged, quoting both versions", () => {
    const [row] = campaignListRows([trorsSummary({ definitionVersion: "0" })], lookup);
    expect(row?.canResume).toBe(false);
    expect(row?.incompatibleReason).toContain("was version 0");
    expect(row?.incompatibleReason).toContain(`this build has ${TRORS_CAMPAIGN_DEFINITION.version}`);
  });

  test("a finished campaign is never flagged incompatible, even with a stale stamp", () => {
    const [row] = campaignListRows([trorsSummary({ status: "abandoned", schema: CAMPAIGN_LOG_SCHEMA + 1 })], lookup);
    expect(row?.incompatibleReason).toBeNull();
    expect(row?.canAbandon).toBe(false);
  });
});

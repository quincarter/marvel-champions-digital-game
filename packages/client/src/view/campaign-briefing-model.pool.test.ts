/**
 * `briefingViewOf`'s own pool wiring against MC21 (`campaign-pool-model.test.ts` already exercises
 * `campaignBriefingPool` directly; this file only proves the Briefing view model calls it with the right node).
 */
import { describe, expect, it } from "vitest";
import { createCampaignLog, type CampaignAttempt, type CampaignLog } from "@mc/engine";
import { MTS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { cardId } from "@mc/content";
import { briefingViewOf, handledRowsOf } from "./campaign-briefing-model.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";

const cardName = (id: string): string => id;
const nodeIds = MTS_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id);

function recordAt(
  nodeId: string,
  shared: Record<string, { readonly kind: "flag"; readonly value: boolean }>,
): CampaignRecord {
  const log: CampaignLog = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
    id: "mts-briefing-test",
    poolVersion: "test",
    modes: { campaign: { campaignId: MTS_CAMPAIGN_DEFINITION.campaignId } },
    seats: [
      {
        seatNumber: 1,
        identityCardId: cardId("21001a"),
        deck: { identityCardId: cardId("21001a"), aspects: [], cards: [] },
      },
    ],
    seed: 1,
  });
  const attempt = {
    nodeId,
    modes: { expert: false },
    logBefore: log,
    steps: [],
    input: { instructions: [] },
    composedVillain: null,
    composedEncounterSets: { deck: [], setAside: [] },
  } as unknown as CampaignAttempt;
  return {
    ...log,
    shared,
    attempt,
    recordSchema: 1,
    name: "The Mad Titan's Shadow",
    box: "MC21",
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("handledRowsOf's own MC21 grants row", () => {
  const mtsCardName = (id: string): string => ({ "21183": "Shawarma", "04157": "Emergency Teleporter" })[id] ?? id;

  it("never names a pool card (Shawarma) — 'From the pool' already shows it, correctly", () => {
    const record = recordAt("thanos", { shawarmaInPool: { kind: "flag", value: true } });
    const attempt = {
      ...record.attempt!,
      steps: [],
    };
    const withGrant: CampaignRecord = {
      ...record,
      attempt,
      seats: [
        {
          ...record.seats[0]!,
          grants: [{ cardId: cardId("21183"), permanence: "thisGame", grantedAtNodeId: "tower-defense" }],
        },
      ],
    };
    const rows = handledRowsOf(attempt, withGrant, mtsCardName, MTS_CAMPAIGN_DEFINITION, nodeIds);
    expect(rows.find((row) => row.key === "grants")).toBeUndefined();
  });

  it("still names a real start-in-play grant (not a pool card)", () => {
    const record = recordAt("ebony-maw", {});
    const attempt = { ...record.attempt!, steps: [] };
    const withGrant: CampaignRecord = {
      ...record,
      attempt,
      seats: [
        {
          ...record.seats[0]!,
          grants: [{ cardId: cardId("04157"), permanence: "campaign", grantedAtNodeId: "ebony-maw" }],
        },
      ],
    };
    const rows = handledRowsOf(attempt, withGrant, mtsCardName, MTS_CAMPAIGN_DEFINITION, nodeIds);
    const grantsRow = rows.find((row) => row.key === "grants");
    expect(grantsRow?.detail).toContain("Emergency Teleporter");
  });
});

describe("handledRowsOf's briefingNotes override", () => {
  it("replaces the generic assembly entirely when notes are given", () => {
    const record = recordAt("thanos", { cosmoInPool: { kind: "flag", value: true } });
    const rows = handledRowsOf(record.attempt!, record, cardName, MTS_CAMPAIGN_DEFINITION, nodeIds, [
      { status: "done", title: "Pool resolved in printed order", detail: "Allies first.", citation: "MC21 p. 17" },
    ]);
    expect(rows).toEqual([
      {
        key: "note:0",
        status: "done",
        title: "Pool resolved in printed order",
        detail: "Allies first.",
        citation: "MC21 p. 17",
      },
    ]);
  });

  it("falls back to the generic assembly when there are no notes", () => {
    const record = recordAt("thanos", {});
    const rows = handledRowsOf(record.attempt!, record, cardName, MTS_CAMPAIGN_DEFINITION, nodeIds, []);
    expect(rows.some((row) => row.key.startsWith("note:"))).toBe(false);
  });
});

describe("briefingViewOf's pool section", () => {
  it("is null for issue #1", () => {
    const record = recordAt("ebony-maw", {});
    const view = briefingViewOf(record, cardName, 1, MTS_CAMPAIGN_DEFINITION, nodeIds);
    expect(view!.pool).toBeNull();
  });

  it("issue #3 shows the four cards resolved by then", () => {
    const record = recordAt("thanos", {
      cosmoInPool: { kind: "flag", value: true },
      securityBreachInPool: { kind: "flag", value: true },
      shawarmaInPool: { kind: "flag", value: true },
      blackSwanInPool: { kind: "flag", value: true },
    });
    const view = briefingViewOf(record, cardName, 3, MTS_CAMPAIGN_DEFINITION, nodeIds);
    expect(view!.pool!.rows.map((row) => row.name)).toEqual(["Cosmo", "Security Breach", "Shawarma", "Black Swan"]);
    expect(view!.pool!.groups).toBeNull();
  });

  it("the finale (loki) groups by destination", () => {
    const record = recordAt("loki", {
      cosmoInPool: { kind: "flag", value: true },
      odinInPool: { kind: "flag", value: true },
    });
    const view = briefingViewOf(record, cardName, 5, MTS_CAMPAIGN_DEFINITION, nodeIds);
    expect(view!.pool!.groups).not.toBeNull();
    expect(view!.pool!.groups!.map((g) => g.title)).toEqual(["Into play"]);
  });
});

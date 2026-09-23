import { describe, expect, test } from "vitest";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun } from "../campaign/dev-fixtures.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { rewindViewOf } from "./campaign-rewind-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

const issueNumberOf = (nodeId: string): number =>
  TRORS_CAMPAIGN_DEFINITION.graph.kind === "linear"
    ? TRORS_CAMPAIGN_DEFINITION.graph.nodes.findIndex((node) => node.id === nodeId) + 1
    : 0;

describe("campaign-rewind-model", () => {
  test("a lost issue #2 with a card spent this game: kept issue #1, gone the spent card", async () => {
    const record = await seedDesignRun(service(), "lostIssue3");
    // `seedDesignRun`'s issue #2 attempt was lost once before it was retried and won (see its own header comment),
    // so this exercises exactly the same shape as the design's rewind tile: `record.history` already has the
    // lost `absorbing-man` attempt in it by the time issue #3 is lost too.
    const lostEntry = record.history.find((entry) => entry.nodeId === "absorbing-man" && entry.outcome === "lost");
    expect(lostEntry).toBeDefined();

    const view = rewindViewOf(record, "taskmaster", issueNumberOf, CARDS_BY_ID);
    expect(view.campaignLost).toBe(false);
    expect(view.issueNumber).toBe(3);
    expect(view.keptSummary).toBe("Everything from issues #1–2.");
    // Nothing was removed from the campaign during the lost issue #3 attempt in this fixture (MC10's first three
    // issues never remove a card) — the "GONE" list is honestly empty rather than invented.
    expect(view.gone).toEqual([]);
  });

  test("issue #1 has nothing to keep yet", () => {
    const emptyRecord = {
      status: "active" as const,
      removedFromCampaign: [],
      history: [
        {
          nodeId: "crossbones",
          modes: {},
          outcome: "lost" as const,
          gameId: null,
          logBefore: { removedFromCampaign: [] } as never,
          steps: [],
          at: 0,
        },
      ],
    } as never;
    const view = rewindViewOf(emptyRecord, "crossbones", () => 1, CARDS_BY_ID);
    expect(view.keptSummary).toBe("Nothing kept yet — this is issue #1.");
  });

  test("a removal during the lost attempt shows up as GONE, resolved by name", () => {
    const record = {
      status: "active" as const,
      removedFromCampaign: [{ cardId: "04159a", face: "Improved Thwart Upgrade" }],
      history: [
        {
          nodeId: "zola",
          modes: {},
          outcome: "lost" as const,
          gameId: null,
          logBefore: { removedFromCampaign: [] } as never,
          steps: [],
          at: 0,
        },
      ],
    } as never;
    const view = rewindViewOf(record, "zola", () => 4, CARDS_BY_ID);
    expect(view.gone).toEqual([{ cardId: "04159a", name: "Improved Thwart Upgrade", face: "Improved Thwart Upgrade" }]);
  });

  test("the whole campaign lost (Red Skull expert defeat) is flagged, not treated as a rewind", () => {
    const record = {
      status: "lost" as const,
      removedFromCampaign: [],
      history: [
        {
          nodeId: "red-skull",
          modes: {},
          outcome: "lost" as const,
          gameId: null,
          logBefore: { removedFromCampaign: [] } as never,
          steps: [],
          at: 0,
        },
      ],
    } as never;
    const view = rewindViewOf(record, "red-skull", () => 5, CARDS_BY_ID);
    expect(view.campaignLost).toBe(true);
  });
});

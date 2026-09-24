import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { CampaignService } from "./campaign-service.js";
import { seedDesignRun, seedGmwRun } from "./dev-fixtures.js";
import { frozenNonCampaignCardsOf } from "../view/campaign-deck-edit-model.js";
import { GMW_CAMPAIGN_DEFINITION } from "@mc/cards";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

describe("seedDesignRun", () => {
  test("after issue #2 matches the design's story: one rewind, the design's picks, issue #3 next", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    expect(record.position.nextNodeId).toBe("taskmaster");
    expect(record.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "crossbones:won",
      "absorbing-man:lost",
      "absorbing-man:won",
    ]);
    expect(record.seats.map((seat) => seat.grants.map((grant) => grant.cardId))).toEqual([
      ["04157", "04160a"],
      ["04156", "04159a"],
    ]);
  });

  test("finished is a won run", async () => {
    const record = await seedDesignRun(service(), "finished");
    expect(record.status).toBe("won");
    expect(record.history.filter((entry) => entry.outcome === "won")).toHaveLength(5);
  }, 30_000);
});

describe("seedGmwRun", () => {
  test("afterIssue1 reaches issue 2 with units recorded and unspent", async () => {
    const record = await seedGmwRun(service(), "afterIssue1");
    expect(record.position.nextNodeId).toBe("infiltrate-the-museum");
    expect(record.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual(["brotherhood-of-badoon:won"]);
    for (const seat of record.seats) {
      const units = seat.fields.units;
      expect(units?.kind === "number" ? units.value : 0).toBeGreaterThan(0);
    }
  });

  test("afterIssue2 reaches issue 3, having taken at least one Market card along the way", async () => {
    const record = await seedGmwRun(service(), "afterIssue2");
    expect(record.position.nextNodeId).toBe("escape-the-museum");
    const marketCards = record.seats.flatMap((seat) => {
      const field = seat.fields.marketCards;
      return field?.kind === "cardList" ? field.cardIds : [];
    });
    expect(marketCards.length).toBeGreaterThan(0);
  });

  test("afterIssue2HeadhuntersDown reaches issue 3 with 2 Headhunter marks recorded", async () => {
    const record = await seedGmwRun(service(), "afterIssue2HeadhuntersDown");
    expect(record.position.nextNodeId).toBe("escape-the-museum");
    const marks = record.shared.headhunterDefeated;
    expect(marks?.kind === "number" ? marks.value : 0).toBe(2);
  });

  test("expertAfterIssue1 gives frozenNonCampaignCardsOf a real snapshot to read", async () => {
    const record = await seedGmwRun(service(), "expertAfterIssue1");
    expect(record.modes.campaign?.expertCampaign).toBe(true);
    const frozen = frozenNonCampaignCardsOf(GMW_CAMPAIGN_DEFINITION, record, 1);
    expect(frozen).not.toBeNull();
    expect(frozen!.length).toBeGreaterThan(0);
  });

  test("finished is a won run through all five issues", async () => {
    const record = await seedGmwRun(service(), "finished");
    expect(record.status).toBe("won");
    expect(record.history.filter((entry) => entry.outcome === "won")).toHaveLength(5);
  }, 30_000);
});

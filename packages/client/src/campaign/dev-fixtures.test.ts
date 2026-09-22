import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { CampaignService } from "./campaign-service.js";
import { seedDesignRun } from "./dev-fixtures.js";

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

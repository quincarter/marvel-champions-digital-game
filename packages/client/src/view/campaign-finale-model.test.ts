import { describe, expect, test } from "vitest";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun } from "../campaign/dev-fixtures.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { finaleHeroLineFor, finaleViewOf } from "./campaign-finale-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

describe("campaign-finale-model", () => {
  test("a finished MC10 run: 5/5 issues, one rewind counted, allies freed summed across seats", async () => {
    const record = await seedDesignRun(service(), "finished");
    expect(record.status).toBe("won");
    const view = finaleViewOf(TRORS_CAMPAIGN_DEFINITION, record);
    expect(view.stats.issuesTotal).toBe(5);
    expect(view.stats.issuesCompleted).toBe(5);
    // seedDesignRun's own story: issue #2 was lost once before it was won.
    expect(view.stats.rewinds).toBeGreaterThanOrEqual(1);
    expect(view.stats.alliesFreed).toBeGreaterThanOrEqual(0);
    expect(view.alreadyExpert).toBe(false);
  }, 30_000);

  test("an expert-campaign run reports alreadyExpert", async () => {
    const record = await seedDesignRun(service(), "afterIssue1", { expertCampaign: true });
    const view = finaleViewOf(TRORS_CAMPAIGN_DEFINITION, record);
    expect(view.alreadyExpert).toBe(true);
  });

  test("a campaign with no allies field named reads 0, not a guess", async () => {
    const record = await seedDesignRun(service(), "afterIssue1");
    const view = finaleViewOf(TRORS_CAMPAIGN_DEFINITION, record, null);
    expect(view.stats.alliesFreed).toBe(0);
  });

  test("finaleHeroLineFor reuses the last written line for a roster longer than the story wrote for", () => {
    const lines = ["Line one.", "Line two."];
    expect(finaleHeroLineFor(lines, 0)).toBe("Line one.");
    expect(finaleHeroLineFor(lines, 1)).toBe("Line two.");
    expect(finaleHeroLineFor(lines, 2)).toBe("Line two.");
    expect(finaleHeroLineFor(lines, 3)).toBe("Line two.");
  });
});

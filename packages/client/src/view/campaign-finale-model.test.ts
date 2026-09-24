import { describe, expect, test } from "vitest";
import { TRORS_CAMPAIGN_DEFINITION, GMW_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun, seedGmwRun } from "../campaign/dev-fixtures.js";
import { GMW_STORY } from "../campaign/stories/gmw.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { finaleHeroLineFor, finaleSpreadCropFor, finaleViewOf } from "./campaign-finale-model.js";

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
    expect(view.issuesTotal).toBe(5);
    expect(view.issuesCompleted).toBe(5);
    const rewinds = view.stats.find((stat) => stat.label === "Rewinds");
    const alliesFreed = view.stats.find((stat) => stat.label === "Allies freed");
    // seedDesignRun's own story: issue #2 was lost once before it was won.
    expect(Number(rewinds?.value)).toBeGreaterThanOrEqual(1);
    expect(Number(alliesFreed?.value)).toBeGreaterThanOrEqual(0);
    expect(view.alreadyExpert).toBe(false);
  }, 30_000);

  test("an expert-campaign run reports alreadyExpert", async () => {
    const record = await seedDesignRun(service(), "afterIssue1", { expertCampaign: true });
    const view = finaleViewOf(TRORS_CAMPAIGN_DEFINITION, record);
    expect(view.alreadyExpert).toBe(true);
  });

  test("a campaign with no allies field named reads 0, not a guess", async () => {
    const record = await seedDesignRun(service(), "afterIssue1");
    const view = finaleViewOf(TRORS_CAMPAIGN_DEFINITION, record, [
      { kind: "cardListTotal", label: "Allies freed", field: "notAField" },
    ]);
    expect(view.stats.find((stat) => stat.label === "Allies freed")?.value).toBe("0");
  });

  test("finaleHeroLineFor reuses the last written line for a roster longer than the story wrote for", () => {
    const lines = ["Line one.", "Line two."];
    expect(finaleHeroLineFor(lines, 0)).toBe("Line one.");
    expect(finaleHeroLineFor(lines, 1)).toBe("Line two.");
    expect(finaleHeroLineFor(lines, 2)).toBe("Line two.");
    expect(finaleHeroLineFor(lines, 3)).toBe("Line two.");
  });

  test("GMW's own finale stats: units banked across both seats, the shared Headhunter ladder count", async () => {
    const record = await seedGmwRun(service(), "finished");
    expect(record.status).toBe("won");
    const view = finaleViewOf(GMW_CAMPAIGN_DEFINITION, record, GMW_STORY.finale.stats);
    expect(view.issuesTotal).toBe(5);
    expect(view.issuesCompleted).toBe(5);
    expect(view.stats.map((stat) => stat.label)).toEqual(["Units banked", "Headhunters"]);
    const unitsBanked = Number(view.stats.find((stat) => stat.label === "Units banked")?.value);
    const headhunters = Number(view.stats.find((stat) => stat.label === "Headhunters")?.value);
    expect(unitsBanked).toBeGreaterThanOrEqual(0);
    expect(headhunters).toBeGreaterThanOrEqual(0);
  }, 30_000);

  test("finaleSpreadCropFor reads GMW's whole finale page; a box with no `finale.page` (or no story) has none", () => {
    const crop = finaleSpreadCropFor(GMW_STORY);
    expect(crop?.file).toBe("06-finale");
    expect(crop?.rect).toEqual({ x: 0, y: 0, w: 1920, h: 993 });
    expect(finaleSpreadCropFor(undefined)).toBeNull();
  });
});

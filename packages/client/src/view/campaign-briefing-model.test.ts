import { describe, expect, test } from "vitest";
import type { CampaignChoiceAnswer } from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun } from "../campaign/dev-fixtures.js";
import { briefingViewOf, deckRowsOf, handledRowsOf } from "./campaign-briefing-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

describe("campaign briefing model", () => {
  test("issue #1 composed: no grants yet, decks at their built size with nothing pinned", async () => {
    const record = await seedDesignRun(service(), "issue1Composed");
    const view = briefingViewOf(record, cardName as never, 1);
    expect(view).not.toBeNull();
    expect(view!.decks.every((row) => row.pinnedCount === 0)).toBe(true);
    expect(view!.decks.map((row) => row.heroName)).toEqual(["Hawkeye", "Spider-Woman"]);
  });

  test("a record with no composed attempt has no briefing view", async () => {
    const record = await seedDesignRun(service(), "afterIssue1");
    expect(briefingViewOf(record, cardName as never, 2)).toBeNull();
  });

  test("deckRowsOf: grants pin into the deck and never count toward its size (MC10 p. 3)", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    const rows = deckRowsOf(record, cardName as never);
    // seedDesignRun's own picks: each hero took a TECH and a Basic Condition upgrade over issues #1-#2.
    expect(rows.every((row) => row.pinnedCount === 2)).toBe(true);
    expect(rows.every((row) => row.deckSize > 0)).toBe(true);
  });

  test("deckRowsOf: a single aspect reads as its full name, uppercase", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    const rows = deckRowsOf(record, cardName as never);
    for (const row of rows) expect(row.aspectLabel).toBe(row.aspectLabel.toUpperCase());
  });

  test("handledRowsOf: after issue #2's rewind, the composed issue #3 lists the design's own TECH/Basic grants", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    const composed = await service_compose(service, record);
    const rows = handledRowsOf(composed.attempt!, composed, cardName as never);
    const grantsRow = rows.find((row) => row.key === "grants");
    expect(grantsRow).toBeDefined();
    expect(grantsRow!.status).toBe("done");
    expect(grantsRow!.detail).toContain("Hawkeye");
    expect(grantsRow!.detail).toContain("Spider-Woman");
  });
});

/**
 * `afterIssue2` stops before issue #3 is composed. Composes it here (declining anything optional) so
 * `handledRowsOf` has a real `CampaignAttempt` to read.
 */
async function service_compose(makeService: () => CampaignService, seed: CampaignRecord): Promise<CampaignRecord> {
  const svc = makeService();
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 32; guard++) {
    const result = await svc.compose(seed, answers);
    if (result.kind === "done") return result.record;
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: result.choice.optional ? [] : result.choice.options.slice(0, result.choice.count),
    });
  }
  throw new Error("issue #3 asked more than 32 questions composing");
}

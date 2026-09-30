import { describe, expect, test } from "vitest";
import type { CampaignChoiceAnswer } from "@mc/engine";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedSmWonGame } from "../campaign/dev-fixtures.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import {
  collectionPickerAspects,
  collectionPickerRows,
  filterCollectionPicker,
} from "./campaign-collection-picker-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

/** Auto-answers every pending choice up to (but not including) node 9's own "aspectAdvantage" collection pick, so
 * the test drives a real engine choice — never a hand-built one. */
async function foldToAspectAdvantage(): Promise<{ options: readonly string[] }> {
  const svc = service();
  const { record, won } = await seedSmWonGame(svc, "afterIssue2");
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 32; guard++) {
    const result = await svc.foldState(record, won, [], answers);
    if (result.kind === "done") throw new Error("expected node 9's aspectAdvantage choice, folded clean instead");
    if (result.choice.slot === "aspectAdvantage") return { options: result.choice.options };
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: result.choice.optional ? [] : result.choice.options.slice(0, result.choice.count),
    });
  }
  throw new Error("never reached node 9's aspectAdvantage choice in 32 questions");
}

describe("campaign-collection-picker-model, against MC27 node 9's real collection choice", () => {
  test("collectionPickerRows resolves every offered id to a real card, none invented", async () => {
    const { options } = await foldToAspectAdvantage();
    expect(options.length).toBeGreaterThan(50); // "your whole collection" — hundreds of legal cards
    const rows = collectionPickerRows(options, CARDS_BY_ID);
    expect(rows).toHaveLength(options.length);
    expect(rows.every((row) => row.name.length > 0)).toBe(true);
  }, 30_000);

  test("filterCollectionPicker never widens the engine's own options — only narrows and sorts them", async () => {
    const { options } = await foldToAspectAdvantage();
    const rows = collectionPickerRows(options, CARDS_BY_ID);
    const filtered = filterCollectionPicker(rows, {});
    expect(filtered.map((row) => row.cardId).sort()).toEqual([...rows.map((row) => row.cardId)].sort());
    // Sorted by name.
    const names = filtered.map((row) => row.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  }, 30_000);

  test("aspect chip + search text both narrow the same list a player would actually type/click", async () => {
    const { options } = await foldToAspectAdvantage();
    const rows = collectionPickerRows(options, CARDS_BY_ID);
    const aspects = collectionPickerAspects(rows);
    expect(aspects.length).toBeGreaterThan(0);
    const firstAspect = aspects[0]!;
    const byAspect = filterCollectionPicker(rows, { aspect: firstAspect });
    expect(byAspect.length).toBeGreaterThan(0);
    expect(byAspect.every((row) => row.aspect === firstAspect)).toBe(true);

    const bySearch = filterCollectionPicker(rows, { text: "shield" });
    expect(bySearch.every((row) => row.name.toLowerCase().includes("shield"))).toBe(true);
  }, 30_000);
});

/**
 * `campaign-dossier-model.ts`'s Log tab against a real folded GMW run: MC16's "units" field is written by three
 * chained `add` specs per seat in one victory block, and the Log tab must show each seat's own award for the fold,
 * not the campaign's running total (`campaign-log-deltas.ts`).
 */
import { describe, expect, it } from "vitest";
import { GMW_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedGmwRun } from "../campaign/dev-fixtures.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { campaignDossierLog } from "./campaign-dossier-model.js";

const cardName = (id: string): string => id;

describe("campaignDossierLog's units rows (GMW)", () => {
  it("one entry per seat, each the fold's own delta, never one per cumulative add", async () => {
    const service = new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
      engineDeps: POOL_DEPS,
    });
    const record = await seedGmwRun(service, "afterIssue1");
    const log = campaignDossierLog(record, GMW_CAMPAIGN_DEFINITION, cardName);
    const section = log.sections.find((candidate) => candidate.nodeId === "brotherhood-of-badoon");
    expect(section).toBeDefined();
    const unitEntries = section!.entries.filter((entry) => entry.headline.includes("unit"));
    expect(unitEntries).toHaveLength(2);
    for (const entry of unitEntries) expect(entry.headline).toBe("+3 units");
    // "0 headhunter defeated?" is a non-event, the same as an unset flag — never a row.
    expect(section!.entries.some((entry) => entry.headline.toLowerCase().includes("headhunter"))).toBe(false);
  });
});

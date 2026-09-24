/**
 * `campaign-dossier-model.ts`'s Log tab against a real folded GMW run: MC16's "units" field is written by three
 * chained `add` specs per seat in one victory block, and the Log tab must show each seat's own award for the fold,
 * not the campaign's running total (`campaign-log-deltas.ts`), named to its own seat the same way the Issue
 * detail's write list does ("+3 units → Groot").
 */
import { describe, expect, it } from "vitest";
import { GMW_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedGmwRun } from "../campaign/dev-fixtures.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { campaignDossierLog } from "./campaign-dossier-model.js";

const cardName = (id: string): string => id;
const heroNameOf = (identityCardId: string): string => CARDS_BY_ID.get(identityCardId)?.name ?? identityCardId;

describe("campaignDossierLog's units rows (GMW)", () => {
  it("one entry per seat, named to its own hero, each the fold's own delta, never one per cumulative add", async () => {
    const service = new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
      engineDeps: POOL_DEPS,
    });
    const record = await seedGmwRun(service, "afterIssue1");
    const log = campaignDossierLog(record, GMW_CAMPAIGN_DEFINITION, cardName, heroNameOf);
    const section = log.sections.find((candidate) => candidate.nodeId === "brotherhood-of-badoon");
    expect(section).toBeDefined();
    const unitEntries = section!.entries.filter((entry) => entry.headline.includes("unit"));
    expect(unitEntries).toHaveLength(2);
    for (const entry of unitEntries) expect(entry.headline).toMatch(/^\+3 units → .+$/);
    expect(unitEntries.some((entry) => entry.headline.endsWith("Groot"))).toBe(true);
    expect(unitEntries.some((entry) => entry.headline.endsWith("Rocket Raccoon"))).toBe(true);
    // "0 headhunter defeated?" is a non-event, the same as an unset flag — never a row.
    expect(section!.entries.some((entry) => entry.headline.toLowerCase().includes("headhunter"))).toBe(false);
  });

  it("issue #2's market-card purchases collapse to one delta per seat, never the running cumulative list", async () => {
    const service = new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
      engineDeps: POOL_DEPS,
    });
    const record = await seedGmwRun(service, "afterIssue2");
    const log = campaignDossierLog(record, GMW_CAMPAIGN_DEFINITION, cardName, heroNameOf);
    const section = log.sections.find((candidate) => candidate.nodeId === "infiltrate-the-museum");
    expect(section).toBeDefined();
    const marketEntries = section!.entries.filter((entry) => entry.headline.startsWith("+ "));
    expect(marketEntries.length).toBeGreaterThan(0);
    // Never a running list that grows every row (e.g. "Brainstorm", then "Brainstorm, By Any Means", then
    // "Brainstorm, By Any Means, Contingency Plan") — each row is that write's own *new* cards only, so no card
    // name should ever repeat across one seat's own rows.
    const cardsBySeat = new Map<string, string[]>();
    for (const entry of marketEntries) {
      const [cardsPart, hero] = entry.headline.split(" → ");
      const cards = cardsPart!.replace(/^\+ /, "").split(", ");
      cardsBySeat.set(hero!, [...(cardsBySeat.get(hero!) ?? []), ...cards]);
    }
    for (const [, cards] of cardsBySeat) expect(new Set(cards).size).toBe(cards.length);
  });
});

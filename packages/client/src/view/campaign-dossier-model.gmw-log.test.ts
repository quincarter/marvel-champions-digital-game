/**
 * The Dossier's Log tab against GMW's real definition (`docs/campaign-client-per-box.md` §2's "move MC10-only
 * wording toward per-box data" ask): the "In force now" box shows GMW's own live fields instead of MC10's Weapons/
 * Delay, and a Market purchase's card-list write is never repeated by a grant row for the same card.
 */
import { describe, expect, it } from "vitest";
import { createCampaignLog } from "@mc/engine";
import { GMW_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { cardId } from "@mc/content";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedGmwRun } from "../campaign/dev-fixtures.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { campaignDossierLog } from "./campaign-dossier-model.js";

const cardName = (id: string): string => id;
const heroNameOf = (identityCardId: string): string => identityCardId;

function newService(): CampaignService {
  return new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });
}

describe("GMW's Log tab: 'In force now' is box-driven, not MC10's fields", () => {
  it("shows the bounty ladder, Collection, Power Stone and Evasion fields, never Weapons/Delay", async () => {
    const record = await seedGmwRun(newService(), "finished");
    const log = campaignDossierLog(record, GMW_CAMPAIGN_DEFINITION, cardName, heroNameOf);
    const labels = log.inForce.map((row) => row.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Headhunter marks",
        "Cards in The Collection",
        "Power Stone control",
        "Struck",
        "Rewinds",
      ]),
    );
    expect(labels).not.toContain("Weapons");
    expect(labels).not.toContain("Delay");
    const rewinds = log.inForce.find((row) => row.label === "Rewinds")!;
    expect(rewinds.note).not.toBe("free on Standard");
  });

  it("MC10 keeps its own Weapons/Delay/Rewinds wording exactly as before", () => {
    // A fresh, unplayed MC10 log still carries the fields; the values are all zero/none but the field-driven
    // labels/notes are what's under test here, not real playthrough state.
    const fresh = createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
      id: "mc10-log-tab-test",
      poolVersion: "test",
      modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
      seats: [
        {
          seatNumber: 1,
          identityCardId: cardId("hawkeye"),
          deck: { identityCardId: cardId("hawkeye"), aspects: [], cards: [] },
        },
      ],
      seed: 1,
    });
    const log = campaignDossierLog(fresh, TRORS_CAMPAIGN_DEFINITION, cardName, heroNameOf);
    const labels = log.inForce.map((row) => row.label);
    expect(labels).toEqual(["Weapons", "Delay", "Struck", "Rewinds"]);
    expect(log.inForce.find((row) => row.label === "Rewinds")?.note).toBe("free on Standard");
  });
});

describe("GMW's Log tab: a Market purchase is never shown twice", () => {
  it("issue #2's card-list write suppresses the matching per-card grant rows", async () => {
    const record = await seedGmwRun(newService(), "afterIssue2");
    const log = campaignDossierLog(record, GMW_CAMPAIGN_DEFINITION, cardName, heroNameOf);
    const marketSection = log.sections.find((section) => section.nodeId === "infiltrate-the-museum")!;
    expect(marketSection).toBeDefined();
    const listWrite = marketSection.entries.find((entry) => entry.headline.startsWith("+ "));
    expect(listWrite).toBeDefined();
    const purchasedIds = listWrite!.headline
      .replace(/^\+ /, "")
      .replace(/ → .*$/, "")
      .split(", ");
    // Every purchased card named by the write has no separate "<card> added" grant row in the same section.
    for (const id of purchasedIds) {
      expect(marketSection.entries.some((entry) => entry.headline === `${id} added`)).toBe(false);
    }
    // Whatever grant rows remain (if any) use box wording, never the MC10-specific "Permanent condition.".
    for (const entry of marketSection.entries) {
      if (entry.headline.endsWith(" added")) expect(entry.detail).not.toBe("Permanent condition.");
    }
  });
});

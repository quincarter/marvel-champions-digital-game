/**
 * `campaign-dossier-model.ts`'s World box against MC16's own shared log fields (`docs/campaign-client-per-box.md`
 * §2's "move the MC10-only wording toward per-box data" ask): short labels and "when it matters" lines for the
 * Badoon bounty ladder, The Collection, Power Stone Control and the evasion counter, plus the bookkeeping fields
 * (`collection`, `galacticArtifacts`, `kreeSupremacyRevealed`) staying off the printed sheet.
 *
 * A log built directly with `createCampaignLog` and shared fields set by hand, rather than played through a real
 * scenario — the World box only reads `record.shared`, so this exercises exactly that without a full campaign run.
 */
import { describe, expect, it } from "vitest";
import { createCampaignLog, type CampaignLog } from "@mc/engine";
import { GMW_CAMPAIGN_DEFINITION } from "@mc/cards";
import { cardId } from "@mc/content";
import { bountyLadderRungs, campaignDossierOverview } from "./campaign-dossier-model.js";

const heroNameOf = (identityCardId: string): string => identityCardId;
const cardName = (id: string): string => id;

function freshRecord(): CampaignLog & { readonly name: string } {
  const log = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
    id: "gmw-dossier-test",
    poolVersion: "test",
    modes: { campaign: { campaignId: GMW_CAMPAIGN_DEFINITION.campaignId } },
    seats: [
      {
        seatNumber: 1,
        identityCardId: cardId("rocket-raccoon"),
        deck: { identityCardId: cardId("rocket-raccoon"), aspects: [], cards: [] },
      },
    ],
    seed: 1,
  });
  return { ...log, name: "The Galaxy's Most Wanted" };
}

describe("GMW's World box", () => {
  it("headhunterDefeated reads as bounty marks, not a bare number", () => {
    const record = { ...freshRecord(), shared: { headhunterDefeated: { kind: "number" as const, value: 2 } } };
    const overview = campaignDossierOverview(record, GMW_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    const row = overview.world.find((r) => r.id === "headhunterDefeated")!;
    expect(row.label).toBe("Headhunter marks");
    expect(row.bigValue).toBe("2");
    expect(row.when).toMatch(/ladder/i);
  });

  it("collection and galacticArtifacts stay off the printed World box; collectionCount and Power Stone Control show", () => {
    const record = {
      ...freshRecord(),
      shared: {
        collection: { kind: "cardList" as const, cardIds: [cardId("16150")] },
        collectionCount: { kind: "number" as const, value: 3 },
        galacticArtifacts: { kind: "cardList" as const, cardIds: [] },
        powerStoneControl: { kind: "cardRef" as const, cardId: cardId("rocket-raccoon") },
        evasionCounters: { kind: "number" as const, value: 1 },
      },
    };
    const overview = campaignDossierOverview(record, GMW_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    const ids = overview.world.map((r) => r.id);
    expect(ids).not.toContain("collection");
    expect(ids).not.toContain("galacticArtifacts");
    const count = overview.world.find((r) => r.id === "collectionCount")!;
    expect(count.label).toBe("Cards in The Collection");
    expect(count.bigValue).toBe("3");
    const power = overview.world.find((r) => r.id === "powerStoneControl")!;
    expect(power.label).toBe("Power Stone control");
    // `heroNameOf` is the identity function in this test, so the cardRef reads back as the identity id itself.
    expect(power.bigValue).toBe("rocket-raccoon");
    const evasion = overview.world.find((r) => r.id === "evasionCounters")!;
    expect(evasion.bigValue).toBe("1");
  });

  it("bounty ladder rungs come from gmw.ts's own setup instructions, cards named from card data, in tier order", () => {
    const rungs = bountyLadderRungs(GMW_CAMPAIGN_DEFINITION, "headhunterDefeated", 2, (id) => `Card ${id as string}`);
    // 4 rungs, one per `ON_THE_HUNT`/`DEAD_TO_RIGHTS`/`HEADHUNTERS_HENCHMAN`/`FUGITIVE_RECOVERY` (16184-16187).
    expect(rungs.map((r) => r.tier)).toEqual([1, 2, 3, 4]);
    expect(rungs.map((r) => r.cardId)).toEqual(["16184", "16185", "16186", "16187"]);
    expect(rungs.every((r) => r.name.startsWith("Card 161"))).toBe(true);
    expect(rungs.map((r) => r.unlocked)).toEqual([true, true, false, false]);
  });
});

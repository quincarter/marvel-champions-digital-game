/**
 * `campaign-dossier-model.ts`'s Overview against MC21's campaign pool (`docs/campaign-client-per-box.md` §3 row 39):
 * pool-shaped fields never leak onto "The World", and `overview.pool` carries the same data
 * `campaign-pool-model.test.ts` already exercises directly — this file only proves the two are wired together.
 */
import { describe, expect, it } from "vitest";
import { createCampaignLog, type CampaignLog } from "@mc/engine";
import { MTS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { cardId } from "@mc/content";
import { campaignDossierOverview } from "./campaign-dossier-model.js";
import type { CardMetaOf } from "./campaign-pool-model.js";

const heroNameOf = (identityCardId: string): string => identityCardId;
const cardName = (id: string): string => id;

const cardTypeOf: CardMetaOf = (name) =>
  ({ Cosmo: { type: "ally" }, "Security Breach": { type: "side_scheme" } })[name];

function freshRecord(): CampaignLog & { readonly name: string } {
  const log = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
    id: "mts-dossier-test",
    poolVersion: "test",
    modes: { campaign: { campaignId: MTS_CAMPAIGN_DEFINITION.campaignId } },
    seats: [
      {
        seatNumber: 1,
        identityCardId: cardId("21001a"),
        deck: { identityCardId: cardId("21001a"), aspects: [], cards: [] },
      },
    ],
    seed: 1,
  });
  return { ...log, name: "The Mad Titan's Shadow" };
}

describe("MC21's Overview pool wiring", () => {
  it("pool-shaped fields never appear on The World, resolved or not", () => {
    const record = { ...freshRecord(), shared: { cosmoInPool: { kind: "flag" as const, value: true } } };
    const overview = campaignDossierOverview(record, MTS_CAMPAIGN_DEFINITION, heroNameOf, cardName, cardTypeOf);
    expect(overview.world.some((row) => row.id === "cosmoInPool")).toBe(false);
    expect(overview.world.some((row) => row.id === "secureLandingPadInPlay")).toBe(false);
  });

  it("overview.pool carries the resolved cards, grouped helps-then-hurts", () => {
    const record = {
      ...freshRecord(),
      shared: {
        cosmoInPool: { kind: "flag" as const, value: true },
        securityBreachInPool: { kind: "flag" as const, value: true },
      },
    };
    const overview = campaignDossierOverview(record, MTS_CAMPAIGN_DEFINITION, heroNameOf, cardName, cardTypeOf);
    expect(overview.pool).not.toBeNull();
    expect(overview.pool!.cards.map((card) => [card.name, card.helps])).toEqual([
      ["Cosmo", true],
      ["Security Breach", false],
    ]);
  });

  it("is null on a box with no pool fields (MC10)", async () => {
    const { TRORS_CAMPAIGN_DEFINITION } = await import("@mc/cards");
    const log = createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
      id: "trors-dossier-test",
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
    const overview = campaignDossierOverview(
      { ...log, name: "TRoRS" },
      TRORS_CAMPAIGN_DEFINITION,
      heroNameOf,
      cardName,
    );
    expect(overview.pool).toBeNull();
  });
});

/**
 * `campaign-dossier-model.ts`'s Overview against MC27's reputation track (`docs/campaign-client-per-box.md` §3 row
 * 42): the track gets its own readable sentence rather than the printed field label/citation fallback, and its
 * own internal scratch field (`reputationSetups`, a list of conditional-instruction ids) never leaks onto "The
 * World" as raw ids.
 */
import { describe, expect, it } from "vitest";
import { createCampaignLog, type CampaignLog } from "@mc/engine";
import { SM_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { cardId } from "@mc/content";
import { campaignDossierOverview } from "./campaign-dossier-model.js";

const heroNameOf = (identityCardId: string): string => identityCardId;
const cardName = (id: string): string => id;

function freshRecord(): CampaignLog & { readonly name: string } {
  const log = createCampaignLog(SM_CAMPAIGN_DEFINITION, {
    id: "sm-dossier-test",
    poolVersion: "test",
    modes: { campaign: { campaignId: SM_CAMPAIGN_DEFINITION.campaignId } },
    seats: [
      {
        seatNumber: 1,
        identityCardId: cardId("27001a"),
        deck: { identityCardId: cardId("27001a"), aspects: [], cards: [] },
      },
    ],
    seed: 1,
  });
  return { ...log, name: "Sinister Motives" };
}

describe("MC27's Overview reputation-track wiring", () => {
  it("shows the reputation track with its own sentence, not the printed field's own label/citation", () => {
    const record = { ...freshRecord(), shared: { reputation: { kind: "number" as const, value: 3 } } };
    const overview = campaignDossierOverview(record, SM_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    const row = overview.world.find((r) => r.id === "reputation");
    expect(row).toBeDefined();
    expect(row!.label).toBe("Reputation");
    expect(row!.when).toMatch(/every scenario after/);
  });

  it("never shows the reputation track's own scratch instruction-id list", () => {
    const record = {
      ...freshRecord(),
      shared: {
        reputation: { kind: "number" as const, value: 5 },
        reputationSetups: { kind: "instructionList" as const, ids: ["sm.rep.node5.reward", "sm.rep.node5.penalty"] },
      },
    };
    const overview = campaignDossierOverview(record, SM_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    expect(overview.world.some((row) => row.id === "reputationSetups")).toBe(false);
  });

  it("is null on a box with no pool at all (MC27 has no campaign pool)", () => {
    const overview = campaignDossierOverview(freshRecord(), SM_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    expect(overview.pool).toBeNull();
  });
});

describe("MC27's reputation track panel", () => {
  it("lists every crossed-node threshold in printed order, marked against the live reputation value", () => {
    const record = { ...freshRecord(), shared: { reputation: { kind: "number" as const, value: 8 } } };
    const overview = campaignDossierOverview(record, SM_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    const track = overview.reputationTrack;
    expect(track).not.toBeNull();
    expect(track!.nodes.map((node) => node.node)).toEqual([1, 5, 9, 13, 17, 21, 25]);
    expect(track!.nodes.map((node) => node.marked)).toEqual([true, true, false, false, false, false, false]);
    expect(track!.valueLabel).toBe("8 REPUTATION");
  });

  it("shows a marked node's own repeating 'Setup:' instruction text, never an unmarked node's", () => {
    const record = { ...freshRecord(), shared: { reputation: { kind: "number" as const, value: 5 } } };
    const overview = campaignDossierOverview(record, SM_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    const track = overview.reputationTrack!;
    const node1 = track.nodes.find((node) => node.node === 1)!;
    expect(node1.inForceText).toEqual([
      'Setup: Shuffle each card recorded in the "Osborn Tech" section of the campaign log into the encounter deck.',
    ]);
    const node5 = track.nodes.find((node) => node.node === 5)!;
    expect(node5.inForceText).toEqual(["Setup: Place 1[per_hero] threat on the main scheme."]);
    const node9 = track.nodes.find((node) => node.node === 9)!;
    expect(node9.marked).toBe(false);
    expect(node9.inForceText).toEqual([]);
  });

  it("is null on a box with no crossed-node track shape at all (MC10 has no reputation track)", () => {
    const trorsLog = createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
      id: "trors-dossier-test",
      poolVersion: "test",
      modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
      seats: [
        {
          seatNumber: 1,
          identityCardId: cardId("01001a"),
          deck: { identityCardId: cardId("01001a"), aspects: [], cards: [] },
        },
      ],
      seed: 1,
    });
    const overview = campaignDossierOverview(
      { ...trorsLog, name: "The Rise of Red Skull" },
      TRORS_CAMPAIGN_DEFINITION,
      heroNameOf,
      cardName,
    );
    expect(overview.reputationTrack).toBeNull();
  });
});

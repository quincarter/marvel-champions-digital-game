/**
 * Signing a Galaxy's Most Wanted run on the Balanced house rule (issue #609): the service stores the choice on the
 * run, and a run signed without it reads as Normal.
 */
import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { preconDecks } from "../view/deck-list-model.js";
import { balancedTagOf } from "../view/campaign-balanced-model.js";
import { CampaignService } from "./campaign-service.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));

const deckNamed = (id: string) => {
  const deck = preconDecks(POOL_VERSION).find((candidate) => (candidate.id as string).includes(id));
  if (!deck) throw new Error(`no precon matching ${id}`);
  return deck;
};
const ROSTER = [deckNamed("groot"), deckNamed("rocket")].map((deck) => ({ identityCardId: deck.identityCardId, deck }));

function service(): CampaignService {
  let ids = 0;
  return new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: POOL },
    engineDeps: POOL_DEPS,
    now: () => 1_000,
    newId: () => `run-${++ids}`,
  });
}

const flag = (record: { readonly hidden: Record<string, unknown> }, field: string): unknown => record.hidden[field];

describe("CampaignService.start with the Balanced house rule", () => {
  test("stores modes.campaign.balanced and seeds the toggles as hidden fields", async () => {
    const record = await service().start({
      campaignId: "gmw",
      seats: ROSTER,
      balanced: { toggles: ["spacePirates", "milanoExhausted"] },
      poolVersion: POOL_VERSION,
      seed: 7,
    });
    expect(record.modes.campaign?.balanced).toBe(true);
    expect(balancedTagOf(record.modes)).toBe("Balanced");
    expect(flag(record, "balancedSpacePirates")).toEqual({ kind: "flag", value: true });
    expect(flag(record, "balancedMilanoExhausted")).toEqual({ kind: "flag", value: true });
    expect(flag(record, "balanced")).toEqual({ kind: "flag", value: true });
    expect(flag(record, "balancedExpertGallery")).toBeUndefined();
    expect(flag(record, "balancedTrimStandard")).toBeUndefined();
  });

  test("keeps Expert beside it, and survives a save and a load (retry, resume)", async () => {
    const campaigns = service();
    const signed = await campaigns.start({
      campaignId: "gmw",
      seats: ROSTER,
      expertCampaign: true,
      balanced: { toggles: [] },
      poolVersion: POOL_VERSION,
      seed: 7,
    });
    expect(signed.modes.campaign).toMatchObject({ expertCampaign: true, balanced: true });
    const loaded = await campaigns.load(signed.id);
    expect(loaded?.modes.campaign).toMatchObject({ expertCampaign: true, balanced: true });
    expect(loaded?.hidden).toEqual(signed.hidden);
  });

  test("another campaign ignores the choice, so its run never says Balanced with nothing behind it", async () => {
    const record = await service().start({
      campaignId: "trors",
      seats: ROSTER,
      balanced: { toggles: [] },
      poolVersion: POOL_VERSION,
      seed: 7,
    });
    expect(record.modes.campaign?.balanced).toBeUndefined();
    expect(record.hidden).toEqual({});
  });

  test("a run signed without it reads as Normal, with no hidden fields", async () => {
    const record = await service().start({ campaignId: "gmw", seats: ROSTER, poolVersion: POOL_VERSION, seed: 7 });
    expect(record.modes.campaign?.balanced).toBeUndefined();
    expect(balancedTagOf(record.modes)).toBeNull();
    expect(record.hidden).toEqual({});
  });
});

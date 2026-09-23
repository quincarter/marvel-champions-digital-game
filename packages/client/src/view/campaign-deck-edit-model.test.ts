import { describe, expect, it } from "vitest";
import { cardId, TRORS_CAMPAIGN, TRORS_STARTER_DECKS, type DeckCardEntry, type StarterDeck } from "@mc/content";
import { createCampaignLog, type CampaignLog, type CampaignSeatSetup } from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { POOL_CARDS } from "../content/pool.js";
import {
  campaignDeckContextOf,
  campaignDeckEditModel,
  removedFromCampaignCardIds,
} from "./campaign-deck-edit-model.js";

function requireStarter(id: string): StarterDeck {
  const found = TRORS_STARTER_DECKS.find((deck) => (deck.id as string) === id);
  if (!found) throw new Error(`no trors starter deck "${id}"`);
  return found;
}

const STARTER = requireStarter("hawkeye-leadership");
const TECH_UPGRADE = cardId("04155");

function seatFor(starter: StarterDeck, seatNumber: number): CampaignSeatSetup {
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

function freshLog(): CampaignLog {
  return createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
    id: "deck-model-test",
    seats: [seatFor(STARTER, 1)],
    modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
    poolVersion: "deck-model-test",
    seed: 1,
  });
}

/** A log whose seat 1 was granted the first TECH upgrade, as `mc10.s1.victory.tech` would leave it. */
function grantedLog(): CampaignLog {
  const log = freshLog();
  return {
    ...log,
    seats: log.seats.map((seat) =>
      seat.seatNumber === 1
        ? {
            ...seat,
            grants: [{ cardId: TECH_UPGRADE, permanence: "campaign" as const, grantedAtNodeId: "crossbones" }],
          }
        : seat,
    ),
  };
}

describe("campaignDeckContextOf: MC10's real content record and definition", () => {
  it("assembles the campaign set ids, identity lock and grants from the log", () => {
    const context = campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1);
    expect(context).toMatchObject({
      campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId,
      campaignSetIds: ["hydra_camp", "expcamp"],
      identityCardId: STARTER.identityCardId,
      grantedCardIds: [TECH_UPGRADE],
      removedFromCampaign: [],
    });
    expect(context.frozenNonCampaignCards).toBeUndefined();
  });

  it("carries frozenNonCampaignCards only when the caller supplies it (MC10 never does)", () => {
    const frozen: readonly DeckCardEntry[] = STARTER.cards.map((line) => ({ ...line }));
    const context = campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1, { frozenNonCampaignCards: frozen });
    expect(context.frozenNonCampaignCards).toEqual(frozen);
  });

  it("throws for a seat the log doesn't have", () => {
    expect(() => campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 9)).toThrow(/seat 9/);
  });
});

describe("campaignDeckEditModel", () => {
  it("marks a granted line locked and leaves it out of the deck-size/copy problems validateDeck would raise standalone", () => {
    const context = campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1);
    const deck = {
      identityCardId: STARTER.identityCardId,
      aspects: STARTER.aspects,
      cards: [...STARTER.cards, { cardId: TECH_UPGRADE, quantity: 1 }],
    };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context);
    expect(model.validation.ok).toBe(true);
    const row = model.rows.find((candidate) => candidate.cardId === TECH_UPGRADE);
    expect(row).toMatchObject({
      locked: true,
      lockedReason: "Added by the campaign — does not count toward deck size",
    });
    const starterRow = model.rows.find((candidate) => candidate.cardId === STARTER.cards[0]?.cardId);
    expect(starterRow?.locked).toBe(false);
  });

  it("refuses the same card outside the campaign context, naming why (validateDeck's own verdict, not re-derived)", () => {
    const deck = {
      identityCardId: STARTER.identityCardId,
      aspects: STARTER.aspects,
      cards: [...STARTER.cards, { cardId: TECH_UPGRADE, quantity: 1 }],
    };
    const verdict = campaignDeckEditModel(deck, POOL_CARDS, {
      campaignId: "x",
      campaignSetIds: [],
      identityCardId: STARTER.identityCardId,
      grantedCardIds: [],
    }).validation;
    expect(verdict.ok).toBe(false);
  });

  it("marks a line removed from the campaign refused, with validateDeck's own message", () => {
    const removedCardId = STARTER.cards[0]!.cardId;
    const context = {
      ...campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1),
      removedFromCampaign: [{ cardId: removedCardId }],
    };
    const deck = { identityCardId: STARTER.identityCardId, aspects: STARTER.aspects, cards: STARTER.cards };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context);
    expect(model.validation.ok).toBe(false);
    const row = model.rows.find((candidate) => candidate.cardId === removedCardId);
    expect(row?.refused).toBe(true);
    expect(row?.refusedReason).toMatch(/removed from this campaign/);
    const otherRow = model.rows.find((candidate) => candidate.cardId !== removedCardId);
    expect(otherRow?.refused).toBe(false);
    expect(otherRow?.refusedReason).toBeNull();
  });

  it("removedFromCampaignCardIds only counts a faceless removal (a same-card, other-face removal leaves it usable)", () => {
    const cardId = STARTER.cards[0]!.cardId;
    const context = {
      ...campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1),
      removedFromCampaign: [{ cardId, face: "back" }],
    };
    expect(removedFromCampaignCardIds(context).has(cardId)).toBe(false);
    const facelessContext = { ...context, removedFromCampaign: [{ cardId }] };
    expect(removedFromCampaignCardIds(facelessContext).has(cardId)).toBe(true);
  });

  it("disables editing, with the printed reason, only when a freeze is supplied", () => {
    const baseDeck = { identityCardId: STARTER.identityCardId, aspects: STARTER.aspects, cards: STARTER.cards };
    const open = campaignDeckEditModel(baseDeck, POOL_CARDS, campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1));
    expect(open.editingDisabled).toBe(false);
    expect(open.editingDisabledReason).toBeNull();

    const frozen = campaignDeckEditModel(
      baseDeck,
      POOL_CARDS,
      campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1, {
        frozenNonCampaignCards: STARTER.cards.map((line) => ({ ...line })),
      }),
    );
    expect(frozen.editingDisabled).toBe(true);
    expect(frozen.editingDisabledReason).toMatch(/frozen for the rest/);
  });
});

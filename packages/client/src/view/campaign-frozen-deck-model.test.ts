/**
 * The frozen-deck screen's own view model (design tile 20), against GMW's real Expert-campaign freeze
 * (`campaign-deck-edit-model.ts`'s `frozenNonCampaignCardsOf`) and a real precon deck/pool — the same fixture
 * shape `campaign-dossier-model.gmw.test.ts` already builds by hand for this box.
 */
import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import { GMW_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CARDS_BY_ID, POOL_CARDS } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import type { CampaignDeckEditModel, CampaignDeckEditRow } from "./campaign-deck-edit-model.js";
import { frozenDeckModelOf, frozenDeckMarketCta, type FrozenDeckModelInput } from "./campaign-frozen-deck-model.js";

const cardOf = (id: string) => CARDS_BY_ID.get(id);
const rocket = preconDecks().find((deck) => (deck.id as string).includes("rocket-raccoon"))!;

/** A `CampaignDeckEditModel` built by hand rather than through `validateDeck`: this module only ever reads its
 * `rows` (for `campaignDeckSizeSplit`'s locked/unlocked split), so a hand-built model exercises the same contract
 * without a full `CampaignDeckContext`. */
function editModelWith(grantedCardId: string | null): CampaignDeckEditModel {
  const rows: CampaignDeckEditRow[] = rocket.cards.map((line) => ({
    cardId: line.cardId,
    quantity: line.quantity,
    locked: false,
    lockedReason: null,
    refused: false,
    refusedReason: null,
  }));
  if (grantedCardId) {
    rows.push({
      cardId: cardId(grantedCardId),
      quantity: 1,
      locked: true,
      lockedReason: "Added by the campaign — does not count toward deck size",
      refused: false,
      refusedReason: null,
    });
  }
  return { validation: { ok: true }, rows, editingDisabled: true, editingDisabledReason: "frozen" };
}

function baseInput(overrides: Partial<FrozenDeckModelInput> = {}): FrozenDeckModelInput {
  return {
    frozenCards: rocket.cards,
    editModel: editModelWith(null),
    pool: POOL_CARDS,
    grants: [],
    definition: GMW_CAMPAIGN_DEFINITION,
    frozenAtNodeId: "brotherhood-of-badoon",
    nextNodeId: "infiltrate-the-museum",
    nextPending: null,
    cardOf,
    seatFields: {},
    grantedCardIdsCampaignWide: new Set(),
    ...overrides,
  };
}

describe("frozenDeckModelOf", () => {
  it("groups the frozen snapshot into hero set / aspect / basic, all locked, from real card data", () => {
    const model = frozenDeckModelOf(baseInput());
    const heroRow = model.rows.find((r) => r.id === "heroSet")!;
    const aspectRow = model.rows.find((r) => r.id === "aspect")!;
    const basicRow = model.rows.find((r) => r.id === "basic")!;
    expect(heroRow.locked).toBe(true);
    expect(aspectRow.locked).toBe(true);
    expect(basicRow.locked).toBe(true);
    expect(heroRow.count + aspectRow.count + basicRow.count).toBe(model.countedCards);
    expect(model.countedCards).toBe(rocket.cards.reduce((sum, line) => sum + line.quantity, 0));
  });

  it("frozen since issue #1 (the node `frozenNonCampaignCardsOf` snapshots from)", () => {
    expect(frozenDeckModelOf(baseInput()).frozenSinceIssueNumber).toBe(1);
  });

  it("lists a campaign grant with its bought-issue number and citation, and it counts toward the open row, not the frozen total", () => {
    const model = frozenDeckModelOf(
      baseInput({
        editModel: editModelWith("16150"),
        grants: [{ cardId: cardId("16150"), permanence: "campaign", grantedAtNodeId: "brotherhood-of-badoon" }],
      }),
    );
    expect(model.campaignCards).toHaveLength(1);
    const row = model.campaignCards[0]!;
    expect(row.name).toBe("Brainstorm");
    expect(row.boughtIssueNumber).toBe(1);
    expect(row.note).toMatch(/Bought after #1/);
    expect(row.citation).toBe("MC16 p. 5");
    expect(model.campaignCardCount).toBe(1);
    const marketRow = model.rows.find((r) => r.id === "campaignCards")!;
    expect(marketRow.locked).toBe(false);
    expect(marketRow.count).toBe(1);
    expect(model.totalCards).toBe(model.countedCards + 1);
  });

  it("Market status: openNow when the next pending choice is Market-shaped", () => {
    const pending = {
      instructionId: "mc16.s2.market.tier1.slot1",
      slot: "market-1-1",
      text: "Add a card from The Market.",
      citation: "MC16 p. 5",
      chooser: "eachSeat" as const,
      seatNumber: 1,
      options: ["16150"],
      count: 1,
      optional: true,
    };
    const model = frozenDeckModelOf(baseInput({ nextPending: pending }));
    expect(model.market).toEqual({ kind: "openNow" });
    expect(frozenDeckMarketCta(model.market)).toEqual({ enabled: true, reason: null });
  });

  it("Market status: answerBriefingFirst when a non-Market choice is next", () => {
    const pending = {
      instructionId: "mc16.s2.some-choice",
      slot: "some-choice",
      text: "Some other setup choice.",
      citation: "MC16 p. 8",
      chooser: "eachSeat" as const,
      seatNumber: 1,
      options: ["a", "b"],
      count: 1,
      optional: false,
    };
    const model = frozenDeckModelOf(baseInput({ nextPending: pending }));
    expect(model.market).toEqual({ kind: "answerBriefingFirst" });
    expect(frozenDeckMarketCta(model.market).enabled).toBe(false);
  });

  it("Market status: opensAtIssue when nothing is pending yet but a future node writes the Wallet's card list", () => {
    const model = frozenDeckModelOf(baseInput({ nextPending: null, nextNodeId: "infiltrate-the-museum" }));
    expect(model.market).toEqual({ kind: "opensAtIssue", issueNumber: 2 });
    const cta = frozenDeckMarketCta(model.market);
    expect(cta.enabled).toBe(false);
    expect(cta.reason).toMatch(/issue #2/);
  });

  it("Market status: noneRemaining once the campaign has no next node", () => {
    const model = frozenDeckModelOf(baseInput({ nextNodeId: null, nextPending: null }));
    expect(model.market).toEqual({ kind: "noneRemaining" });
  });

  it("Market hint: balance and the cheapest affordable catalog card, excluding cards already granted campaign-wide", () => {
    const model = frozenDeckModelOf(baseInput({ seatFields: { units: { kind: "number", value: 1 } } }));
    expect(model.marketHint?.balanceLabel).toBe("1 unit saved");
    expect(model.marketHint?.affordableCardName).toBe("Brainstorm");

    const excluded = frozenDeckModelOf(
      baseInput({
        seatFields: { units: { kind: "number", value: 1 } },
        grantedCardIdsCampaignWide: new Set([cardId("16150")]),
      }),
    );
    expect(excluded.marketHint?.affordableCardName).not.toBe("Brainstorm");
  });

  it("Market hint: no affordable card at zero units", () => {
    const model = frozenDeckModelOf(baseInput({ seatFields: {} }));
    expect(model.marketHint?.balanceLabel).toBe("0 units saved");
    expect(model.marketHint?.affordableCardName).toBeNull();
  });
});

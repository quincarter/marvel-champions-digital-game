/**
 * MC32 p. 12 (Master Mold victory): allies that ended the game under Find the Prisoners "cannot be used for the rest of
 * the campaign". When one is an ally of the hero's own identity set (Shadowcat the ally in Colossus's set), the deck
 * must stay buildable: the struck card is absent from the set for good, not a missing identity-set card. The deck is
 * then one card under its minimum, which does not move (MC10 p. 12: "If this causes your deck to fall below the
 * minimum number of cards, then you must add a card to your deck"; MC32 is silent; owner ruling, 2026-10-05), so the
 * player adds one legal card.
 */
import { describe, expect, it } from "vitest";
import {
  applyCampaignResult,
  cardLegalForIdentity,
  resolveBetweenGames,
  validateDeck,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
} from "@mc/engine";
import { WAVE6_CARDS } from "../wave6/index.js";
import { logBefore } from "../wave6/mut_gen/campaign-cards-testing.js";
import { MUT_GEN_CAMPAIGN_DEFINITION as DEF } from "./mut_gen.js";

const DEPS: CampaignDeps = { pool: WAVE6_CARDS };

function settle<T>(step: (answers: readonly CampaignChoiceAnswer[]) => { kind: string; value?: T; choice?: never }): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let i = 0; i < 64; i++) {
    const result = step(answers) as { kind: "done"; value: T } | { kind: "pending"; choice: any };
    if (result.kind === "done") return result.value;
    const c = result.choice;
    answers.push({
      instructionId: c.instructionId,
      slot: c.slot,
      seatNumber: c.seatNumber,
      picked: c.slot === "role" ? ["brawler"] : [],
    });
  }
  throw new Error("too many choices");
}

describe("a struck identity-set ally (MC32 p. 12)", () => {
  it("leaves the hero's deck one card short, legal again once a card other than the struck ally is added", () => {
    const composed = settle<CampaignLog>(
      (answers) => resolveBetweenGames(DEF, logBefore(2), DEPS, logBefore(2).modes, answers) as never,
    );
    const colossus = composed.seats[0]!;
    const ally = WAVE6_CARDS.find(
      (card) => card.type === "ally" && card.aspect === `hero:${colossus.identityCardId as string}`,
    );
    if (!ally) throw new Error("Colossus's set has no ally");
    expect(colossus.deck.cards.some((line) => line.cardId === ally.id)).toBe(true);

    const result: CampaignGameResult = {
      nodeId: "master-mold",
      outcome: "won",
      records: [
        {
          instructionId: "mc32.s3.victory.held-allies",
          write: {
            field: "heldAllies",
            seatNumber: null,
            mode: "set",
            value: { kind: "cardList", cardIds: [ally.id] as never },
          },
        },
      ],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const after = settle<CampaignLog>(
      (answers) =>
        applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "struck" }, DEPS, answers) as never,
    );
    expect(after.removedFromCampaign.map((face) => face.cardId)).toContain(ally.id);
    const seat = after.seats[0]!;
    expect(seat.deck.cards.some((line) => line.cardId === ally.id)).toBe(false);

    const context = {
      campaign: {
        campaignId: "mut_gen",
        campaignSetIds: [],
        identityCardId: seat.identityCardId as string,
        grantedCardIds: seat.grants.map((grant) => grant.cardId as string),
        removedFromCampaign: after.removedFromCampaign,
      },
    };
    const codes = (deck: typeof seat.deck, over: Partial<typeof context.campaign> = {}) => {
      const verdict = validateDeck(deck, WAVE6_CARDS, { campaign: { ...context.campaign, ...over } });
      return verdict.ok ? [] : verdict.problems.map((p) => p.code);
    };
    const withLine = (id: string): typeof seat.deck => ({
      ...seat.deck,
      cards: [...seat.deck.cards, { cardId: id as never, quantity: 1 }],
    });

    // The fold took the ally out and added nothing: the deck is short one card, and that is its only problem.
    const verdict = validateDeck(seat.deck, WAVE6_CARDS, context);
    expect(verdict.ok ? [] : verdict.problems.map((p) => [p.code, p.message])).toEqual([
      [
        "deck_size",
        "The deck has 39 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
      ],
    ]);

    // One legal card (a basic card the deck does not hold yet) brings it back to 40.
    const identity = WAVE6_CARDS.find((card) => card.id === seat.identityCardId);
    if (identity?.type !== "hero_identity") throw new Error("seat 1 has no identity");
    const spare = WAVE6_CARDS.find(
      (card) =>
        card.type === "event" &&
        card.aspect === "basic" &&
        cardLegalForIdentity(card, identity) &&
        !seat.deck.cards.some((line) => line.cardId === card.id) &&
        codes(withLine(card.id)).length === 0,
    );
    if (!spare) throw new Error("no basic card legal for this deck");
    expect(codes(withLine(spare.id))).toEqual([]);

    // The struck ally cannot be the card added.
    expect(codes(withLine(ally.id))).toEqual(["campaign_removed_card", "deck_size"]);

    // The control: the same deck with no removal on record is short a set card as well as a card.
    expect(codes(seat.deck, { removedFromCampaign: [] })).toEqual(["deck_size", "identity_set_mismatch"]);
  }, 60_000);
});

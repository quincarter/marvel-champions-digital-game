/**
 * MC27 p. 4: "During a campaign, campaign-specific cards may be added to … player decks. These cards cannot be
 * included in a deck unless players are playing the Sinister Motives campaign." The generic `specificTo: { kind:
 * "campaign" }` mechanism this rests on is proven abstractly (synthetic fixtures) in `packages/engine/src/
 * deck.test.ts`'s "campaign-specific cards" describe block; `mts-campaign-cards-availability.test.ts` proves it
 * with MTS content. This file is the same proof for the real SM content: the eight "Campaign - S.H.I.E.L.D. Tech"
 * upgrades (182-189), each `deckLimit: 1`.
 *
 * `sm.ts`'s own reputation node 1 is the box's only instruction that grants one of these (driven through the runner
 * in `sm.test.ts`). This file does not depend on that instruction: it constructs a `CampaignDeckContext` by hand, the
 * same way `mts-campaign-cards-availability.test.ts` does, so it proves the *deck-legality* rule works for SM's
 * real cards independently of how the grant is produced.
 */
import { describe, expect, it } from "vitest";
import { cardId, SM_STARTER_DECKS, type DeckContents } from "@mc/content";
import { validateDeck, type CampaignDeckContext, type DeckContext } from "@mc/engine";
import { WAVE5_CARDS } from "../wave5/index.js";
import { SM_CAMPAIGN_DEFINITION } from "./sm.js";

const COMPACT_DARTS = cardId("27182a");
const WRIST_NAVIGATOR = cardId("27189a");

function ghostSpiderDeck(): DeckContents {
  const starter = SM_STARTER_DECKS.find((deck) => (deck.id as string) === "ghost-spider");
  if (!starter) throw new Error("no sm starter deck ghost-spider");
  return { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards };
}

function withCard(deck: DeckContents, id: string, quantity: number): DeckContents {
  return { ...deck, cards: [...deck.cards.filter((e) => e.cardId !== id), { cardId: cardId(id), quantity }] };
}

function inSmCampaign(over: Partial<CampaignDeckContext> = {}): DeckContext {
  return {
    campaign: {
      campaignId: SM_CAMPAIGN_DEFINITION.campaignId,
      campaignSetIds: ["shield_tech"],
      identityCardId: ghostSpiderDeck().identityCardId,
      grantedCardIds: [],
      ...over,
    },
  };
}

const codesOf = (deck: DeckContents, context?: DeckContext) => {
  const verdict = validateDeck(deck, WAVE5_CARDS, context);
  return verdict.ok ? [] : verdict.problems.map((p) => p.code);
};

describe("MC27's campaign-only S.H.I.E.L.D. Tech upgrades (Compact Darts 27182a, Wrist Navigator 27189a)", () => {
  it.each([
    ["Compact Darts", COMPACT_DARTS],
    ["Wrist Navigator", WRIST_NAVIGATOR],
  ])("%s: illegal in a standalone deck (no campaign context)", (_name, id) => {
    expect(codesOf(withCard(ghostSpiderDeck(), id, 1))).toEqual(["campaign_card"]);
  });

  it.each([
    ["Compact Darts", COMPACT_DARTS],
    ["Wrist Navigator", WRIST_NAVIGATOR],
  ])("%s: illegal in a deck built for a different campaign", (_name, id) => {
    expect(codesOf(withCard(ghostSpiderDeck(), id, 1), inSmCampaign({ campaignSetIds: ["mts_campaign"] }))).toEqual([
      "campaign_card",
    ]);
  });

  it.each([
    ["Compact Darts", COMPACT_DARTS],
    ["Wrist Navigator", WRIST_NAVIGATOR],
  ])("%s: illegal in an SM-campaign deck the campaign has not granted it to", (_name, id) => {
    expect(codesOf(withCard(ghostSpiderDeck(), id, 1), inSmCampaign())).toEqual(["campaign_card_not_granted"]);
  });

  it.each([
    ["Compact Darts", COMPACT_DARTS],
    ["Wrist Navigator", WRIST_NAVIGATOR],
  ])("%s: legal once the SM campaign has granted exactly one copy, and no more (deckLimit 1)", (_name, id) => {
    const granted = inSmCampaign({ grantedCardIds: [id] });
    expect(codesOf(withCard(ghostSpiderDeck(), id, 1), granted)).toEqual([]);
    expect(codesOf(withCard(ghostSpiderDeck(), id, 2), granted)).toEqual(["campaign_card_not_granted"]);
  });

  it("a standalone (non-campaign) deck is otherwise unaffected: the starter deck itself is still legal", () => {
    expect(codesOf(ghostSpiderDeck())).toEqual([]);
  });
});

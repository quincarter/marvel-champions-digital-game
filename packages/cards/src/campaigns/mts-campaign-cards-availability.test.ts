/**
 * MC21 p. 4: "Cards 180-193 … cannot be included in any deck unless a set of campaign instructions specifically
 * directs you to add them." The generic `specificTo: { kind: "campaign" }` mechanism this rests on is proven
 * abstractly (synthetic fixtures) in `packages/engine/src/deck.test.ts`'s "campaign-specific cards" describe block;
 * this file proves the same rule with the real MTS content (Shawarma 21183, System Shock 21185, Norn Stone 21187a
 * — the three campaign cards `mts.ts`'s `poolDeckGrant` actually adds to a deck) and the real `MTS_CAMPAIGN` record,
 * which the generic test cannot, since it never touches `@mc/content`.
 */
import { describe, expect, it } from "vitest";
import { cardId, MTS_STARTER_DECKS, type DeckContents } from "@mc/content";
import { validateDeck, type CampaignDeckContext, type DeckContext } from "@mc/engine";
import { WAVE4_CARDS } from "../wave4/index.js";
import { MTS_CAMPAIGN_DEFINITION } from "./mts.js";

const SHAWARMA = cardId("21183");
const SYSTEM_SHOCK = cardId("21185");
const NORN_STONE = cardId("21187a");

function spectrumDeck(): DeckContents {
  const starter = MTS_STARTER_DECKS.find((deck) => (deck.id as string) === "spectrum-leadership");
  if (!starter) throw new Error("no mts starter deck spectrum-leadership");
  return { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards };
}

function withCard(deck: DeckContents, id: string, quantity: number): DeckContents {
  return { ...deck, cards: [...deck.cards.filter((e) => e.cardId !== id), { cardId: cardId(id), quantity }] };
}

function inMtsCampaign(over: Partial<CampaignDeckContext> = {}): DeckContext {
  return {
    campaign: {
      campaignId: MTS_CAMPAIGN_DEFINITION.campaignId,
      campaignSetIds: ["mts_campaign"],
      identityCardId: spectrumDeck().identityCardId,
      grantedCardIds: [],
      ...over,
    },
  };
}

const codesOf = (deck: DeckContents, context?: DeckContext) => {
  const verdict = validateDeck(deck, WAVE4_CARDS, context);
  return verdict.ok ? [] : verdict.problems.map((p) => p.code);
};

describe("MC21's campaign-only cards, the ordinary player-card shape (Shawarma 21183 [resource], Norn Stone 21187a [upgrade])", () => {
  it.each([
    ["Shawarma", SHAWARMA],
    ["Norn Stone", NORN_STONE],
  ])("%s: illegal in a standalone deck (no campaign context)", (_name, id) => {
    expect(codesOf(withCard(spectrumDeck(), id, 1))).toEqual(["campaign_card"]);
  });

  it.each([
    ["Shawarma", SHAWARMA],
    ["Norn Stone", NORN_STONE],
  ])("%s: illegal in a deck built for a different campaign", (_name, id) => {
    expect(codesOf(withCard(spectrumDeck(), id, 1), inMtsCampaign({ campaignSetIds: ["gmw_campaign"] }))).toEqual([
      "campaign_card",
    ]);
  });

  it.each([
    ["Shawarma", SHAWARMA],
    ["Norn Stone", NORN_STONE],
  ])("%s: illegal in an MTS-campaign deck the campaign has not granted it to", (_name, id) => {
    expect(codesOf(withCard(spectrumDeck(), id, 1), inMtsCampaign())).toEqual(["campaign_card_not_granted"]);
  });

  it.each([
    ["Shawarma", SHAWARMA],
    ["Norn Stone", NORN_STONE],
  ])("%s: legal once the MTS campaign has granted exactly one copy, and no more", (_name, id) => {
    const granted = inMtsCampaign({ grantedCardIds: [id] });
    expect(codesOf(withCard(spectrumDeck(), id, 1), granted)).toEqual([]);
    expect(codesOf(withCard(spectrumDeck(), id, 2), granted)).toEqual(["campaign_card_not_granted"]);
  });

  it("a standalone (non-campaign) deck is otherwise unaffected: the starter deck itself is still legal", () => {
    expect(codesOf(spectrumDeck())).toEqual([]);
  });
});

describe("System Shock (21185): the obligation-in-a-player-deck shape (MC10 p. 17, 'Obligations in Player Decks')", () => {
  // System Shock is `type: "obligation"` — an encounter card, not a player card — despite MC21's own text having
  // players shuffle it into their *deck* like Shawarma/Norn Stone. `validateDeck` (`packages/engine/src/deck.ts`)
  // carries a distinct carve-out for exactly this shape (obligations granted by a campaign into a player deck),
  // checked *before* the generic `specificTo.kind === "campaign"` branch that Shawarma/Norn Stone go through — so
  // an ungranted obligation is refused by the ordinary "encounter cards cannot be in a player deck" rule
  // (`not_a_player_card`), not the campaign-specific codes, and once granted it is accepted without a further
  // campaign-membership check (the grant itself, made only by the campaign that owns the card, is what "directed
  // you to add" it — RRG 1.8 p. 11). Read from `deck.ts`'s own comment on that branch, not guessed: confirmed live
  // below rather than assumed, since this exact combination (obligation + `specificTo: campaign`) did not exist in
  // any campaign before MC21 and so was never exercised with real content until this test.
  it("is illegal in a standalone deck (no campaign context) — the generic obligation-cannot-be-in-a-deck rule, not a campaign-specific code", () => {
    expect(codesOf(withCard(spectrumDeck(), SYSTEM_SHOCK, 1))).toEqual(["not_a_player_card"]);
  });

  it("is illegal in an MTS-campaign deck the campaign has not granted it to — same generic code, since the grant is what makes it a player card at all", () => {
    expect(codesOf(withCard(spectrumDeck(), SYSTEM_SHOCK, 1), inMtsCampaign())).toEqual(["not_a_player_card"]);
  });

  it("is legal once the MTS campaign has granted exactly one copy, and no more", () => {
    const granted = inMtsCampaign({ grantedCardIds: [SYSTEM_SHOCK] });
    expect(codesOf(withCard(spectrumDeck(), SYSTEM_SHOCK, 1), granted)).toEqual([]);
    expect(codesOf(withCard(spectrumDeck(), SYSTEM_SHOCK, 2), granted)).toEqual(["not_a_player_card"]);
  });

  it("a removal from the campaign (RRG 1.8 p. 29) still stops a granted copy, even though the obligation carve-out skips the campaign-membership check", () => {
    const granted = inMtsCampaign({ grantedCardIds: [SYSTEM_SHOCK], removedFromCampaign: [{ cardId: SYSTEM_SHOCK }] });
    expect(codesOf(withCard(spectrumDeck(), SYSTEM_SHOCK, 1), granted)).toEqual(["campaign_removed_card"]);
  });
});

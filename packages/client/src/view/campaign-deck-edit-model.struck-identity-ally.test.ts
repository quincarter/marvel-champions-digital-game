/**
 * The deck editor after MC32 p. 12 strikes an ally of the hero's own identity set (Shadowcat the ally in Colossus's
 * set, held under Find the Prisoners). The struck card is gone for good, and the 40-card minimum does not move (MC10
 * p. 12: "If this causes your deck to fall below the minimum number of cards, then you must add a card to your deck";
 * MC32 is silent; owner ruling, 2026-10-05). So the editor shows a 39-card deck that is short one card, never asks for
 * the struck ally back, and saves a legal deck once the player adds one card.
 */
import { describe, expect, it } from "vitest";
import { MUT_GEN_CAMPAIGN, type AnyCard, type Deck } from "@mc/content";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import {
  campaignDeckContextOf,
  campaignDeckEditModel,
  removedFromCampaignCardIds,
} from "./campaign-deck-edit-model.js";
import { addCard, browsablePool } from "./deck-builder-model.js";
import { preconDecks } from "./deck-list-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

const codesOf = (model: ReturnType<typeof campaignDeckEditModel>): readonly string[] =>
  model.validation.ok ? [] : model.validation.problems.map((problem) => problem.code);

describe("editing a Colossus deck whose identity-set ally was struck from the campaign", () => {
  it("is 39 cards and short one; one added card saves a legal deck, and the struck ally is never asked back", async () => {
    const svc = service();
    const precon = (hero: string) => {
      const found = preconDecks(POOL_VERSION).find((deck) => (deck.id as string).includes(hero));
      if (!found) throw new Error(`no precon for ${hero}`);
      return { identityCardId: found.identityCardId, deck: found };
    };
    const started = await svc.start({
      campaignId: "mut_gen",
      seats: [precon("colossus")],
      expertCampaign: false,
      poolVersion: POOL_VERSION,
      seed: 32,
    });
    const identity = POOL_CARDS.find((card) => card.id === started.seats[0]!.identityCardId);
    if (identity?.type !== "hero_identity") throw new Error("seat 1 has no identity");
    const ally = POOL_CARDS.find((card) => card.type === "ally" && card.aspect === `hero:${identity.id as string}`);
    if (!ally) throw new Error("Colossus's set has no ally");
    expect(started.seats[0]!.deck.cards.some((line) => line.cardId === ally.id)).toBe(true);

    // The stored run as the Master Mold fold leaves it: the ally struck from the campaign (RRG 1.8 p. 29).
    await svc.storage.put({ ...started, removedFromCampaign: [{ cardId: ally.id }] });
    const record = (await svc.load(started.id as string))!;
    const seat = record.seats[0]!;
    expect(seat.deck.cards.some((line) => line.cardId === ally.id)).toBe(false);

    const context = campaignDeckContextOf(MUT_GEN_CAMPAIGN, record, 1);
    const deck: Deck = {
      id: "campaign-deck" as Deck["id"],
      name: "Colossus",
      identityCardId: seat.deck.identityCardId,
      aspects: seat.deck.aspects,
      cards: seat.deck.cards,
      poolVersion: POOL_VERSION,
      source: { kind: "userBuilt", createdAt: "2026-10-05T00:00:00.000Z" },
      updatedAt: "2026-10-05T00:00:00.000Z",
    };
    const opened = campaignDeckEditModel(deck, POOL_CARDS, context, seat.grants);
    expect(codesOf(opened)).toEqual(["deck_size"]);
    expect(opened.validation.ok ? "" : opened.validation.problems[0]!.message).toBe(
      "The deck has 39 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
    );
    expect(opened.rows.some((row) => row.refused)).toBe(false);

    // The struck ally is kept out of what the editor offers; adding it anyway is refused, not a fix.
    expect(removedFromCampaignCardIds(context).has(ally.id)).toBe(true);
    const forced = campaignDeckEditModel(addCard(deck, ally.id), POOL_CARDS, context, seat.grants);
    expect(codesOf(forced)).toEqual(["campaign_removed_card", "deck_size"]);
    expect(forced.rows.find((row) => row.cardId === ally.id)?.refused).toBe(true);

    // One card from the editor's own list (a basic event whose title the deck does not hold) makes it 40 and legal.
    const nameOf = (id: string): string => POOL_CARDS.find((card) => card.id === id)?.name ?? id;
    const held = new Set(deck.cards.map((line) => nameOf(line.cardId as string)));
    const offered: readonly AnyCard[] = browsablePool(POOL_CARDS, identity, deck.aspects).filter(
      (card) => !removedFromCampaignCardIds(context).has(card.id),
    );
    const pick = offered.find((card) => card.type === "event" && card.aspect === "basic" && !held.has(card.name));
    if (!pick) throw new Error("the editor offers no basic event the deck lacks");
    const fixed = addCard(deck, pick.id);
    expect(codesOf(campaignDeckEditModel(fixed, POOL_CARDS, context, seat.grants))).toEqual([]);

    // Saved, reloaded, and still legal.
    await svc.setSeatDeck(record, 1, fixed);
    const saved = (await svc.load(record.id as string))!;
    const savedSeat = saved.seats[0]!;
    expect(savedSeat.deck.cards.reduce((sum, line) => sum + line.quantity, 0)).toBe(
      seat.deck.cards.reduce((sum, line) => sum + line.quantity, 0) + 1,
    );
    expect(
      codesOf(
        campaignDeckEditModel(
          savedSeat.deck,
          POOL_CARDS,
          campaignDeckContextOf(MUT_GEN_CAMPAIGN, saved, 1),
          savedSeat.grants,
        ),
      ),
    ).toEqual([]);
  });
});

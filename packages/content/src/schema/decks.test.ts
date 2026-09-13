/// <reference types="node" />
import { readFileSync } from "node:fs";
import { CORE_CARDS, CORE_STARTER_DECKS } from "../data/index.js";
import { deckFromStarterDeck, type AnyCard, type PlayerCard } from "./index.js";

/**
 * PLAN.md Phase 9: "Our CardId *is* the MarvelCDB card code". The whole import path rests on
 * this, because a MarvelCDB decklist then maps onto our pool with no translation table. These
 * tests make that assumption fail visibly if ingestion ever changes it.
 */
interface RawRecord {
  readonly code: string;
  readonly type_code: string;
  readonly faction_code: string;
  readonly deck_limit?: number | null;
}
const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/core.json", import.meta.url), "utf8")) as { cards: RawRecord[] };
const rawByCode = new Map(raw.cards.map((r) => [r.code, r]));
const byId = new Map<string, AnyCard>(CORE_CARDS.map((c) => [c.id, c]));

const isPlayer = (card: AnyCard): card is PlayerCard => "deckLimit" in card;
/** Everything a decklist can name: identities and player cards. */
const deckable = CORE_CARDS.filter((c) => c.type === "hero_identity" || isPlayer(c));

describe("CardId is the MarvelCDB card code", () => {
  it("every Core identity and player card has the id of a top-level MarvelCDB record of the same kind", () => {
    expect(deckable.length).toBeGreaterThan(90);
    for (const card of deckable) {
      const record = rawByCode.get(card.id);
      expect(record, card.id).toBeDefined();
      expect(record?.type_code, card.id).toBe(card.type === "hero_identity" ? "hero" : card.type);
      if (isPlayer(card)) {
        expect(record?.deck_limit, card.id).toBe(card.deckLimit);
        expect(record?.faction_code, card.id).toBe(card.aspect.startsWith("hero:") ? "hero" : card.aspect);
      }
    }
  });

  it("every player-side MarvelCDB code resolves to a card with exactly that id", () => {
    const playerSide = raw.cards.filter((r) => r.faction_code !== "encounter");
    expect(playerSide.length).toBe(deckable.length);
    for (const record of playerSide) expect(byId.has(record.code), record.code).toBe(true);
  });

  it("every Core starter deck line and identity is a MarvelCDB code", () => {
    for (const deck of CORE_STARTER_DECKS) {
      expect(rawByCode.has(deck.identityCardId), deck.id).toBe(true);
      for (const { cardId } of deck.cards) expect(rawByCode.has(cardId), `${deck.id} ${cardId}`).toBe(true);
    }
  });
});

describe("deckFromStarterDeck: a precon is the precon case of a Deck", () => {
  it.each(CORE_STARTER_DECKS.map((d) => [d.id, d] as const))("%s", (_id, starter) => {
    const deck = deckFromStarterDeck(starter, "core@test");
    expect(deck.id).toBe(`precon:${starter.id}`);
    expect(deck.name).toBe(starter.name);
    expect(deck.identityCardId).toBe(starter.identityCardId);
    expect(deck.aspects).toEqual(starter.aspects);
    expect(deck.cards).toEqual(starter.cards);
    expect(deck.poolVersion).toBe("core@test");
    expect(deck.source).toEqual({ kind: "precon", packCode: starter.packCode, starterDeckId: starter.id });
    // Plain data: survives a save/load round trip unchanged.
    expect(JSON.parse(JSON.stringify(deck))).toEqual(deck);
  });
});

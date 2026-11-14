import type { Deck, HeroIdentityCard } from "@mc/content";
import { validateDeck } from "@mc/engine";
import { POOL_CARDS } from "../content/pool.js";
import { addCard, newDeck, setAspects } from "./deck-builder-model.js";

/** A legal deck for `identityId`: its identity set plus basic and aggression cards, one copy at a time, until the engine says legal. */
export function legalDeckFor(identityId: string): Deck {
  const identity = POOL_CARDS.find(
    (c) => (c.id as string) === identityId && c.type === "hero_identity",
  ) as HeroIdentityCard;
  let deck = setAspects(newDeck(identity, POOL_CARDS, `legal-${identityId}`, "test", "2026-01-01"), ["aggression"]);
  const candidates = POOL_CARDS.filter(
    (c) =>
      (c.type === "event" || c.type === "ally" || c.type === "support" || c.type === "upgrade") &&
      !(c as { unique?: boolean }).unique &&
      ((c as { aspect?: string }).aspect === "basic" || (c as { aspect?: string }).aspect === "aggression"),
  );
  for (let round = 0; round < 3 && !validateDeck(deck, POOL_CARDS).ok; round++) {
    for (const card of candidates) {
      if (validateDeck(deck, POOL_CARDS).ok) break;
      const next = addCard(deck, card.id);
      if (validateDeck(next, POOL_CARDS).ok || (validateDeck(next, POOL_CARDS).ok === false && deckCount(next) <= 50))
        deck = next;
    }
  }
  return deck;
}
const deckCount = (deck: Deck) => deck.cards.reduce((n, c) => n + c.quantity, 0);

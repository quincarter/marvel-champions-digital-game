/**
 * The minimal deck builder's state and pure operations: pick an identity and
 * aspect(s), search/filter the pool, add/remove cards, read live legality.
 *
 * Every add/remove is a plain data transform; every legality read is a fresh
 * call to `@mc/engine`'s `validateDeck` — never a rule reimplemented here.
 * `BuilderState` is deliberately just a `Deck` plus a `name`-in-progress and a
 * filter, so "save" is "hand the `Deck` to storage" with nothing to reconcile.
 */
import { deckId, type AnyCard, type CardId, type CardType, type CoreAspect, type Deck, type DeckCardEntry, type HeroIdentityCard, type Trait } from "@mc/content";
import { CHOOSABLE_ASPECTS, requiredIdentitySet, validateDeck, type CardPool, type DeckValidation } from "@mc/engine";

export interface PoolFilter {
  readonly text?: string;
  readonly aspect?: CoreAspect | "basic" | "identity" | null;
  readonly type?: CardType | null;
  readonly trait?: Trait | null;
  readonly maxCost?: number | null;
}

const cardsOf = (pool: CardPool): readonly AnyCard[] => (Array.isArray(pool) ? pool : Object.values(pool));

/** Every hero identity in the pool, for the "pick an identity" step, sorted by name. */
export function identityOptions(pool: CardPool): readonly HeroIdentityCard[] {
  return cardsOf(pool)
    .filter((card): card is HeroIdentityCard => card.type === "hero_identity")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** How many aspects `identity` requires the deck to choose (RRG default 1; `IdentityDeckbuilding.aspectCount` overrides it). */
export function aspectCountFor(identity: HeroIdentityCard): number {
  const n = identity.deckbuilding?.aspectCount;
  return Number.isInteger(n) && (n as number) >= 1 ? (n as number) : 1;
}

/**
 * A new deck for `identity`, starting from its identity set (the engine's `requiredIdentitySet`).
 *
 * Every deck for that hero must hold those cards at their exact quantities, so the builder
 * puts them in rather than making the player add each signature card by hand; it used to start
 * empty, opening on a wall of "is missing" problems. No aspect is chosen yet, so the deck stays
 * illegal until the player picks one and fills out the rest.
 */
export function newDeck(identity: HeroIdentityCard, pool: CardPool, id: string, poolVersion: string, now: string): Deck {
  return {
    id: deckId(id),
    name: `${identity.name} (new deck)`,
    identityCardId: identity.id,
    aspects: [],
    cards: requiredIdentitySet(identity, pool),
    poolVersion,
    source: { kind: "userBuilt", createdAt: now },
  };
}

const matchesFilter = (card: AnyCard, filter: PoolFilter): boolean => {
  if (filter.type && card.type !== filter.type) return false;
  if (filter.text && !card.name.toLowerCase().includes(filter.text.toLowerCase())) return false;
  if ("traits" in card && filter.trait && !(card.traits as readonly Trait[]).includes(filter.trait)) return false;
  if ("cost" in card && typeof filter.maxCost === "number" && (card as { cost: number }).cost > filter.maxCost) return false;
  if (filter.aspect) {
    const aspect = "aspect" in card ? (card as { aspect: string }).aspect : null;
    if (filter.aspect === "identity" ? !aspect?.startsWith("hero:") : aspect !== filter.aspect) return false;
  }
  return true;
};

/**
 * Cards a player could add to a deck for `identity`: player-deck types
 * (allies, events, supports, upgrades, resources, player side schemes) whose
 * aspect is basic, one of the deck's chosen aspects, or this identity's own
 * signature set — narrowed further by `filter`. Cards outside those aspects
 * are left out of the *browseable* list entirely (there is nothing to search
 * for in an aspect the deck can never use), which is a convenience, not a
 * legality check: `validateDeck` is still what judges the deck that results.
 */
export function browsablePool(pool: CardPool, identity: HeroIdentityCard, chosenAspects: readonly CoreAspect[], filter: PoolFilter = {}): readonly AnyCard[] {
  const PLAYER_TYPES = new Set<CardType>(["ally", "event", "support", "upgrade", "resource", "player_side_scheme"]);
  return cardsOf(pool)
    .filter((card) => PLAYER_TYPES.has(card.type))
    .filter((card) => {
      const aspect = "aspect" in card ? (card as { aspect: string }).aspect : "";
      return aspect === "basic" || chosenAspects.includes(aspect as CoreAspect) || aspect === `hero:${identity.id}`;
    })
    .filter((card) => matchesFilter(card, filter))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function withQuantity(cards: readonly DeckCardEntry[], cardId: CardId, delta: number): readonly DeckCardEntry[] {
  const existing = cards.find((c) => c.cardId === cardId);
  const next = Math.max(0, (existing?.quantity ?? 0) + delta);
  const withoutIt = cards.filter((c) => c.cardId !== cardId);
  return next > 0 ? [...withoutIt, { cardId, quantity: next }] : withoutIt;
}

/** Adds one copy of `cardId` to the deck (a fresh line at quantity 1 if it isn't in the deck yet). */
export function addCard(deck: Deck, cardId: CardId): Deck {
  return { ...deck, cards: withQuantity(deck.cards, cardId, 1) };
}

/** Removes one copy; the line disappears once its quantity reaches 0. */
export function removeCard(deck: Deck, cardId: CardId): Deck {
  return { ...deck, cards: withQuantity(deck.cards, cardId, -1) };
}

export function setAspects(deck: Deck, aspects: readonly CoreAspect[]): Deck {
  return { ...deck, aspects };
}

export function setName(deck: Deck, name: string): Deck {
  return { ...deck, name };
}

/** Live legality, exactly as the Decks screen and `createGame` see it — never a client-side approximation. */
export function legalityOf(deck: Deck, pool: CardPool): DeckValidation {
  return validateDeck(deck, pool);
}

/** The aspects selectable in the picker, in a stable order. */
export const SELECTABLE_ASPECTS: readonly CoreAspect[] = CHOOSABLE_ASPECTS;

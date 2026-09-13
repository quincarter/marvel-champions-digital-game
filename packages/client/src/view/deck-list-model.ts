/**
 * The Decks screen's list: every precon plus every saved deck, each carrying
 * the engine's own verdict on it. Pure and Vitest-testable; no Phaser here.
 *
 * "Rules stay out of the client": legality (`validateDeck`) and playability
 * (`unscriptedCards`) are never recomputed here, only asked of `@mc/engine` —
 * the same boundary `legalActions`/`highlights.ts` already draws for the
 * Board. This module's own job is smaller than it looks: fold those two
 * verdicts, plus "has the pool moved under this deck", into one status a
 * screen can render without itself knowing a rule.
 */
import {
  CORE_POOL_VERSION,
  CORE_STARTER_DECKS,
  deckFromStarterDeck,
  type AnyCard,
  type CardId,
  type Deck,
  type HeroIdentityCard,
} from "@mc/content";
import { unscriptedCards, validateDeck, type CardPool, type DeckProblem, type EngineDeps } from "@mc/engine";

export interface DeckOption {
  readonly deck: Deck;
  /** The chosen identity's current display name, or null when the identity itself doesn't resolve (an unknown-card problem already says why). */
  readonly identityName: string | null;
  readonly legal: boolean;
  readonly problems: readonly DeckProblem[];
  /** Cards this deck would use that have no ability script yet — "legal but not playable in this build" (`unscriptedCards`). Empty when the deck is illegal; there is no point reporting playability of a deck that can't be seated regardless. */
  readonly unscripted: readonly CardId[];
  /** `deck.poolVersion` no longer matches the pool this option was built against: re-validated already (the fields above are current), but worth telling the player, since a legal card of theirs may have changed under them. */
  readonly poolChanged: boolean;
  /** May this deck be seated right now: legal by the rules and every card scripted. */
  readonly seatable: boolean;
  /** Why a seat can't be taken with this deck, in the player's words — the first legal problem, or the unscripted-card count. Null when `seatable`. */
  readonly blockedReason: string | null;
}

const cardName = (pool: CardPool, id: CardId): string | undefined => {
  const card = Array.isArray(pool) ? pool.find((c) => c.id === id) : (pool as Record<string, AnyCard>)[id as string];
  return card?.name;
};

/** Every precon deck, freshly derived from `CORE_STARTER_DECKS` — never stored, since a precon is data, not something a player edits. */
export function preconDecks(poolVersion: string = CORE_POOL_VERSION): readonly Deck[] {
  return CORE_STARTER_DECKS.map((starter) => deckFromStarterDeck(starter, poolVersion));
}

/** One deck's full status. `pool` is a real card pool (a list or `GameState.cardPool`-shaped record); `currentPoolVersion` is today's `CORE_POOL_VERSION` (or whatever the app is running). */
export function deckOptionOf(deck: Deck, pool: CardPool, currentPoolVersion: string, deps: EngineDeps): DeckOption {
  const verdict = validateDeck(deck, pool);
  const legal = verdict.ok;
  const problems = verdict.ok ? [] : verdict.problems;
  const unscripted = legal ? unscriptedCards(deck, pool, deps) : [];
  const poolChanged = deck.poolVersion !== currentPoolVersion;
  const seatable = legal && unscripted.length === 0;

  let blockedReason: string | null = null;
  if (!legal) {
    blockedReason = problems[0]?.message ?? "This deck is not legal.";
  } else if (unscripted.length > 0) {
    const names = unscripted.map((id) => cardName(pool, id) ?? id).slice(0, 3);
    const suffix = unscripted.length > names.length ? `, and ${unscripted.length - names.length} more` : "";
    blockedReason = `Not playable yet: ${names.join(", ")}${suffix} ${unscripted.length === 1 ? "has" : "have"} no card script in this build.`;
  }

  const identityCard = Array.isArray(pool)
    ? pool.find((c) => c.id === deck.identityCardId)
    : (pool as Record<string, AnyCard>)[deck.identityCardId as string];
  const identityName =
    identityCard?.type === "hero_identity" ? currentFaceName(identityCard) : (identityCard?.name ?? null);

  return { deck, identityName, legal, problems, unscripted, poolChanged, seatable, blockedReason };
}

/** A hero identity's name as shown today: whatever the printed card calls itself (the schema has no notion of "currently flipped" outside a live game — see `board-model.ts`'s live version for that). */
function currentFaceName(identity: HeroIdentityCard): string {
  return identity.name;
}

/** Every option (precons first, in `CORE_STARTER_DECKS` order, then saved decks in the order given), each with its status. */
export function deckOptionsOf(
  savedDecks: readonly Deck[],
  pool: CardPool,
  currentPoolVersion: string,
  deps: EngineDeps,
): readonly DeckOption[] {
  return [...preconDecks(currentPoolVersion), ...savedDecks].map((deck) => deckOptionOf(deck, pool, currentPoolVersion, deps));
}

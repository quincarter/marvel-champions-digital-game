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
import { deckFromStarterDeck, type AnyCard, type CardId, type Deck, type HeroIdentityCard } from "@mc/content";
import { unscriptedCards, validateDeck, type CardPool, type DeckProblem, type EngineDeps } from "@mc/engine";
import { POOL_STARTER_DECKS, POOL_VERSION } from "../content/pool.js";

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
  /**
   * May this deck be seated right now: legal by the rules. Missing card scripts no longer block a seat — a deck
   * whose only problem is `unscripted` is seatable with `warning` shown; an illegal deck is never seatable.
   */
  readonly seatable: boolean;
  /** Why a seat can't be taken with this deck, in the player's words — the first legal problem. Null when `seatable`. */
  readonly blockedReason: string | null;
  /** Named unscripted cards, shown alongside an otherwise-seatable deck so the player knows before they sit down. Null when nothing is unscripted. */
  readonly warning: string | null;
}

const cardName = (pool: CardPool, id: CardId): string | undefined => {
  const card = Array.isArray(pool) ? pool.find((c) => c.id === id) : (pool as Record<string, AnyCard>)[id as string];
  return card?.name;
};

const unscriptedMessage = (unscripted: readonly CardId[], pool: CardPool): string | null => {
  if (unscripted.length === 0) return null;
  const names = unscripted.map((id) => cardName(pool, id) ?? id).slice(0, 3);
  const suffix = unscripted.length > names.length ? `, and ${unscripted.length - names.length} more` : "";
  return `Playable, but ${names.join(", ")}${suffix} ${unscripted.length === 1 ? "does" : "do"} nothing yet.`;
};

/** Every precon deck, freshly derived from `POOL_STARTER_DECKS` (Core's six plus wave 1's six) — never stored, since a precon is data, not something a player edits. */
export function preconDecks(poolVersion: string = POOL_VERSION): readonly Deck[] {
  return POOL_STARTER_DECKS.map((starter) => deckFromStarterDeck(starter, poolVersion));
}

/** One deck's full status. `pool` is a real card pool (a list or `GameState.cardPool`-shaped record); `currentPoolVersion` is today's `POOL_VERSION` (or whatever the app is running). */
export function deckOptionOf(deck: Deck, pool: CardPool, currentPoolVersion: string, deps: EngineDeps): DeckOption {
  const verdict = validateDeck(deck, pool);
  const legal = verdict.ok;
  const problems = verdict.ok ? [] : verdict.problems;
  const unscripted = legal ? unscriptedCards(deck, pool, deps) : [];
  const poolChanged = deck.poolVersion !== currentPoolVersion;
  // Legal is the only thing that blocks a seat now — a missing card script is a warning, not a wall (PLAN.md
  // Phase 7 wave 1 client wiring: "seatable with a visible warning that names the cards").
  const seatable = legal;
  const blockedReason = legal ? null : (problems[0]?.message ?? "This deck is not legal.");
  const warning = unscriptedMessage(unscripted, pool);

  const identityCard = Array.isArray(pool)
    ? pool.find((c) => c.id === deck.identityCardId)
    : (pool as Record<string, AnyCard>)[deck.identityCardId as string];
  const identityName =
    identityCard?.type === "hero_identity" ? currentFaceName(identityCard) : (identityCard?.name ?? null);

  return { deck, identityName, legal, problems, unscripted, poolChanged, seatable, blockedReason, warning };
}

/** A hero identity's name as shown today: whatever the printed card calls itself (the schema has no notion of "currently flipped" outside a live game — see `board-model.ts`'s live version for that). */
function currentFaceName(identity: HeroIdentityCard): string {
  return identity.name;
}

/** Every option (precons first, in `POOL_STARTER_DECKS` order, then saved decks in the order given), each with its status. */
export function deckOptionsOf(
  savedDecks: readonly Deck[],
  pool: CardPool,
  currentPoolVersion: string,
  deps: EngineDeps,
): readonly DeckOption[] {
  return [...preconDecks(currentPoolVersion), ...savedDecks].map((deck) =>
    deckOptionOf(deck, pool, currentPoolVersion, deps),
  );
}

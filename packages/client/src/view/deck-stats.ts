/**
 * S1 (docs/phase4-screen-gaps.md §2): a deck's resource/cost curve, average
 * cost, and composition counts, entirely from `@mc/content` card data. This is
 * descriptive, not a rules query — nothing here decides legality or
 * playability (`@mc/engine`'s `validateDeck`/`unscriptedCards` still own
 * that) — so it belongs in the client, the same boundary `deck-list-model.ts`
 * already draws. Used by W1 (Deck check, the builder's stats panel) and W9
 * (Decks & Collection).
 *
 * **Three things the schema forced a decision on:**
 *
 * - **X costs.** Every player-card type with a printed cost
 *   (`AllyCard`/`EventCard`/`SupportCard`/`UpgradeCard`/`PlayerSideSchemeCard`)
 *   types `cost` as a plain `number`, never `PrintedStat`'s `"X" | null` —
 *   unlike ATK/THW, which do use `PrintedStat` for printed dashes. No card in
 *   the current pool (Core plus wave 1) has a variable printed cost; the
 *   "spend X [icon]" shapes in `@mc/cards` are *action-ability* costs (e.g.
 *   Captain Marvel's Energy Channel), not a card's own play cost. So the cost
 *   curve buckets by that number as-is. If a future pack ships a genuinely
 *   variable play cost, `PlayerCardCommon`/`AllyCard` etc. would need to grow
 *   a `PrintedStat`-shaped cost first, and this module would need to decide
 *   how an "X" bucket reads on a curve — that's a real design question, not
 *   answered here.
 * - **Cards with no cost.** `ResourceCard` has no `cost` field at all (RRG:
 *   a resource card isn't played for a cost — it's exhausted for icons). Such
 *   cards are excluded from `costCurve` and `averageCost`, and counted only
 *   in `countsByType.resource` and `countsByAspect`.
 * - **The identity's separate decks** (Doctor Strange's Invocation cards)
 *   need no filtering here at all: `Deck.cards`/`StarterDeck.cards` already
 *   contractually exclude them (`Deck.cards`'s own doc comment; a card with
 *   `separateDeck` set is never a legal deck entry). `deck-stats.test.ts`
 *   checks this holds for Doctor Strange's real precon rather than trusting
 *   the comment alone.
 */
import type { CardId, CardType, CoreAspect, Deck, DeckCardEntry } from "@mc/content";
import type { CardPool } from "@mc/engine";

/** The card types that can appear in a player deck (`Deck.cards`) — never `hero_identity` or any encounter/villain type. */
export type PlayerCardType = "ally" | "event" | "support" | "upgrade" | "resource" | "player_side_scheme";

export interface CostBucket {
  readonly cost: number;
  readonly count: number;
}

/** Every deck-buildable aspect grouping, matching `CoreAspect`'s named values plus `hero` for a signature card (`hero:<identityId>`, `Aspect`'s other branch — a deck only ever carries its own hero's, but this stat doesn't need to say which). */
export interface DeckAspectCounts {
  readonly aggression: number;
  readonly justice: number;
  readonly leadership: number;
  readonly protection: number;
  readonly basic: number;
  readonly pool: number;
  readonly hero: number;
}

export interface DeckStats {
  /** Every card in `deck.cards`, quantities summed — found in the pool or not. */
  readonly totalCards: number;
  /** Card ids in `deck.cards` that aren't in `pool` (an out-of-date deck, or the wrong pool passed in) — excluded from every other field below since they can't be classified. */
  readonly missingCardIds: readonly CardId[];
  /** One bucket per distinct printed cost among cost-bearing cards, ascending. Empty when the deck has none (e.g. a deck of only resources). */
  readonly costCurve: readonly CostBucket[];
  /** The quantity-weighted mean of `costCurve`. `null` when there is nothing to average (no cost-bearing cards). */
  readonly averageCost: number | null;
  readonly countsByType: Readonly<Partial<Record<PlayerCardType, number>>>;
  readonly countsByAspect: DeckAspectCounts;
}

const cardsOf = (pool: CardPool) => (Array.isArray(pool) ? pool : Object.values(pool));

const PLAYER_CARD_TYPES: ReadonlySet<string> = new Set<PlayerCardType>([
  "ally",
  "event",
  "support",
  "upgrade",
  "resource",
  "player_side_scheme",
]);

const emptyAspectCounts = (): { -readonly [K in keyof DeckAspectCounts]: number } => ({
  aggression: 0,
  justice: 0,
  leadership: 0,
  protection: 0,
  basic: 0,
  pool: 0,
  hero: 0,
});

const CORE_ASPECTS: ReadonlySet<CoreAspect> = new Set<CoreAspect>(["aggression", "justice", "leadership", "protection", "basic", "pool"]);

/** `deck`'s stats against `pool` — a real card pool (a list, or `GameState.cardPool`-shaped record). */
export function deckStatsOf(deck: Pick<Deck, "cards">, pool: CardPool): DeckStats {
  const byId = new Map(cardsOf(pool).map((card) => [card.id as string, card]));

  let totalCards = 0;
  const missingCardIds: CardId[] = [];
  const costCounts = new Map<number, number>();
  let costWeightedSum = 0;
  let costWeightedCount = 0;
  const typeCounts = new Map<PlayerCardType, number>();
  const aspectCounts = emptyAspectCounts();

  for (const entry of deck.cards as readonly DeckCardEntry[]) {
    totalCards += entry.quantity;
    const card = byId.get(entry.cardId as string);
    if (!card || !PLAYER_CARD_TYPES.has(card.type)) {
      missingCardIds.push(entry.cardId);
      continue;
    }
    const type = card.type as PlayerCardType;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + entry.quantity);

    if ("aspect" in card) {
      const aspect = card.aspect as string;
      if (aspect.startsWith("hero:")) aspectCounts.hero += entry.quantity;
      else if (CORE_ASPECTS.has(aspect as CoreAspect)) aspectCounts[aspect as CoreAspect] += entry.quantity;
    }

    if ("cost" in card) {
      const cost = card.cost as number;
      costCounts.set(cost, (costCounts.get(cost) ?? 0) + entry.quantity);
      costWeightedSum += cost * entry.quantity;
      costWeightedCount += entry.quantity;
    }
  }

  const costCurve = [...costCounts.entries()]
    .map(([cost, count]) => ({ cost, count }))
    .sort((a, b) => a.cost - b.cost);

  return {
    totalCards,
    missingCardIds,
    costCurve,
    averageCost: costWeightedCount > 0 ? costWeightedSum / costWeightedCount : null,
    countsByType: Object.fromEntries(typeCounts) as Readonly<Partial<Record<PlayerCardType, number>>>,
    countsByAspect: aspectCounts,
  };
}

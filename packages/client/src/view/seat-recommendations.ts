/**
 * Seat recommendations, shared by both seat screens (one-off Take your seats and the campaign's Sign the roster).
 *
 * Given who is already seated and the decks that could take the next seat, this says which candidates are worth a
 * look and why: a **Team-Up** partner of a seated hero comes first (a pair is what `teamUp` keywords name; see
 * `view/team-up-model.ts`), then **aspect coverage** (a deck bringing an aspect no seated deck has). A deck that
 * brings neither is not recommended, and nothing is recommended before someone is seated.
 *
 * A pair is recognized from the *identities*, by any of an identity's titles (the engine's own name match,
 * `identityCardTitledAs`), so it shows at seat time, when every hero is still in alter-ego form and the in-play
 * check (`activeTeamUps`) would say no. Plain data in, plain data out; the screens only draw it.
 */
import type { AnyCard, CoreAspect, Deck } from "@mc/content";
import { identityCardTitledAs } from "@mc/engine";
import { teamUpPairsOf, type TeamUpPair } from "./team-up-model.js";

export type SeatCardPool = ReadonlyMap<string, AnyCard>;

/** Who holds copies of a Team-Up card: a seated deck (its seat, 1-based) or the candidate deck itself (`seat` null). */
export interface TeamUpCopies {
  readonly seat: number | null;
  readonly heroName: string;
  /** Copies across the pair's Team-Up cards in that deck. */
  readonly copies: number;
}

export interface TeamUpLink {
  readonly pair: TeamUpPair;
  /** The seated hero this candidate pairs with, by the pair's own title ("Phoenix"), and the seat it sits in. */
  readonly partner: string;
  readonly partnerSeat: number;
  /** The candidate's own side of the pair ("Cyclops"). */
  readonly own: string;
  /** Each Team-Up card naming this pair, once by name. */
  readonly cardNames: readonly string[];
  readonly inDecks: readonly TeamUpCopies[];
}

export interface SeatRecommendation {
  readonly deckId: string;
  readonly teamUps: readonly TeamUpLink[];
  /** Aspects this deck has that no seated deck does. */
  readonly addsAspects: readonly CoreAspect[];
  /** Aspects the table already has, for the reason line. */
  readonly tableAspects: readonly CoreAspect[];
  /** 0 means "not recommended". */
  readonly score: number;
  /** One line, for a tile's caption. Empty when `score` is 0. */
  readonly reason: string;
  /** The full reason, one sentence per fact, for a detail panel. */
  readonly lines: readonly string[];
}

export interface SeatedPair {
  readonly pair: TeamUpPair;
  readonly seats: readonly [number, number];
  readonly heroNames: readonly [string, string];
  readonly cardNames: readonly string[];
  readonly inDecks: readonly TeamUpCopies[];
  /** "Team-Up: Colossus and Shadowcat". */
  readonly label: string;
}

const aspectWord = (aspect: CoreAspect): string => aspect.charAt(0).toUpperCase() + aspect.slice(1);

const listOf = (words: readonly string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

function identityOf(deck: Deck, pool: SeatCardPool) {
  const card = pool.get(deck.identityCardId as string);
  return card?.type === "hero_identity" ? card : null;
}

/** The hero name a deck's identity answers to: its card name, used for "in Gambit's deck". */
function heroNameOf(deck: Deck, pool: SeatCardPool): string {
  return identityOf(deck, pool)?.name ?? deck.name;
}

/** Which of a pair's two titles this deck's identity answers to, or null. */
function sideOf(deck: Deck, pair: TeamUpPair, pool: SeatCardPool): 0 | 1 | null {
  const identity = identityOf(deck, pool);
  if (!identity) return null;
  if (identityCardTitledAs(identity, pair.names[0])) return 0;
  if (identityCardTitledAs(identity, pair.names[1])) return 1;
  return null;
}

/** Every pair named by a `teamUp` keyword anywhere in the pool, and the Team-Up card names for each. */
export interface PairCatalog {
  readonly pairs: readonly TeamUpPair[];
  readonly cardsByPair: ReadonlyMap<string, ReadonlySet<string>>;
}

export function pairCatalogOf(pool: SeatCardPool): PairCatalog {
  const cards = [...pool.values()];
  const pairs = teamUpPairsOf(cards);
  const cardsByPair = new Map<string, Set<string>>();
  for (const pair of pairs) cardsByPair.set(pair.key, new Set());
  for (const card of cards) {
    if (!("keywords" in card)) continue;
    for (const pair of teamUpPairsOf([card])) cardsByPair.get(pair.key)?.add(card.id as string);
  }
  return { pairs, cardsByPair };
}

/** Copies of the pair's Team-Up cards in `deck`, by card id (a card id here, not a name: two printings count). */
function copiesIn(deck: Deck, ids: ReadonlySet<string>): number {
  return deck.cards.reduce((sum, entry) => sum + (ids.has(entry.cardId as string) ? entry.quantity : 0), 0);
}

function cardNamesOf(ids: ReadonlySet<string>, pool: SeatCardPool): readonly string[] {
  return [...new Set([...ids].map((id) => pool.get(id)?.name).filter((n): n is string => Boolean(n)))];
}

function copiesFor(deck: Deck, seat: number | null, ids: ReadonlySet<string>, pool: SeatCardPool): TeamUpCopies | null {
  const copies = copiesIn(deck, ids);
  return copies > 0 ? { seat, heroName: heroNameOf(deck, pool), copies } : null;
}

/** Every pair two seated heroes form, one entry each, in seat order. */
export function seatedTeamUps(
  seats: readonly (Deck | null)[],
  pool: SeatCardPool,
  catalog: PairCatalog,
): readonly SeatedPair[] {
  const result: SeatedPair[] = [];
  for (const pair of catalog.pairs) {
    const ids = catalog.cardsByPair.get(pair.key) ?? new Set<string>();
    const first = new Map<0 | 1, number>();
    seats.forEach((deck, index) => {
      if (!deck) return;
      const side = sideOf(deck, pair, pool);
      if (side !== null && !first.has(side)) first.set(side, index);
    });
    const a = first.get(0);
    const b = first.get(1);
    if (a === undefined || b === undefined || a === b) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const inDecks = [lo, hi].flatMap((i) => {
      const copies = copiesFor(seats[i]!, i + 1, ids, pool);
      return copies ? [copies] : [];
    });
    result.push({
      pair,
      seats: [lo + 1, hi + 1],
      heroNames: [pair.names[a < b ? 0 : 1], pair.names[a < b ? 1 : 0]],
      cardNames: cardNamesOf(ids, pool),
      inDecks,
      label: `Team-Up: ${pair.label}`,
    });
  }
  return result;
}

function teamUpPhrase(link: TeamUpLink): string {
  const cards = listOf(link.cardNames);
  const holders = new Set(link.inDecks.map((c) => c.seat));
  if (link.inDecks.length >= 2) return `${cards} is in both decks`;
  if (holders.size === 0) return "neither deck includes the Team-Up card";
  const only = link.inDecks[0]!;
  return `${cards} is only in ${only.heroName}'s deck`;
}

/**
 * Analyzes every candidate against the seated decks. `seats` is the table the candidate would join: pass it without
 * the seat being replaced. A candidate whose identity is already seated is left out entirely.
 */
export function analyzeSeatCandidates(
  seats: readonly (Deck | null)[],
  candidates: readonly Deck[],
  pool: SeatCardPool,
  catalog: PairCatalog,
): ReadonlyMap<string, SeatRecommendation> {
  const seated = seats.map((deck, index) => ({ deck, seat: index + 1 })).filter((s) => s.deck !== null) as {
    deck: Deck;
    seat: number;
  }[];
  const result = new Map<string, SeatRecommendation>();
  if (seated.length === 0) return result;
  const seatedIdentities = new Set(seated.map((s) => s.deck.identityCardId as string));
  const tableAspects = [...new Set(seated.flatMap((s) => s.deck.aspects))];

  for (const candidate of candidates) {
    if (seatedIdentities.has(candidate.identityCardId as string)) continue;
    const teamUps: TeamUpLink[] = [];
    for (const pair of catalog.pairs) {
      const ownSide = sideOf(candidate, pair, pool);
      if (ownSide === null) continue;
      const partnerIndex = (1 - ownSide) as 0 | 1;
      const ids = catalog.cardsByPair.get(pair.key) ?? new Set<string>();
      for (const partner of seated) {
        if (sideOf(partner.deck, pair, pool) !== partnerIndex) continue;
        const inDecks = [
          copiesFor(partner.deck, partner.seat, ids, pool),
          copiesFor(candidate, null, ids, pool),
        ].filter((c): c is TeamUpCopies => c !== null);
        teamUps.push({
          pair,
          partner: pair.names[partnerIndex],
          partnerSeat: partner.seat,
          own: pair.names[ownSide],
          cardNames: cardNamesOf(ids, pool),
          inDecks,
        });
        break;
      }
    }
    const addsAspects = candidate.aspects.filter((aspect) => !tableAspects.includes(aspect));
    const bothDecks = teamUps.filter((link) => link.inDecks.length >= 2).length;
    const oneDeck = teamUps.filter((link) => link.inDecks.length === 1).length;
    const score =
      teamUps.length === 0 && addsAspects.length === 0
        ? 0
        : (teamUps.length > 0 ? 100 + teamUps.length * 10 + bothDecks * 5 + oneDeck * 2 : 0) + addsAspects.length * 10;

    const lines: string[] = [
      ...teamUps.map((link) => `Team-Up with ${link.partner} (seat ${link.partnerSeat}) · ${teamUpPhrase(link)}.`),
      ...(addsAspects.length > 0
        ? [`Adds ${listOf(addsAspects.map(aspectWord))} · the table has ${listOf(tableAspects.map(aspectWord))}.`]
        : []),
    ];
    let reason = "";
    if (teamUps.length > 0) {
      const names = listOf(teamUps.map((link) => link.partner));
      reason =
        addsAspects.length > 0
          ? `Team-Up with ${names}, and adds ${listOf(addsAspects.map(aspectWord))}`
          : teamUps.length === 1
            ? `Team-Up with ${names} · ${teamUpPhrase(teamUps[0]!)}`
            : `Team-Up with ${names} · ${bothDecks} of ${teamUps.length} Team-Up cards in both decks`;
    } else if (addsAspects.length > 0) {
      reason = `Adds ${listOf(addsAspects.map(aspectWord))} · the table has ${listOf(tableAspects.map(aspectWord))}`;
    }
    result.set(candidate.id as string, {
      deckId: candidate.id as string,
      teamUps,
      addsAspects,
      tableAspects,
      score,
      reason,
      lines,
    });
  }
  return result;
}

/** The best `limit` candidates with a positive score, Team-Up partners first, ties in the order candidates came. */
export function topRecommendations(
  analysis: ReadonlyMap<string, SeatRecommendation>,
  order: readonly string[],
  limit: number,
): readonly SeatRecommendation[] {
  const ranked = order
    .map((id, index) => ({ rec: analysis.get(id), index }))
    .filter(
      (entry): entry is { rec: SeatRecommendation; index: number } => entry.rec !== undefined && entry.rec.score > 0,
    )
    .sort((a, b) => b.rec.score - a.rec.score || a.index - b.index);
  return ranked.slice(0, limit).map((entry) => entry.rec);
}

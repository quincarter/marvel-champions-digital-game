/**
 * Take your seats' Random hero (issue #911), modelled on scenario select's Random (`view/scenario-random.ts`, #762).
 * The scene hands in only the decks the roster would let the player take right now, so everything the roster already
 * decides (the filters and search, the installed packs, the scripted-only pool, a hero not ready, a hero already at the
 * table, an illegal or locked deck) is applied before this runs; this module only chooses. It picks a hero first, so a
 * hero with many saved decks is no likelier than one with a single precon, then one of that hero's decks, a
 * preconstructed one when it has one. `random` returns a number in [0, 1), like `Math.random`.
 */
import type { DeckOption } from "./deck-list-model.js";
import { isCommunityDeckId } from "./community-deck-id.js";
import { heroSourceMatches, type RosterFilter } from "./roster-filter.js";

export type RandomSource = () => number;

/**
 * Does the deck pass the hero chips (aspect, source, and "playable now" against `blockedBy`)? One rule for the shelves,
 * Recommended and Random.
 */
export function heroPassesChips(deck: DeckOption["deck"], filter: RosterFilter, blockedBy: string | null): boolean {
  if (filter.aspect && !deck.aspects.includes(filter.aspect)) return false;
  if (!heroSourceMatches(deck, filter.source)) return false;
  if (filter.playableOnly && blockedBy !== null) return false;
  return true;
}

/**
 * The decks the player could take at the active seat right now, each with whether the roster's chips and search show
 * it: legal and not from a not-ready pack (`seatable`), not blocked (`blockedBy`: seated at another seat, locked, the
 * seat maximum), and for Recommended (`recommended`, the default) a tested community deck only while the list is
 * narrowed to TESTED (a hero's many community decks would otherwise crowd out its precon). Random passes false: it
 * picks a hero first, so community decks cannot crowd it, and it must see the tested decks the Built chip shows
 * (code review, #916). Recommended and Random both read this one list.
 */
export function takeableHeroesOf(
  deckOptions: readonly DeckOption[],
  blockedBy: (deckId: string) => string | null,
  filter: RosterFilter,
  ranking: ReadonlyMap<string, number> | null,
  recommended = true,
): readonly { readonly option: DeckOption; readonly shown: boolean }[] {
  return deckOptions
    .filter((option) => option.seatable && blockedBy(option.deck.id as string) === null)
    .filter((option) => !recommended || filter.source === "tested" || !isCommunityDeckId(option.deck.id as string))
    .map((option) => ({
      option,
      shown: heroPassesChips(option.deck, filter, null) && (ranking === null || ranking.has(option.deck.id as string)),
    }));
}

/**
 * True while the search text has no ranking of its own yet: the worker has not answered for it, so `ranking` is null
 * or still the previous text's (`rankedFor`, the text the ranking answers). Random then offers nothing rather than a
 * hero the text may not match (code review, #916).
 */
export function searchPending(filter: RosterFilter, rankedFor: string | null): boolean {
  return filter.text.trim() !== "" && rankedFor !== filter.text;
}

/**
 * What Random may seat: the takeable decks the roster shows, minus the active seat's own hero so a press always changes
 * it. None while a search is pending (`searchPending`).
 */
export function randomHeroCandidatesOf(
  deckOptions: readonly DeckOption[],
  blockedBy: (deckId: string) => string | null,
  filter: RosterFilter,
  ranking: ReadonlyMap<string, number> | null,
  ownIdentityCardId: string | undefined,
  rankedFor: string | null = null,
): readonly RandomHeroCandidate[] {
  if (searchPending(filter, rankedFor)) return [];
  return takeableHeroesOf(deckOptions, blockedBy, filter, ranking, false)
    .filter(({ shown, option }) => shown && (option.deck.identityCardId as string) !== ownIdentityCardId)
    .map(({ option }) => ({
      deckId: option.deck.id as string,
      identityCardId: option.deck.identityCardId as string,
      precon: option.deck.source.kind === "precon",
    }));
}

export interface RandomHeroCandidate {
  readonly deckId: string;
  /** The hero's identity card: decks sharing it are one hero. */
  readonly identityCardId: string;
  /** A preconstructed deck: the one Random seats when its hero has one. */
  readonly precon: boolean;
}

const pickOne = <T>(items: readonly T[], random: RandomSource): T | null =>
  items.length === 0 ? null : (items[Math.min(items.length - 1, Math.floor(random() * items.length))] ?? null);

/**
 * The deck id Random seats: a random hero of the candidates, then that hero's precon (else any of its decks).
 * Null when there are none.
 */
export function randomHeroDeck(candidates: readonly RandomHeroCandidate[], random: RandomSource): string | null {
  const byHero = new Map<string, RandomHeroCandidate[]>();
  for (const candidate of candidates) {
    const decks = byHero.get(candidate.identityCardId);
    if (decks) decks.push(candidate);
    else byHero.set(candidate.identityCardId, [candidate]);
  }
  const decks = pickOne([...byHero.values()], random);
  if (!decks) return null;
  const precons = decks.filter((deck) => deck.precon);
  return pickOne(precons.length > 0 ? precons : decks, random)?.deckId ?? null;
}

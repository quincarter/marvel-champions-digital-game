/**
 * The room's deck picker (Quin, 2026-11-20): the decks on THIS device (saved, imported and precon decks, plus the
 * tested community decks: the same `DeckOption`s Table setup and Take your seats list) as rows a player taps to put in
 * their seat, searched with the shared fuzzy match (`view/deck-search.ts`). Plain data: nothing here judges a deck; the
 * engine's own verdict rides on each `DeckOption` and the host's engine judges it again at Start.
 */
import { aspectName } from "./aspect-stamp.js";
import type { DeckOption } from "./deck-list-model.js";
import { queryScoreOf } from "./deck-search.js";

export interface PickerRow {
  readonly id: string;
  readonly option: DeckOption;
  readonly name: string;
  /** The hero's identity card id, for the picture and the hover. */
  readonly cardId: string;
  readonly heroName: string;
  readonly aspects: string;
  readonly cards: number;
  /** May be put in the seat (legal on this device). */
  readonly seatable: boolean;
  /** Why not, in the engine's words; null when seatable. */
  readonly blockedReason: string | null;
  /** Its status is still being worked out (a worker has not answered): not blocked, not yet pickable. */
  readonly checking: boolean;
  /** The deck is the one in the seat now. */
  readonly current: boolean;
}

/** What a seat holds now, to mark its deck in the list (the room's summary has no deck id). */
export interface CurrentDeck {
  readonly hero: string;
  readonly name: string;
}

export const cardsOf = (option: DeckOption): number => option.deck.cards.reduce((sum, line) => sum + line.quantity, 0);

function rowOf(option: DeckOption, current: CurrentDeck | null): PickerRow {
  const heroName = option.identityName ?? (option.deck.identityCardId as string);
  return {
    id: option.deck.id as string,
    option,
    name: option.deck.name,
    cardId: option.deck.identityCardId as string,
    heroName,
    aspects: option.deck.aspects.map((a) => aspectName(a as string)).join(" + "),
    cards: cardsOf(option),
    seatable: option.seatable,
    checking: option.checking === true,
    blockedReason: option.seatable ? null : (option.blockedReason ?? null),
    current:
      current !== null && current.hero === (option.deck.identityCardId as string) && current.name === option.deck.name,
  };
}

/**
 * The rows to show for `query`: every deck for an empty query (decks that can be seated first, then the others, each
 * group in the order given), else only the decks the query matches, best match first. The hero's name, the deck's name
 * and its aspects and source are all searched; accents, case and a typo or two never matter.
 */
export function pickerRows(
  options: readonly DeckOption[],
  query: string,
  current: CurrentDeck | null = null,
): readonly PickerRow[] {
  const text = query.trim();
  if (text === "") {
    const rows = options.map((option) => rowOf(option, current));
    // A deck still being checked keeps its place: it sinks only if it turns out to be unusable.
    const ok = (row: PickerRow): boolean => row.seatable || row.checking;
    return [...rows.filter(ok), ...rows.filter((row) => !ok(row))];
  }
  const scored: { row: PickerRow; score: number; index: number }[] = [];
  options.forEach((option, index) => {
    const row = rowOf(option, current);
    const score = queryScoreOf(text, {
      primary: [row.name, row.heroName],
      secondary: [row.aspects, option.deck.source.kind],
    });
    if (score !== null) scored.push({ row, score, index });
  });
  // A deck that cannot be seated sinks below one that can, whatever the match.
  const ok = (row: PickerRow): number => Number(row.seatable || row.checking);
  scored.sort((a, b) => ok(b.row) - ok(a.row) || b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.row);
}

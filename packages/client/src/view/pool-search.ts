/**
 * The Decks screen's card-pool text search: every whitespace-separated word must appear (case-insensitive) somewhere
 * in the card's searchable text (name, traits, type, rules text). Pure: the caller supplies the text per card.
 */

/** The lower-cased words of a search box, empty for a blank box. */
export function searchWords(text: string): readonly string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

/** One card's searchable text, joined and lower-cased so a search is a plain substring test per word. */
export function searchHaystack(parts: {
  readonly name: string;
  readonly traits: readonly string[];
  readonly type: string;
  readonly rulesText: string;
}): string {
  return [parts.name, ...parts.traits, parts.type, parts.rulesText].join("\n").toLowerCase();
}

/** The items whose haystack contains every word of `text`; all of them for a blank search. */
export function filterBySearch<T>(items: readonly T[], text: string, haystackOf: (item: T) => string): readonly T[] {
  const words = searchWords(text);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const haystack = haystackOf(item);
    return words.every((word) => haystack.includes(word));
  });
}

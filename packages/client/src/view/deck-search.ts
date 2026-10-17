/**
 * Relevance-ranked text search over documents (Take your seats' deck search, GitHub #219; written generic so the deck
 * builder's and Decks' card searches can use it too). Pure: `workers/deck-search.worker.ts` runs it off the main
 * thread through `view/deck-search-client.ts`, and the tests call it directly.
 *
 * A document is a set of text fields in three strengths: `primary` (a deck's own name, its hero and alter-ego names),
 * `secondary` (aspects, source, pack and set, author, tags) and `notes` (a long free-text write-up). Every word of the
 * query must match somewhere (AND). A word's score is the best any field gives it, by tier:
 *
 *   exact field 100 > field prefix 90 > a word of the field matches 80 > a word starts with it 75 > substring 65
 *   > one typo away from a word (edit distance 1, or 2 for long words) 45 > letters in order inside a name 30
 *
 * scaled down for a weaker field (secondary x0.6, notes x0.2; notes are matched exactly or by substring, never
 * fuzzily, so a long write-up cannot match everything). A multi-word query also scores as one phrase against each
 * primary field, so "captain marvel" finds the deck named that before one that merely has both words. Accents and case
 * are ignored. Ties keep the order the documents arrived in.
 */

export interface SearchDocument {
  readonly id: string;
  readonly primary: readonly string[];
  readonly secondary?: readonly string[];
  readonly notes?: readonly string[];
}

interface PreparedField {
  readonly text: string;
  readonly words: readonly string[];
}

/** A document with every field lowercased, accent-stripped and split into words once, so a keystroke does none of that. */
export interface PreparedDocument {
  readonly id: string;
  readonly primary: readonly PreparedField[];
  readonly secondary: readonly PreparedField[];
  readonly notes: readonly PreparedField[];
}

export interface RankedDocument {
  readonly id: string;
  readonly score: number;
}

const SECONDARY_SCALE = 0.6;
const NOTES_SCALE = 0.2;

export function normalizeText(text: string): string {
  // Periods go entirely, so "S.H.I.E.L.D." reads "shield" (and a query of either spelling finds it).
  return text
    .replace(/\./g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const wordsOf = (text: string): string[] => text.split(/[^a-z0-9]+/).filter((w) => w !== "");

function prepareField(text: string | null | undefined): PreparedField | null {
  if (text == null) return null;
  const normalized = normalizeText(text).trim();
  return normalized === "" ? null : { text: normalized, words: wordsOf(normalized) };
}

const prepareFields = (texts: readonly (string | null | undefined)[] | undefined): PreparedField[] =>
  (texts ?? []).flatMap((t) => {
    const field = prepareField(t);
    return field ? [field] : [];
  });

export function prepareDocuments(documents: readonly SearchDocument[]): readonly PreparedDocument[] {
  return documents.map((doc) => ({
    id: doc.id,
    primary: prepareFields(doc.primary),
    secondary: prepareFields(doc.secondary),
    notes: prepareFields(doc.notes),
  }));
}

/** Edit distance (insert, delete, substitute, swap of neighbours), giving up above `limit`. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let twoBack: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, twoBack[j - 2]! + 1);
      row.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    twoBack = prev;
    prev = row;
  }
  return prev[b.length]!;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let at = 0;
  for (const ch of haystack) if (ch === needle[at] && ++at === needle.length) return true;
  return needle.length === 0;
}

/** How well one query word matches one field, 0 for no match. `fuzzy` is off for notes. */
function wordScore(token: string, field: PreparedField, fuzzy: boolean, loose = false): number {
  if (field.text === token) return 100;
  if (field.text.startsWith(token)) return 90;
  let best = 0;
  for (const word of field.words) {
    if (word === token) return 80;
    if (word.startsWith(token)) best = Math.max(best, 75);
  }
  if (best > 0) return best;
  if (field.text.includes(token)) return 65;
  if (!fuzzy || token.length < 3) return 0;
  // Short words take no typo ("capt" one letter from "cast" matched Black Panther), and a typo keeps the first letter.
  const limit = token.length >= 8 ? 2 : token.length >= 5 ? 1 : 0;
  for (const word of field.words) {
    if (limit > 0 && word[0] === token[0]) {
      // A typo anywhere, including in the part not yet typed: compare against the word's own start too.
      if (editDistance(token, word, limit) <= limit) return 45;
      if (word.length > token.length && editDistance(token, word.slice(0, token.length), limit) <= limit) return 45;
    }
  }
  // Letters in order across a whole name ("spdrmn" for Spider-Man): only names, where it is a deliberate shorthand.
  if (loose && token.length >= 5 && field.text[0] === token[0] && isSubsequence(token, field.text))
    best = Math.max(best, 30);
  return best;
}

/** The query's score against `doc`, or null when some word of it matches nothing. `tokens` are normalized query words. */
export function scoreDocument(doc: PreparedDocument, tokens: readonly string[], phrase: string): number | null {
  if (tokens.length === 0) return 0;
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of doc.primary) best = Math.max(best, wordScore(token, field, true, true));
    for (const field of doc.secondary) best = Math.max(best, wordScore(token, field, true) * SECONDARY_SCALE);
    for (const field of doc.notes) best = Math.max(best, wordScore(token, field, false) * NOTES_SCALE);
    if (best === 0) return null;
    total += best;
  }
  let score = total / tokens.length;
  if (tokens.length > 1) {
    for (const field of doc.primary) {
      if (field.text === phrase) score = Math.max(score, 100);
      else if (field.text.startsWith(phrase)) score = Math.max(score, 92);
      else if (field.text.includes(phrase)) score = Math.max(score, 70);
    }
  }
  return score;
}

/** Every document the query matches, best first; an empty query matches everything in the order given. */
export function rankDocuments(documents: readonly PreparedDocument[], query: string): readonly RankedDocument[] {
  const phrase = normalizeText(query).trim().replace(/\s+/g, " ");
  const tokens = wordsOf(phrase);
  const out: { id: string; score: number; index: number }[] = [];
  documents.forEach((doc, index) => {
    const score = scoreDocument(doc, tokens, phrase);
    if (score !== null) out.push({ id: doc.id, score, index });
  });
  out.sort((a, b) => b.score - a.score || a.index - b.index);
  return out.map(({ id, score }) => ({ id, score }));
}

/** The stateful half the worker and the synchronous fallback share: documents prepared once, then queries. */
export class DeckSearchHost {
  #docs: readonly PreparedDocument[] = [];

  setDocuments(documents: readonly SearchDocument[]): void {
    this.#docs = prepareDocuments(documents);
  }

  search(query: string): readonly RankedDocument[] {
    return rankDocuments(this.#docs, query);
  }
}

/** Messages between the main thread and `workers/deck-search.worker.ts`. */
export type DeckSearchRequest =
  | { readonly type: "docs"; readonly documents: readonly SearchDocument[] }
  | { readonly type: "query"; readonly requestId: number; readonly query: string };

export interface DeckSearchResponse {
  readonly requestId: number;
  readonly ranked: readonly RankedDocument[];
}

/** `shelves` with each shelf's items best match first, and the shelves ordered by their best item (ties keep the order given). */
export function rankShelvesByScore<T, S extends { readonly items: readonly T[] }>(
  shelves: readonly (S & { readonly items: readonly T[] })[],
  scoreOf: (item: T) => number,
): readonly S[] {
  const ranked = shelves.map((shelf, index) => {
    const items = shelf.items
      .map((item, at) => ({ item, at, score: scoreOf(item) }))
      .sort((a, b) => b.score - a.score || a.at - b.at);
    return { shelf: { ...shelf, items: items.map((i) => i.item) }, best: items[0]?.score ?? 0, index };
  });
  ranked.sort((a, b) => b.best - a.best || a.index - b.index);
  return ranked.map((r) => r.shelf);
}

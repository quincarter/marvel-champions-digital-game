/**
 * The pack-shelf roster (docs/phase4-screen-gaps.md §3 W2b, the owner's decision
 * 2026-09-18 superseding this workstream's own earlier flat-grid brief):
 * Scenario select and Take your seats both group their roster into one
 * horizontally-scrolling shelf per pack, in release order, with search
 * matching the items *nested inside* every shelf rather than the shelf
 * itself.
 *
 * Deliberately generic over the item type `T` (a `Scenario` or a `DeckOption`)
 * so this one pure function, and its one set of tests, covers both rosters —
 * the same reasoning `view/roster-filter.ts`'s own doc comment gives for
 * having one `heroRosterMatches`/`scenarioRosterMatches` pair instead of two
 * near-duplicate copies. The caller does the per-kind work this module can't
 * (which fields to search, which pack an item belongs to, whether the quick-
 * filter chips already exclude it) and hands in one `ShelfCandidate` per item;
 * this module only decides the shelf *structure*: which shelf an item lands
 * in, whether a query keeps it there, and which shelves survive at all.
 */
import { matchesSearch, normalizeSearch } from "./roster-filter.js";

/** The synthetic shelf id for decks with no pack (saved and imported decks) — always first, and only shown when non-empty. */
export const YOUR_DECKS_SHELF_ID = "your-decks";

export interface ShelfCandidate<T> {
  readonly item: T;
  /** The pack this item belongs to (`Scenario.packCode`, or the pack a deck's identity ships in). `null` buckets it into "Your decks" — the shelf for a deck with no pack of its own. */
  readonly packCode: string | null;
  /** Every field a search should be able to find this item by (S8's own list per roster kind) — gathered by the caller, since the fields differ between a scenario and a deck. */
  readonly searchHaystacks: readonly (string | null | undefined)[];
  /** Whether this item already passes the quick-filter chips (aspect/source/playable-now, or product) — ANDed with the text match, same as `heroRosterMatches`/`scenarioRosterMatches` already AND their own chip checks onto the text match. A chip-excluded item never appears on any shelf, whatever the search says. */
  readonly passesChips: boolean;
}

export interface Shelf<T> {
  /** `YOUR_DECKS_SHELF_ID`, or the pack code. */
  readonly id: string;
  readonly title: string;
  readonly items: readonly T[];
}

/**
 * Groups `candidates` into shelves and applies `query` to what's nested
 * inside each one:
 * - A chip-excluded candidate (`passesChips === false`) never appears, on any shelf.
 * - An empty query keeps every remaining candidate.
 * - A non-empty query keeps a candidate whose own `searchHaystacks` match it
 *   (`matchesSearch`, accent/case-insensitive) — **or every candidate on a
 *   shelf whose own pack name matches**, so typing "wrecking" surfaces every
 *   deck in The Wrecking Crew even if no single deck's own name mentions it.
 * - A shelf with nothing left (chip-excluded, or filtered out by the query)
 *   is dropped rather than shown empty.
 * - Shelves are ordered "Your decks" first (only when it survives filtering
 *   with at least one item), then `packOrder`'s own order (release order,
 *   `POOL_PACKS`) — never the order `candidates` happened to arrive in, so
 *   shuffling the input produces byte-identical shelves.
 */
export function shelvesOf<T>(
  candidates: readonly ShelfCandidate<T>[],
  packOrder: readonly string[],
  packName: (packCode: string) => string,
  query: string,
): readonly Shelf<T>[] {
  const q = normalizeSearch(query.trim());
  const byShelf = new Map<string, ShelfCandidate<T>[]>();
  for (const candidate of candidates) {
    if (!candidate.passesChips) continue;
    const shelfId = candidate.packCode ?? YOUR_DECKS_SHELF_ID;
    const bucket = byShelf.get(shelfId);
    if (bucket) bucket.push(candidate);
    else byShelf.set(shelfId, [candidate]);
  }

  const order = [YOUR_DECKS_SHELF_ID, ...packOrder];
  const shelves: Shelf<T>[] = [];
  for (const shelfId of order) {
    const bucket = byShelf.get(shelfId);
    if (!bucket || bucket.length === 0) continue;
    const title = shelfId === YOUR_DECKS_SHELF_ID ? "Your decks" : packName(shelfId);
    const packNameMatches = q !== "" && shelfId !== YOUR_DECKS_SHELF_ID && normalizeSearch(title).includes(q);
    const items = (packNameMatches ? bucket : bucket.filter((c) => matchesSearch(c.searchHaystacks, query))).map((c) => c.item);
    if (items.length > 0) shelves.push({ id: shelfId, title, items });
  }
  return shelves;
}

/** Every item across every shelf, in shelf order then item order — what a caller needs for focus stops and for a flat count ("N decks" across every shelf combined). */
export function flattenShelves<T>(shelves: readonly Shelf<T>[]): readonly T[] {
  return shelves.flatMap((shelf) => shelf.items);
}

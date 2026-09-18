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

/**
 * Where packs that hold a single item are gathered (the owner's call,
 * 2026-09-18): a hero pack ships one hero, and a shelf per hero pack was a
 * column of one-card rows — nine headers to show nine cards. Opt-in per roster
 * through `shelvesOf`'s `soloShelf`.
 */
export interface SoloShelf {
  readonly id: string;
  readonly title: string;
}

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
 * - With `soloShelf`, every pack holding exactly one candidate is gathered onto
 *   that one shelf (in pack order) instead of getting a shelf of its own; a
 *   search for such a pack's name still finds its item there.
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
  soloShelf?: SoloShelf,
): readonly Shelf<T>[] {
  const q = normalizeSearch(query.trim());

  // A pack is "solo" by what it *holds*, not by what the chips and the query
  // have left of it — otherwise filtering a box down to one hit would move
  // that hit to another shelf under the player's cursor.
  const packSize = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.packCode !== null) packSize.set(candidate.packCode, (packSize.get(candidate.packCode) ?? 0) + 1);
  }
  const isSolo = (packCode: string): boolean => soloShelf !== undefined && (packSize.get(packCode) ?? 0) === 1;

  const byPack = new Map<string, ShelfCandidate<T>[]>();
  for (const candidate of candidates) {
    if (!candidate.passesChips) continue;
    const key = candidate.packCode ?? YOUR_DECKS_SHELF_ID;
    const bucket = byPack.get(key);
    if (bucket) bucket.push(candidate);
    else byPack.set(key, [candidate]);
  }

  /** What survives the query from one pack: all of it when the pack's own name matches, else its matching items. */
  const survivors = (packCode: string, title: string | null): readonly T[] => {
    const bucket = byPack.get(packCode) ?? [];
    const packNameMatches = q !== "" && title !== null && normalizeSearch(title).includes(q);
    return (packNameMatches ? bucket : bucket.filter((c) => matchesSearch(c.searchHaystacks, query))).map((c) => c.item);
  };

  const shelves: Shelf<T>[] = [];
  const yours = survivors(YOUR_DECKS_SHELF_ID, null);
  if (yours.length > 0) shelves.push({ id: YOUR_DECKS_SHELF_ID, title: "Your decks", items: yours });

  let solo: { readonly at: number; readonly items: T[] } | null = null;
  for (const packCode of packOrder) {
    const items = survivors(packCode, packName(packCode));
    if (items.length === 0) continue;
    if (!isSolo(packCode)) {
      shelves.push({ id: packCode, title: packName(packCode), items });
      continue;
    }
    // The gathered shelf sits where the first solo pack would have, in release order.
    solo ??= { at: shelves.length, items: [] };
    solo.items.push(...items);
  }
  if (solo && soloShelf) shelves.splice(solo.at, 0, { id: soloShelf.id, title: soloShelf.title, items: solo.items });
  return shelves;
}

/** Every item across every shelf, in shelf order then item order — what a caller needs for focus stops and for a flat count ("N decks" across every shelf combined). */
export function flattenShelves<T>(shelves: readonly Shelf<T>[]): readonly T[] {
  return shelves.flatMap((shelf) => shelf.items);
}

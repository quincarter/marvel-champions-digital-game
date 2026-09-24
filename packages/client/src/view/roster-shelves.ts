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
    return (packNameMatches ? bucket : bucket.filter((c) => matchesSearch(c.searchHaystacks, query))).map(
      (c) => c.item,
    );
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

/**
 * The one fact about a pack `cycleShelvesOf` needs — everything else about the pack (its own display name, which
 * items it holds) stays the caller's business. Built from `@mc/content`'s own `Pack`/`Cycle` records; this module
 * stays free of any dependency on `@mc/content` so it can go on being tested with plain fixtures.
 */
export interface ShelfPack {
  readonly code: string;
  readonly cycleId: string;
  readonly cycleName: string;
  /** `Cycle.order` — shelves sort by this, ascending. */
  readonly cycleOrder: number;
  /** `Pack.releaseDate` (ISO), where known — orders packs inside one cycle's shelf. Missing sorts last within the cycle. */
  readonly releaseDate?: string;
}

/**
 * `shelvesOf`, grouped by release wave/cycle instead of by physical product (the maintainer's call: FFG releases
 * heroes in waves — a campaign box plus the hero packs that ship alongside it — and a shelf per one-hero pack
 * scattered that grouping across a "Hero packs" catch-all). Purely a function of each pack's own `cycleId` and
 * `Cycle.order`/`releaseDate` — no pack or hero name is special-cased, so a later wave falls in the right shelf
 * the moment its packs carry the right cycle.
 *
 * - One shelf per distinct `cycleId` among `packs`, titled with that cycle's own name, ordered by `cycleOrder`.
 * - Inside a shelf, packs sort by `releaseDate` (a campaign box general-releases before the hero packs FFG ships
 *   alongside it, so it naturally sorts first — nothing here treats a box specially); inside one pack, an item
 *   keeps the order the caller's own `candidates` array already gave it (a stable sort only reorders *between*
 *   packs, never within one).
 * - A candidate whose `packCode` isn't `null` but isn't in `packs` is dropped, same as `shelvesOf` drops a pack
 *   `packOrder` never named — never guessed into a position.
 * - `null` `packCode`s (no pack of their own) are untouched by any of this and still land on "Your decks", first.
 * - A query still matches a shelf's own title (now the cycle's name, e.g. "galaxy" for The Galaxy's Most Wanted)
 *   to keep the whole shelf, via `shelvesOf`'s own pack-name matching.
 */
export function cycleShelvesOf<T>(
  candidates: readonly ShelfCandidate<T>[],
  packs: readonly ShelfPack[],
  query: string,
): readonly Shelf<T>[] {
  const packByCode = new Map(packs.map((p) => [p.code, p]));

  // A stable sort: two candidates whose packs tie (same pack, or both packless/unknown) keep the relative order
  // the caller already gave them, so a pack's own hero order survives untouched.
  const byRelease = [...candidates].sort((a, b) => {
    const pa = a.packCode !== null ? packByCode.get(a.packCode) : undefined;
    const pb = b.packCode !== null ? packByCode.get(b.packCode) : undefined;
    if (!pa || !pb) return 0;
    if (pa.cycleOrder !== pb.cycleOrder) return pa.cycleOrder - pb.cycleOrder;
    return (pa.releaseDate ?? "").localeCompare(pb.releaseDate ?? "");
  });

  // Every candidate's own pack is swapped for that pack's cycle, so `shelvesOf`'s pack-keyed grouping becomes
  // cycle-keyed grouping — one shelf per wave instead of one per product.
  const byCycle = byRelease.map((c): ShelfCandidate<T> => {
    const pack = c.packCode !== null ? packByCode.get(c.packCode) : undefined;
    return pack ? { ...c, packCode: pack.cycleId } : c;
  });

  const cycleOrder = [...packs]
    .sort((a, b) => a.cycleOrder - b.cycleOrder)
    .map((p) => p.cycleId)
    .filter((id, i, ids) => ids.indexOf(id) === i);
  const cycleName = (cycleId: string): string => packs.find((p) => p.cycleId === cycleId)?.cycleName ?? cycleId;

  return shelvesOf(byCycle, cycleOrder, cycleName, query);
}

/** `azShelvesOf`'s shelf id for a run of names with no alphabetic first character — never expected for a hero's own name (or its deck name), but kept total rather than assumed unreachable. */
const AZ_OTHER_LETTER = "#";

/** The (uppercase, accent-stripped) letter `azShelvesOf` groups `name` under. */
function firstLetterOf(name: string): string {
  const match = /[a-z]/.exec(normalizeSearch(name));
  return match ? match[0]!.toUpperCase() : AZ_OTHER_LETTER;
}

/**
 * `shelvesOf`'s flat A–Z alternative (Take your seats' "By wave"/"A–Z" sort toggle): every surviving candidate
 * across one letter-headed run of shelves ("A", "B", …) instead of one shelf per release wave, for a player who
 * wants to find a hero by name rather than browse by expansion. Chosen over a single long shelf (poor at 30+
 * heroes) or a plain wrapping grid (loses the shelf-header drill-in and the "N identities" count every other
 * roster shelf already gives for free): letter shelves reuse `Shelf<T>` unchanged, so `McShelfRoster`, drill-in,
 * and card sizing all work exactly as they do for `cycleShelvesOf` — the card is the same card, only the grouping
 * changed.
 *
 * - `packCode: null` candidates still land on "Your decks", first — same special case `shelvesOf` makes, so "Your
 *   decks" stays first in both sort modes.
 * - Every other surviving candidate is grouped by `firstLetterOf(nameOf(item))` into a shelf titled with that one
 *   letter, shelves ordered A–Z.
 * - Within a shelf (and within "Your decks"), items sort by `nameOf` then `tieBreakOf` to break a tie (e.g. two
 *   Core Captain Marvel decks sharing a hero name), both compared case- and accent-insensitively
 *   (`normalizeSearch`) — never the order `candidates` arrived in.
 * - `passesChips` and the query behave exactly as they do in `shelvesOf`, with one deliberate difference: a query
 *   never keeps a whole shelf because its own title matches — a single letter like "a" would trivially match
 *   almost any query, defeating the filter. Only a candidate's own `searchHaystacks` decide survival here.
 */
export function azShelvesOf<T>(
  candidates: readonly ShelfCandidate<T>[],
  query: string,
  nameOf: (item: T) => string,
  tieBreakOf: (item: T) => string = () => "",
): readonly Shelf<T>[] {
  const yours: T[] = [];
  const byLetter = new Map<string, T[]>();
  for (const candidate of candidates) {
    if (!candidate.passesChips) continue;
    if (!matchesSearch(candidate.searchHaystacks, query)) continue;
    if (candidate.packCode === null) {
      yours.push(candidate.item);
      continue;
    }
    const letter = firstLetterOf(nameOf(candidate.item));
    const bucket = byLetter.get(letter);
    if (bucket) bucket.push(candidate.item);
    else byLetter.set(letter, [candidate.item]);
  }

  const cmp = (a: T, b: T): number => {
    const byName = normalizeSearch(nameOf(a)).localeCompare(normalizeSearch(nameOf(b)));
    return byName !== 0 ? byName : normalizeSearch(tieBreakOf(a)).localeCompare(normalizeSearch(tieBreakOf(b)));
  };

  const shelves: Shelf<T>[] = [];
  if (yours.length > 0) shelves.push({ id: YOUR_DECKS_SHELF_ID, title: "Your decks", items: [...yours].sort(cmp) });
  for (const letter of [...byLetter.keys()].sort()) {
    shelves.push({ id: `az:${letter}`, title: letter, items: [...byLetter.get(letter)!].sort(cmp) });
  }
  return shelves;
}

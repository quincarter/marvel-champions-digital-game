/**
 * MC27 p. 22's node 9 reward ("Aspect Advantage"): "add the maximum number of copies of any aspect card from your
 * whole collection" — the engine's own real pending choice already carries the exact legal card ids (a `choose`
 * op with `from: { kind: "collection", filter: {} }`, `sm.ts`'s node9 block), which can run into the hundreds of
 * cards across every released aspect. A short column of rows (the Aftermath's other choices — MC10's TECH pool, a
 * handful of options) doesn't read at that size; this module is a pure, Vitest-tested search/filter/sort over
 * exactly those options, never inventing or widening what's legal — the engine's `options` list is always this
 * module's own upper bound.
 *
 * Deliberately over `AnyCard` rather than `AftermathOption`: an aspect chip rail needs the card's own aspect, which
 * `AftermathOption` never carried (no other Aftermath choice needed it).
 */
import type { AnyCard, CardId, CoreAspect } from "@mc/content";

export interface CollectionPickerRow {
  readonly cardId: CardId;
  readonly name: string;
  /** The card's own aspect, or "basic"/"identity" the same way `deck-builder-model.ts`'s `PoolFilter.aspect` reads
   * it — null for a card with no aspect at all (shouldn't occur for a player card, but never assumed). */
  readonly aspect: CoreAspect | "basic" | "identity" | null;
  readonly typeLabel: string;
}

/** The card's own aspect, `deck-builder-model.ts`'s own duck-typed read (every player-deck card has one). */
function aspectOf(card: AnyCard): CoreAspect | "basic" | "identity" | null {
  if (!("aspect" in card)) return null;
  const aspect = (card as { aspect: string }).aspect;
  return aspect.startsWith("hero:") ? "identity" : (aspect as CoreAspect | "basic");
}

/** Every option the engine actually offered, resolved to a card — an id the pool doesn't carry (shouldn't happen,
 * `resolveChoiceSource` only ever names real pool cards) is dropped rather than shown as a blank row. */
export function collectionPickerRows(
  optionIds: readonly string[],
  cardsById: ReadonlyMap<string, AnyCard>,
): readonly CollectionPickerRow[] {
  const rows: CollectionPickerRow[] = [];
  for (const id of optionIds) {
    const card = cardsById.get(id);
    if (!card) continue;
    rows.push({ cardId: id as CardId, name: card.name, aspect: aspectOf(card), typeLabel: card.type });
  }
  return rows;
}

/** Every distinct aspect the offered rows actually carry, in a fixed, stable chip order — never every aspect that
 * exists in the whole card pool, so a collection with (say) no Pool cards granted yet shows no "Pool" chip. */
const ASPECT_ORDER: readonly (CoreAspect | "basic" | "identity")[] = [
  "aggression",
  "justice",
  "leadership",
  "protection",
  "pool",
  "basic",
  "identity",
];

export function collectionPickerAspects(
  rows: readonly CollectionPickerRow[],
): readonly (CoreAspect | "basic" | "identity")[] {
  const present = new Set(
    rows.map((row) => row.aspect).filter((aspect): aspect is CoreAspect | "basic" | "identity" => aspect !== null),
  );
  return ASPECT_ORDER.filter((aspect) => present.has(aspect));
}

export interface CollectionPickerFilter {
  readonly text?: string;
  readonly aspect?: CoreAspect | "basic" | "identity" | null;
}

/** `rows`, narrowed by `filter` and sorted by name — the search box + aspect chip rail's own combined result. */
export function filterCollectionPicker(
  rows: readonly CollectionPickerRow[],
  filter: CollectionPickerFilter,
): readonly CollectionPickerRow[] {
  const text = filter.text?.trim().toLowerCase();
  return rows
    .filter((row) => !filter.aspect || row.aspect === filter.aspect)
    .filter((row) => !text || row.name.toLowerCase().includes(text))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

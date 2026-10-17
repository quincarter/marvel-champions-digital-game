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
import type { SearchDocument } from "./deck-search.js";

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

/**
 * What the picker's search looks in for each offered card (view/deck-search.ts), sent to the worker when the option
 * list changes: the card's name, then its aspect, type and traits, and its rules text last.
 */
export function collectionPickerSearchDocumentsOf(
  optionIds: readonly string[],
  cardsById: ReadonlyMap<string, AnyCard>,
): readonly SearchDocument[] {
  const documents: SearchDocument[] = [];
  for (const id of optionIds) {
    const card = cardsById.get(id);
    if (!card) continue;
    const text = "text" in card ? (card.text as unknown) : null;
    const current = typeof text === "string" ? text : ((text as { readonly current?: string } | null)?.current ?? "");
    documents.push({
      id,
      primary: [card.name],
      secondary: [
        aspectOf(card) ?? "",
        card.type.replace(/_/g, " "),
        ...("traits" in card ? (card.traits as readonly string[]) : []),
      ].filter((t) => t !== ""),
      notes: current === "" ? [] : [current.replace(/[[\]]/g, " ").replace(/_/g, " ")],
    });
  }
  return documents;
}

export interface CollectionPickerFilter {
  /** Card id to score from the search worker: when given, only these cards stay, best first, and `text` is ignored. */
  readonly ranking?: ReadonlyMap<string, number> | null;
  readonly text?: string;
  readonly aspect?: CoreAspect | "basic" | "identity" | null;
}

/** `rows`, narrowed by `filter` and sorted by name — the search box + aspect chip rail's own combined result. */
export function filterCollectionPicker(
  rows: readonly CollectionPickerRow[],
  filter: CollectionPickerFilter,
): readonly CollectionPickerRow[] {
  const text = filter.text?.trim().toLowerCase();
  const ranking = filter.ranking;
  const kept = rows
    .filter((row) => !filter.aspect || row.aspect === filter.aspect)
    .filter((row) => (ranking ? ranking.has(row.cardId) : !text || row.name.toLowerCase().includes(text)));
  if (ranking) return kept.sort((a, b) => (ranking.get(b.cardId) ?? 0) - (ranking.get(a.cardId) ?? 0));
  return kept.sort((a, b) => a.name.localeCompare(b.name));
}

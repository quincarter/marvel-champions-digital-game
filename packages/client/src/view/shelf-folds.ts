/**
 * Fold and unfold each shelf of a pack-shelf roster (issue #753): with several mods installed the list of shelves gets
 * long, so a shelf's header is a toggle that folds it to its header band. What is folded is remembered per list
 * (Take your seats' hero list, Scenario select's list), in `localStorage` as a JSON array of shelf ids under an
 * `mc-*` key, with the storage passed in so the rules are tested without a browser. A blocked or full store only means
 * the folds are not remembered.
 */
import type { Shelf } from "./roster-shelves.js";

/** The lists that remember their own folds. */
export type ShelfFoldList = "seats" | "scenario-select";

export const SHELF_FOLDS_KEY_PREFIX = "mc-shelf-folds-";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export const shelfFoldsKey = (list: ShelfFoldList): string => `${SHELF_FOLDS_KEY_PREFIX}${list}`;

/** The shelf ids folded in `list`; empty when nothing was ever folded or the stored value is not a list of strings. */
export function loadShelfFolds(
  list: ShelfFoldList,
  storage: PrefStorage | null = browserStorage(),
): ReadonlySet<string> {
  try {
    const raw = storage?.getItem(shelfFoldsKey(list));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function saveShelfFolds(
  list: ShelfFoldList,
  folded: ReadonlySet<string>,
  storage: PrefStorage | null = browserStorage(),
): void {
  try {
    storage?.setItem(shelfFoldsKey(list), JSON.stringify([...folded].sort()));
  } catch {
    // A full or blocked store only means the folds are not remembered.
  }
}

/** `folded` with `shelfId` folded if it was open, opened if it was folded. */
export function toggleShelfFold(folded: ReadonlySet<string>, shelfId: string): ReadonlySet<string> {
  const next = new Set(folded);
  if (!next.delete(shelfId)) next.add(shelfId);
  return next;
}

/** `folded` with `shelfId` open (a Random landing there must be seen). */
export function unfoldShelf(folded: ReadonlySet<string>, shelfId: string): ReadonlySet<string> {
  if (!folded.has(shelfId)) return folded;
  const next = new Set(folded);
  next.delete(shelfId);
  return next;
}

/**
 * The shelves with the folded ones marked `collapsed`. A search or a chip is the player asking to see matches, so
 * while `filtering` nothing is folded away (the folds come back when the filter clears).
 */
export function foldShelves<T>(
  shelves: readonly Shelf<T>[],
  folded: ReadonlySet<string>,
  filtering: boolean,
): readonly Shelf<T>[] {
  if (filtering || folded.size === 0) return shelves;
  return shelves.map((shelf) => (folded.has(shelf.id) ? { ...shelf, collapsed: true } : shelf));
}

/** The items on the shelves that are open, in reading order: the ones that have focus stops. */
export function openShelfItems<T>(shelves: readonly Shelf<T>[]): readonly T[] {
  return shelves.flatMap((shelf) => (shelf.collapsed ? [] : shelf.items));
}

/**
 * The list's focus keys in reading order: each shelf's header stop (`<headerPrefix>:<shelfId>`), then its cards'
 * stops (`<cardPrefix>:<itemId>`) unless it is folded, which skips them.
 */
export function shelfFocusKeys<T>(
  shelves: readonly Shelf<T>[],
  headerPrefix: string,
  cardPrefix: string,
  idOf: (item: T) => string,
): readonly string[] {
  return shelves.flatMap((shelf) => [
    `${headerPrefix}:${shelf.id}`,
    ...(shelf.collapsed ? [] : shelf.items.map((item) => `${cardPrefix}:${idOf(item)}`)),
  ]);
}

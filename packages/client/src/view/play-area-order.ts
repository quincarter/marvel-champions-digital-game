/**
 * The order a play area is drawn in (#768). A view preference only: the engine's `player.playArea` keeps the order
 * cards entered play, and the board model sorts what it hands the scene. Every sort is stable and breaks a tie by the
 * order the cards entered play, so "as played" is also what a tie falls back to.
 */
import type { PlayAreaOrder } from "../settings.js";

/** What a sort reads off one card: its type, printed cost (null for a card with none) and the name shown. */
export interface PlayAreaSortKey {
  readonly type: string | undefined;
  readonly cost: number | null;
  readonly name: string;
}

/**
 * "By type" groups: allies, then supports, then upgrades, then every other type together (events and resources do not
 * normally stay in play; a card treated as something else sorts under the type it reads as).
 */
export const PLAY_AREA_TYPE_ORDER: readonly string[] = ["ally", "support", "upgrade"];

const typeRank = (type: string | undefined): number => {
  const rank = type === undefined ? -1 : PLAY_AREA_TYPE_ORDER.indexOf(type);
  return rank === -1 ? PLAY_AREA_TYPE_ORDER.length : rank;
};

/** `items` in the order `order` asks for: a new array, the input untouched; "played" returns them as given. */
export function sortPlayArea<T>(
  items: readonly T[],
  order: PlayAreaOrder,
  keyOf: (item: T) => PlayAreaSortKey,
): readonly T[] {
  if (order === "played") return items;
  const keyed = items.map((item, index) => ({ item, index, key: keyOf(item) }));
  const compare = (a: (typeof keyed)[number], b: (typeof keyed)[number]): number => {
    switch (order) {
      case "type":
        return typeRank(a.key.type) - typeRank(b.key.type);
      case "cost": {
        // A card with no printed cost goes last.
        const left = a.key.cost ?? Number.POSITIVE_INFINITY;
        const right = b.key.cost ?? Number.POSITIVE_INFINITY;
        return left === right ? 0 : left < right ? -1 : 1;
      }
      case "name":
        return a.key.name.localeCompare(b.key.name, undefined, { sensitivity: "base", numeric: true });
    }
  };
  return keyed.sort((a, b) => compare(a, b) || a.index - b.index).map((entry) => entry.item);
}

/**
 * Pool lookups shared by both import formats. Pure: the pool is passed in by
 * the caller (real content in the client, a small fixture in tests) rather
 * than fetched, so this module needs no network and no bundled data of its
 * own.
 */
import type { AnyCard } from "../schema/cards/index.js";
import type { CardId } from "../schema/ids.js";

export function indexById(pool: readonly AnyCard[]): ReadonlyMap<string, AnyCard> {
  return new Map(pool.map((card) => [card.id as string, card]));
}

/**
 * Cards grouped by their printed name, case- and whitespace-insensitive. A
 * pasted decklist names cards by title, and more than one card code can share
 * a title (Core's four "Wakanda Forever!" codes, RRG 1.8 "Copy" p. 13) — every
 * lookup callers do against this index has to be ready for that, which is why
 * this returns groups rather than a single card.
 */
export function indexByName(pool: readonly AnyCard[]): ReadonlyMap<string, readonly AnyCard[]> {
  const groups = new Map<string, AnyCard[]>();
  for (const card of pool) {
    const key = normalizeName(card.name);
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  return groups;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Splits `total` copies of one title across the card codes that share it, the
 * only way this can be done without guessing: every code's own
 * `quantityInSet` (how many copies the identity set it belongs to actually
 * prints of it) must sum to exactly `total`. That is data already on the
 * cards, not an assumption — it is the specific, printed makeup of the set
 * (Core's "Wakanda Forever!" is 1+1+1+2 across its four codes), so it is the
 * only combination that could ever total that count for those exact records.
 * Returns null when the codes don't add up, so the caller can refuse rather
 * than guess a different split.
 */
export function splitByQuantityInSet(cards: readonly AnyCard[], total: number): ReadonlyMap<CardId, number> | null {
  const sum = cards.reduce((n, card) => n + (Number.isInteger(card.quantityInSet) ? card.quantityInSet : 0), 0);
  if (sum !== total || sum <= 0) return null;
  return new Map(cards.map((card) => [card.id, card.quantityInSet]));
}

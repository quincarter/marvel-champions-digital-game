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

/** What a decklist already says about the deck, used to pick between cards that share a title. */
export interface TitleContext {
  /** The deck's hero identity, when the text named one the pool knows. */
  readonly identity: AnyCard | null;
  /** The deck's chosen aspects, lower-cased. */
  readonly aspects: readonly string[];
}

/** `Title (code)` or `Title (Pack)`: a trailing parenthetical that picks one of several same-titled cards. */
const TITLE_SUFFIX = /^(.*?)\s*\(([^()]+)\)\s*$/;

export function splitTitleSuffix(name: string): { readonly title: string; readonly token: string } | null {
  const match = TITLE_SUFFIX.exec(name.trim());
  if (!match || match[1]!.length === 0) return null;
  return { title: match[1]!, token: match[2]!.trim() };
}

/** Whether a suffix token (`44002`, `Deadpool`, `Core Set`) names this card: by code, or by its pack's set code. */
export function cardMatchesToken(card: AnyCard, token: string): boolean {
  const t = token.trim().toLowerCase();
  if ((card.id as string).toLowerCase() === t) return true;
  const set = (card.setCode as string).toLowerCase();
  return set === t || set === t.replace(/[\s-]+/g, "_");
}

/** How a bare title might still be written to name one card exactly, for messages. */
export function describeCandidates(cards: readonly AnyCard[]): string {
  return cards.map((c) => `"${c.name} (${c.id})" (${c.type.replace(/_/g, " ")}, ${c.setCode})`).join(", ");
}

const aspectOf = (card: AnyCard): string | undefined => ("aspect" in card ? (card.aspect as string) : undefined);

/**
 * Resolves `quantity` copies of one title to card codes, or null when it cannot be done without guessing. In order:
 * a hero identity or encounter card sharing the title is not a deck card (when a player card shares it too); reprints count as their
 * original; of what is left, the cards legal for this deck's hero and chosen aspects (basic, a chosen aspect, the
 * identity's own set) win when that leaves exactly one printed card; otherwise the title must split exactly the way
 * the set prints it (`splitByQuantityInSet`: Core's four "Wakanda Forever!" codes).
 */
export function resolveTitleCopies(
  matches: readonly AnyCard[],
  quantity: number,
  context: TitleContext,
  reprints: Readonly<Record<string, string>>,
): ReadonlyMap<CardId, number> | null {
  let candidates = matches;
  // Player cards only: a hero identity or an encounter card (Mind Scan the treachery) sharing the title is no deck card.
  const playerCards = candidates.filter((card) => card.type !== "hero_identity" && aspectOf(card) !== undefined);
  if (playerCards.length > 0) candidates = playerCards;
  const distinct = (cards: readonly AnyCard[]) => new Set(cards.map((card) => reprints[card.id] ?? card.id));
  const only = (cards: readonly AnyCard[]) => {
    const originals = distinct(cards);
    if (originals.size !== 1) return null;
    return new Map<CardId, number>([[cards.find((card) => originals.has(card.id))!.id, quantity]]);
  };
  const single = only(candidates);
  if (single) return single;
  const legal = candidates.filter((card) => {
    const aspect = aspectOf(card);
    if (aspect === undefined) return false;
    return (
      aspect === "basic" ||
      context.aspects.includes(aspect) ||
      (context.identity !== null && aspect === `hero:${context.identity.id}`)
    );
  });
  if (legal.length > 0 && legal.length < candidates.length) {
    const narrowed = only(legal);
    if (narrowed) return narrowed;
    candidates = legal;
  }
  return splitByQuantityInSet(candidates, quantity);
}

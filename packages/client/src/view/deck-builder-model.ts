/**
 * The minimal deck builder's state and pure operations: pick an identity and
 * aspect(s), search/filter the pool, add/remove cards, read live legality.
 *
 * Every add/remove is a plain data transform; every legality read is a fresh
 * call to `@mc/engine`'s `validateDeck` — never a rule reimplemented here.
 * `BuilderState` is deliberately just a `Deck` plus a `name`-in-progress and a
 * filter, so "save" is "hand the `Deck` to storage" with nothing to reconcile.
 */
import {
  deckId,
  type AnyCard,
  type CardId,
  type CardType,
  type CoreAspect,
  type Deck,
  type DeckCardEntry,
  type HeroIdentityCard,
  type StarterDeck,
  type Trait,
} from "@mc/content";
import {
  CHOOSABLE_ASPECTS,
  cardOfferedToDeck,
  requiredIdentitySet,
  validateDeck,
  type CardPool,
  type DeckValidation,
} from "@mc/engine";
import { perPlayerCostOf } from "./per-player-cost.js";

export interface PoolFilter {
  readonly text?: string;
  readonly aspect?: CoreAspect | "basic" | "identity" | null;
  readonly type?: CardType | null;
  readonly trait?: Trait | null;
  readonly maxCost?: number | null;
  /** One pack, by `Pack.code` (the card's `setCode`). */
  readonly packCode?: string | null;
  /** One release wave/cycle, by `Cycle.id` (the card's `cycleId`). */
  readonly cycleId?: string | null;
}

/** The pool list's order. `default` is alphabetical by name — what the list has always shown. */
export type PoolSort = "default" | "name" | "cost" | "pack";

/** A pack's display facts, in release order — the client's `POOL_PACKS` joined to its cycle (`POOL_HERO_SHELF_PACKS`). */
export interface PackInfo {
  readonly code: string;
  readonly name: string;
  readonly cycleId: string;
  readonly cycleName: string;
}

/** A pack/cycle choice for the filter steppers. */
export interface FilterChoice {
  readonly id: string;
  readonly name: string;
}

const cardsOf = (pool: CardPool): readonly AnyCard[] => (Array.isArray(pool) ? pool : Object.values(pool));

/** Every hero identity in the pool, for the "pick an identity" step, sorted by name. */
export function identityOptions(pool: CardPool): readonly HeroIdentityCard[] {
  return cardsOf(pool)
    .filter((card): card is HeroIdentityCard => card.type === "hero_identity")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** How many aspects `identity` requires the deck to choose (RRG default 1; `IdentityDeckbuilding.aspectCount` overrides it). */
export function aspectCountFor(identity: HeroIdentityCard): number {
  const n = identity.deckbuilding?.aspectCount;
  return Number.isInteger(n) && (n as number) >= 1 ? (n as number) : 1;
}

/**
 * A new deck for `identity`, starting from its identity set (the engine's `requiredIdentitySet`).
 *
 * Every deck for that hero must hold those cards at their exact quantities, so the builder
 * puts them in rather than making the player add each signature card by hand; it used to start
 * empty, opening on a wall of "is missing" problems. No aspect is chosen yet, so the deck stays
 * illegal until the player picks one and fills out the rest.
 */
export function newDeck(
  identity: HeroIdentityCard,
  pool: CardPool,
  id: string,
  poolVersion: string,
  now: string,
): Deck {
  return {
    id: deckId(id),
    name: `${identity.name} (new deck)`,
    identityCardId: identity.id,
    aspects: [],
    cards: requiredIdentitySet(identity, pool),
    poolVersion,
    source: { kind: "userBuilt", createdAt: now },
    updatedAt: now,
  };
}

/**
 * Stamps `deck.updatedAt` (W9, docs/phase4-screen-gaps.md §3 "Recently changed") — called at every point a deck is
 * actually persisted (the builder's Save, an import, a duplicate), never on every in-progress edit: `BuilderState`
 * holds a `Deck` the player is still shaping, and stamping it on every keystroke would make "recently changed" mean
 * "currently open in the builder" rather than "saved". `now` is supplied by the caller for the same testability
 * reason `newDeck` already takes it, rather than this module reading a clock.
 */
export function touch(deck: Deck, now: string): Deck {
  return { ...deck, updatedAt: now };
}

/**
 * "Duplicate" (W9): a new, independently-editable copy of `deck` — same identity, aspects and cards, a fresh id and
 * a name that says so. Always comes back `userBuilt`: duplicating a precon (never itself stored — `preconDecks`
 * derives it fresh every time) or an imported deck both produce a deck the player now owns and edits directly, not
 * a second copy still claiming to be that precon or that MarvelCDB import.
 */
export function duplicateDeck(deck: Deck, id: string, now: string): Deck {
  return {
    id: deckId(id),
    name: `${deck.name} (copy)`,
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    cards: deck.cards,
    poolVersion: deck.poolVersion,
    source: { kind: "userBuilt", createdAt: now },
    updatedAt: now,
  };
}

/** The words a text search reads on a card besides its name: its traits and its type ("event", "player side scheme"). */
const searchWordsOf = (card: AnyCard): readonly string[] => [
  ...("traits" in card ? (card.traits as readonly string[]) : []),
  card.type.replace(/_/g, " "),
];

const textMatch = (card: AnyCard, text: string): boolean => {
  const needle = text.trim().toLowerCase();
  return (
    card.name.toLowerCase().includes(needle) || searchWordsOf(card).some((word) => word.toLowerCase().includes(needle))
  );
};

const matchesFilter = (card: AnyCard, filter: PoolFilter): boolean => {
  if (filter.type && card.type !== filter.type) return false;
  if (filter.text && !textMatch(card, filter.text)) return false;
  if ("traits" in card && filter.trait && !(card.traits as readonly Trait[]).includes(filter.trait)) return false;
  if ("cost" in card && typeof filter.maxCost === "number" && (card as { cost: number }).cost > filter.maxCost)
    return false;
  if (filter.packCode && (card.setCode as string) !== filter.packCode) return false;
  if (filter.cycleId && (card.cycleId as string) !== filter.cycleId) return false;
  if (filter.aspect) {
    const aspect = "aspect" in card ? (card as { aspect: string }).aspect : null;
    if (filter.aspect === "identity" ? !aspect?.startsWith("hero:") : aspect !== filter.aspect) return false;
  }
  return true;
};

/**
 * Cards a player could add to a deck for `identity`, narrowed further by `filter`: the engine's per-card reading of
 * the deck rules (`cardOfferedToDeck`, the same predicates `validateDeck` uses), so an identity's own off-aspect rule
 * (Cable's player side schemes, Gamora's events) and every "never a deck card" case (Linked, separate-deck, campaign
 * and scenario cards, other heroes' Team-Up) follow it with no client-side copy of the rule. `validateDeck` is still
 * what judges the deck that results.
 */
export function browsablePool(
  pool: CardPool,
  identity: HeroIdentityCard,
  chosenAspects: readonly CoreAspect[],
  filter: PoolFilter = {},
  sort: PoolSort = "default",
  packs: readonly PackInfo[] = [],
  held: ReadonlySet<string> = new Set(),
): readonly AnyCard[] {
  // `held` is the ids the deck already contains: they stay listed even when the deck's rules now refuse them, so each
  // can still be removed from the list (the legality line says why it is refused).
  const filtered = cardsOf(pool)
    .filter((card) => held.has(card.id as string) || cardOfferedToDeck(card, identity, chosenAspects).offered)
    .filter((card) => matchesFilter(card, filter));

  // Wave 1 reprints the same basic/aspect card (by title) across several packs
  // under a different card id each time — Energy, For Justice!, and so on —
  // and the RRG's 3-copy limit is by *title*, not by printing (`validateDeck`
  // already reads it that way). Listing every printing separately showed
  // "Energy" seven times over, once per pack that happened to reprint it,
  // which reads as seven different cards rather than one. One row per
  // distinct (name, type): the first printing found — `pool` is Core-first,
  // then wave 1 in pack order (`content/pool.ts`), so a Core reprint's own
  // id wins when one exists, matching what a player already has in an
  // existing Core deck. `addCard`/`removeCard` then always add against that
  // one id, so a deck never splits the same titled card across two ids.
  const seen = new Map<string, AnyCard>();
  for (const card of filtered) {
    const key = `${card.name} ${card.type}`;
    // A printing the deck holds wins over an earlier one, so the row's "-" removes what is actually in the deck.
    const have = seen.get(key);
    if (!have || (held.has(card.id as string) && !held.has(have.id as string))) seen.set(key, card);
  }
  return nameMatchesFirst(sortPool([...seen.values()], sort, packs), filter.text);
}

/** With a text search, cards whose name matches come before cards matching only by trait or type (order kept within each). */
function nameMatchesFirst(cards: readonly AnyCard[], text: string | undefined): readonly AnyCard[] {
  const needle = text?.trim().toLowerCase();
  if (!needle) return cards;
  const byName = cards.filter((card) => card.name.toLowerCase().includes(needle));
  return [...byName, ...cards.filter((card) => !card.name.toLowerCase().includes(needle))];
}

const costOf = (card: AnyCard): number => ("cost" in card && typeof card.cost === "number" ? card.cost : Infinity);

/**
 * `cards` in `sort` order, always ending ties by name. `cost` puts a card with no printed cost last; `pack` is
 * release order (`packs`' own order; a pack it doesn't list sorts after every listed one), then collector number
 * compared numerically ("2" before "10", "12a" after "12").
 */
export function sortPool(cards: readonly AnyCard[], sort: PoolSort, packs: readonly PackInfo[]): readonly AnyCard[] {
  const byName = (a: AnyCard, b: AnyCard): number => a.name.localeCompare(b.name);
  if (sort === "cost") return cards.slice().sort((a, b) => costOf(a) - costOf(b) || byName(a, b));
  if (sort === "pack") {
    const order = new Map(packs.map((p, i) => [p.code, i]));
    const rank = (card: AnyCard): number => order.get(card.setCode as string) ?? Infinity;
    return cards
      .slice()
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.setCode as string).localeCompare(b.setCode as string) ||
          a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }) ||
          byName(a, b),
      );
  }
  return cards.slice().sort(byName);
}

/**
 * The cycles and packs the filter steppers can land on: only those with at least one browsable card under the
 * *other* filters (so stepping never lands on an empty list), packs narrowed to the chosen cycle, both in release order.
 */
export function packFilterChoices(
  pool: CardPool,
  identity: HeroIdentityCard,
  chosenAspects: readonly CoreAspect[],
  filter: PoolFilter,
  packs: readonly PackInfo[],
): { readonly cycles: readonly FilterChoice[]; readonly packs: readonly FilterChoice[] } {
  const { packCode: _p, cycleId: _c, ...rest } = filter;
  const present = new Set(browsablePool(pool, identity, chosenAspects, rest).map((c) => c.setCode as string));
  const have = packs.filter((p) => present.has(p.code));
  const cycles: FilterChoice[] = [];
  for (const p of have) if (!cycles.some((c) => c.id === p.cycleId)) cycles.push({ id: p.cycleId, name: p.cycleName });
  return {
    cycles,
    packs: have
      .filter((p) => !filter.cycleId || p.cycleId === filter.cycleId)
      .map((p) => ({ id: p.code, name: p.name })),
  };
}

/** What a pool row's few words say about why a card is listed, or null when it is an ordinary choice. */
export function poolRowNote(
  card: AnyCard,
  identity: HeroIdentityCard,
  chosenAspects: readonly CoreAspect[],
): string | null {
  const offered = cardOfferedToDeck(card, identity, chosenAspects);
  if (!offered.offered) return "not allowed in this deck";
  if (offered.via === "allowance") {
    const bySlot = identity.deckbuilding?.offAspectAllowance?.anyTrait === undefined;
    return `${identity.name}: ${bySlot ? "any aspect" : "other aspect"}`;
  }
  if (offered.via === "package") return `${identity.name}: other aspect`;
  return null;
}

/** "event · cost 3", or "event · 3 per player" for a per player cost (read as Inspect words it, outside a game). */
export function poolTypeLine(card: AnyCard): string {
  const type = card.type.replace(/_/g, " ");
  const perPlayer = perPlayerCostOf(null, card);
  if (perPlayer) return `${type} · ${perPlayer.rateLabel}`;
  return `${type} · cost ${"cost" in card && typeof card.cost === "number" ? String(card.cost) : "—"}`;
}

/** Steps `current` through [null (= all), ...choices] by `dir`, wrapping; an unknown `current` counts as all. */
export function stepChoice(
  choices: readonly FilterChoice[],
  current: string | null | undefined,
  dir: 1 | -1,
): string | null {
  const ids: (string | null)[] = [null, ...choices.map((c) => c.id)];
  const at = Math.max(0, ids.indexOf(current ?? null));
  return ids[(at + dir + ids.length) % ids.length] ?? null;
}

/** `filter` with a new cycle: the pack choice is dropped when it isn't in that cycle. */
export function withCycle(filter: PoolFilter, cycleId: string | null, packs: readonly PackInfo[]): PoolFilter {
  const keepPack = !cycleId || packs.find((p) => p.code === filter.packCode)?.cycleId === cycleId;
  return { ...filter, cycleId, packCode: keepPack ? (filter.packCode ?? null) : null };
}

function withQuantity(cards: readonly DeckCardEntry[], cardId: CardId, delta: number): readonly DeckCardEntry[] {
  const existing = cards.find((c) => c.cardId === cardId);
  const next = Math.max(0, (existing?.quantity ?? 0) + delta);
  const withoutIt = cards.filter((c) => c.cardId !== cardId);
  return next > 0 ? [...withoutIt, { cardId, quantity: next }] : withoutIt;
}

/** Adds one copy of `cardId` to the deck (a fresh line at quantity 1 if it isn't in the deck yet). */
export function addCard(deck: Deck, cardId: CardId): Deck {
  return { ...deck, cards: withQuantity(deck.cards, cardId, 1) };
}

/** Removes one copy; the line disappears once its quantity reaches 0. */
export function removeCard(deck: Deck, cardId: CardId): Deck {
  return { ...deck, cards: withQuantity(deck.cards, cardId, -1) };
}

export function setAspects(deck: Deck, aspects: readonly CoreAspect[]): Deck {
  return { ...deck, aspects };
}

export function setName(deck: Deck, name: string): Deck {
  return { ...deck, name };
}

/** Live legality, exactly as the Decks screen and `createGame` see it — never a client-side approximation. */
export function legalityOf(deck: Deck, pool: CardPool): DeckValidation {
  return validateDeck(deck, pool);
}

/**
 * "Clear" (W1, docs/phase4-screen-gaps.md §3): drops every added card, back to just the identity's own signature
 * set — the same starting point `newDeck` gives a brand new deck. Keeps everything else about the deck (id, name,
 * chosen aspects, source) untouched; only `cards` resets, so a player who cleared by mistake hasn't also lost their
 * aspect pick or had the deck treated as a different one.
 */
export function resetToIdentitySet(deck: Deck, identity: HeroIdentityCard, pool: CardPool): Deck {
  return { ...deck, cards: requiredIdentitySet(identity, pool) };
}

/**
 * "Preconstructed" (W1): resets `aspects` and `cards` to this identity's own precon, when one exists in `starterDecks`
 * — null otherwise (an identity with no published precon, so the button has nothing to reset to and a caller should
 * disable it with that reason rather than call this). Keeps the deck's own id/name/source: this replaces what the
 * deck holds, it doesn't hand back a different deck.
 */
export function resetToPrecon(
  deck: Deck,
  identity: HeroIdentityCard,
  starterDecks: readonly StarterDeck[],
): Deck | null {
  const starter = starterDecks.find((s) => (s.identityCardId as string) === (identity.id as string));
  if (!starter) return null;
  return {
    ...deck,
    aspects: [...starter.aspects],
    cards: starter.cards.map(({ cardId: id, quantity }) => ({ cardId: id, quantity })),
  };
}

/** The aspects selectable in the picker, in a stable order. */
export const SELECTABLE_ASPECTS: readonly CoreAspect[] = CHOOSABLE_ASPECTS;

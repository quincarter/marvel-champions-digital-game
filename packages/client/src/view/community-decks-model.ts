/**
 * Community decks on the Decks screen: the public MarvelCDB decklists this game has saved and tested (`@mc/cards`'s
 * `communityDecks`), offered as recommendations beside the precons. Pure and Vitest-testable; no Phaser here.
 *
 * An offer is never seated directly. The player adds it to their own decks as an editable copy, which from then on
 * is an ordinary imported deck (`DeckSource` "imported", carrying the MarvelCDB id and URL, so the credit survives).
 * Building from scratch and importing any other MarvelCDB deck are untouched by this module.
 *
 * Legality is still the engine's verdict (`deckOptionOf` → `validateDeck`); this module adds only the progression
 * gate: a community deck is offered when its hero and every card's wave are open to the player.
 */
import type { CommunityDeck } from "@mc/cards";
import { deckId, type AnyCard, type Deck } from "@mc/content";
import type { CardPool, EngineDeps } from "@mc/engine";
import { aspectName } from "./aspect-stamp.js";
import { uniqueDeckName } from "./deck-import-model.js";
import { deckOptionOf, type DeckOption } from "./deck-list-model.js";
import { matchesSearch } from "./roster-filter.js";
import { communityDeckIdOf, isCommunityDeckId } from "./community-deck-id.js";

/** The part of `progression/unlocks.ts`'s `Unlocks` this module asks. */
export interface CommunityDeckGate {
  heroLock(identityCardId: string): string | null;
  waveLock(cycleId: string | undefined): string | null;
}

export interface CommunityOffer {
  readonly entry: CommunityDeck;
  /** The deck as the list, the card preview and Deck check read it. Its id is `community:<MarvelCDB id>`; it is never stored. */
  readonly option: DeckOption;
  /** What the player must do before this deck is offered (its hero, or a wave one of its cards comes from), or null. */
  readonly lock: string | null;
  /** The player already has a copy of this decklist among their own decks. */
  readonly added: boolean;
}

export { communityDeckIdOf, isCommunityDeckId };

const cardsById = (pool: CardPool): ((id: string) => AnyCard | undefined) => {
  if (!Array.isArray(pool)) return (id) => (pool as Record<string, AnyCard>)[id];
  const map = new Map<string, AnyCard>(pool.map((card: AnyCard) => [card.id as string, card]));
  return (id) => map.get(id);
};

/** The hero's lock, else the lock of the first card whose wave is still shut. */
export function communityDeckLock(entry: CommunityDeck, pool: CardPool, gate: CommunityDeckGate): string | null {
  const heroLock = gate.heroLock(entry.identityCardId as string);
  if (heroLock) return heroLock;
  const cardOf = cardsById(pool);
  for (const { cardId } of entry.contents.cards) {
    const card = cardOf(cardId as string);
    const lock = gate.waveLock(card?.cycleId as string | undefined);
    if (lock) return card ? `${lock} (${card.name})` : lock;
  }
  return null;
}

/** `entry` as a `Deck` for display. `updatedAt` is left unset: "recently changed" is about the player's own edits. */
export function communityDeckAsDeck(entry: CommunityDeck, poolVersion: string): Deck {
  // One object per entry and version, so the status remembered for it (`deckOptionOf`, or a worker's answer) is found again.
  const known = decksOfEntry.get(entry);
  if (known?.poolVersion === poolVersion) return known;
  const deck = buildCommunityDeck(entry, poolVersion);
  decksOfEntry.set(entry, deck);
  return deck;
}

const decksOfEntry = new WeakMap<CommunityDeck, Deck>();

function buildCommunityDeck(entry: CommunityDeck, poolVersion: string): Deck {
  return {
    id: deckId(communityDeckIdOf(entry.marvelcdbId)),
    name: entry.name,
    identityCardId: entry.contents.identityCardId,
    aspects: entry.contents.aspects,
    cards: entry.contents.cards,
    poolVersion,
    source: {
      kind: "imported",
      site: "marvelcdb",
      marvelcdbDeckId: String(entry.marvelcdbId),
      url: entry.url,
      importedAt: entry.publishedAt ?? "",
    },
  };
}

/** The catalog entry a deck came from: a community offer itself, or a saved copy of one (by its MarvelCDB id). */
export function communityEntryOf(deck: Deck, catalog: readonly CommunityDeck[]): CommunityDeck | null {
  if (deck.source.kind !== "imported" || deck.source.marvelcdbDeckId === null) return null;
  const id = deck.source.marvelcdbDeckId;
  return catalog.find((entry) => String(entry.marvelcdbId) === id) ?? null;
}

export interface CommunityOffersInput {
  readonly catalog: readonly CommunityDeck[];
  readonly savedDecks: readonly Deck[];
  readonly pool: CardPool;
  readonly poolVersion: string;
  readonly deps: EngineDeps;
  readonly gate: CommunityDeckGate;
  /** Where each deck's status comes from; `deckOptionOf` when left out. The Decks screen passes its worker-fed lookup. */
  readonly optionOf?: (deck: Deck) => DeckOption;
}

/** Every catalog deck as an offer, in catalog order (by hero, then MarvelCDB id). */
export function communityOffers(input: CommunityOffersInput): readonly CommunityOffer[] {
  const owned = new Set(
    input.savedDecks.flatMap((deck) =>
      deck.source.kind === "imported" && deck.source.marvelcdbDeckId !== null ? [deck.source.marvelcdbDeckId] : [],
    ),
  );
  const optionOf = input.optionOf ?? ((deck: Deck) => deckOptionOf(deck, input.pool, input.poolVersion, input.deps));
  return input.catalog.map((entry) => ({
    entry,
    option: optionOf(communityDeckAsDeck(entry, input.poolVersion)),
    lock: communityDeckLock(entry, input.pool, input.gate),
    added: owned.has(String(entry.marvelcdbId)),
  }));
}

export interface CommunityFilter {
  /** Free text: deck name, hero, aspect, or the author ("andyr" lists that author's decks). */
  readonly text: string;
  readonly aspect?: string | null;
  /** Hide decks that are locked or not legal. */
  readonly availableOnly?: boolean;
}

export function communityOfferMatches(offer: CommunityOffer, filter: CommunityFilter): boolean {
  const { entry } = offer;
  const fields = [entry.name, entry.heroName, offer.option.identityName, entry.author, ...entry.aspects, "community"];
  if (!matchesSearch(fields, filter.text)) return false;
  if (filter.aspect && !entry.aspects.includes(filter.aspect as CommunityDeck["aspects"][number])) return false;
  if (filter.availableOnly && (offer.lock !== null || !offer.option.legal)) return false;
  return true;
}

/**
 * Every community deck as a seatable option (Take your seats), in catalog order. Pure: no saved decks and no gate, since
 * a seat asks the engine for legality (`deckOptionOf`) and the progression gate separately (`testedDeckLockOf`).
 */
export function testedDeckOptions(
  catalog: readonly CommunityDeck[],
  pool: CardPool,
  poolVersion: string,
  deps: EngineDeps,
): readonly DeckOption[] {
  return catalog.map((entry) => deckOptionOf(communityDeckAsDeck(entry, poolVersion), pool, poolVersion, deps));
}

/** The catalog entry behind a deck that is a community offer itself (its id is `community:<id>`), not a saved copy of one. */
export function testedEntryOf(deck: Pick<Deck, "id">, catalog: readonly CommunityDeck[]): CommunityDeck | null {
  const id = deck.id as string;
  if (!isCommunityDeckId(id)) return null;
  return catalog.find((entry) => communityDeckIdOf(entry.marvelcdbId) === id) ?? null;
}

/** What opens a tested deck's hero or card wave, or null when it may sit at a table (or the deck is not a tested one). */
export function testedDeckLockOf(
  deck: Pick<Deck, "id">,
  catalog: readonly CommunityDeck[],
  pool: CardPool,
  gate: CommunityDeckGate,
): string | null {
  const entry = testedEntryOf(deck, catalog);
  return entry ? communityDeckLock(entry, pool, gate) : null;
}

/** A hero tile's second line for a tested deck: "by andyr · MarvelCDB". Null for any other deck. */
export function testedSubtitleOf(deck: Pick<Deck, "id">, catalog: readonly CommunityDeck[]): string | null {
  const entry = testedEntryOf(deck, catalog);
  return entry ? `${communityCredit(entry)} · MarvelCDB` : null;
}

/** What the hero search box also looks in for a tested deck: its author, its hero, and the words "tested" and "MarvelCDB". */
export function testedSearchFieldsOf(deck: Pick<Deck, "id">, catalog: readonly CommunityDeck[]): readonly string[] {
  const entry = testedEntryOf(deck, catalog);
  return entry ? [entry.author, entry.heroName, "tested", "marvelcdb"] : [];
}

/** The decks of one hero, for a screen that already knows which hero is being built or seated. */
export function communityOffersForHero(
  offers: readonly CommunityOffer[],
  identityCardId: string,
): readonly CommunityOffer[] {
  return offers.filter((offer) => (offer.entry.identityCardId as string) === identityCardId);
}

/** "by andyr". */
export const communityCredit = (entry: Pick<CommunityDeck, "author">): string => `by ${entry.author}`;

/**
 * "Tested" for a deck that passed this game's import, legality and play checks and is still legal in the pool the
 * player is running; the lock or the engine's own problem otherwise.
 */
export function communityStatusText(offer: CommunityOffer): string {
  if (offer.lock) return "Locked";
  if (offer.option.checking) return "Checking…";
  return offer.option.legal ? "Tested" : "Not legal";
}

/**
 * A list row's second line: "by andyr · Tested · Spider-Man · Leadership". The credit and the status lead, because the
 * row shows two lines at most and the hero is already the row's picture. A locked deck says what opens it instead.
 */
export function communityMetaLine(offer: CommunityOffer): string {
  return communityMetaCandidates(offer)[0]!;
}

/** `communityMetaLine` from fullest to shortest, for a row that takes the first that fits (see `deckMetaCandidates`). */
export function communityMetaCandidates(offer: CommunityOffer): readonly string[] {
  const { entry } = offer;
  const aspects = entry.aspects.map(aspectName).join(" + ");
  const who = [entry.heroName, ...(aspects ? [aspects] : [])].join(" · ");
  if (offer.lock) return [`${communityCredit(entry)} · ${offer.lock}`, offer.lock];
  const status = communityStatusText(offer);
  return [
    `${communityCredit(entry)} · ${status}${offer.added ? " · in your decks" : ""} · ${who}`,
    `${communityCredit(entry)} · ${status}`,
    status,
  ];
}

/**
 * "Published Nov 6, 2019 · v1.0": when the author published this decklist and its MarvelCDB version. MarvelCDB's
 * `date_update` is deliberately not shown (it moves without the deck changing). Null when neither is known.
 */
export function communityPublishedText(entry: Pick<CommunityDeck, "publishedAt" | "version">): string | null {
  const parts: string[] = [];
  if (entry.publishedAt) {
    const date = new Date(entry.publishedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    parts.push(`Published ${date}`);
  }
  if (entry.version) parts.push(`v${entry.version}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The author's MarvelCDB write-up as plain paragraphs: Markdown and HTML marks dropped, links and images reduced to
 * their words, card links (`[Nick Fury](/card/01084)`) to the card's name. One string per paragraph or list item;
 * empty when the fixture was saved without a write-up.
 */
export function communityNotesOf(description: string): readonly string[] {
  const text = description
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>\n]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // A link an author left half-written ("Aragorn](/card/25007)") keeps its words.
    .replace(/\]\([^)\s]*\)/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = (): void => {
    const joined = current.join(" ").replace(/\s+/g, " ").trim();
    if (joined.length > 0) paragraphs.push(joined);
    current = [];
  };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    // A rule or a table divider carries no words.
    if (line.length === 0 || /^([-*_=]\s*){3,}$/.test(line) || /^\|?[\s:|-]+\|?$/.test(line)) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s*(.*?)\s*#*$/.exec(line);
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    const quote = /^>+\s?(.*)$/.exec(line);
    const body = (heading?.[1] ?? item?.[1] ?? quote?.[1] ?? line)
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(?=\S)(.*?)(?<=\S)\1/g, "$2")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\|/g, " ");
    if (heading || item) {
      flush();
      current.push(item ? `• ${body}` : body);
      flush();
    } else {
      current.push(body);
    }
  }
  flush();
  return paragraphs;
}

export interface AddCommunityDeckEnv {
  readonly poolVersion: string;
  readonly now: () => string;
  readonly newId: () => string;
  readonly existingNames?: readonly string[];
}

/**
 * The player's own editable copy of a community deck: the same cards under the decklist's own name (made unique),
 * recorded as an import from that MarvelCDB decklist so the author's credit and link stay with it.
 */
export function addCommunityDeck(entry: CommunityDeck, env: AddCommunityDeckEnv): Deck {
  const now = env.now();
  return {
    id: deckId(env.newId()),
    name: uniqueDeckName(entry.name, env.existingNames),
    identityCardId: entry.contents.identityCardId,
    aspects: [...entry.contents.aspects],
    cards: entry.contents.cards.map(({ cardId, quantity }) => ({ cardId, quantity })),
    poolVersion: env.poolVersion,
    source: {
      kind: "imported",
      site: "marvelcdb",
      marvelcdbDeckId: String(entry.marvelcdbId),
      url: entry.url,
      importedAt: now,
    },
    updatedAt: now,
  };
}

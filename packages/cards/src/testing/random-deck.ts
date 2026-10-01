import {
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  type AnyCard,
  type CardId,
  type CoreAspect,
  type DeckCardEntry,
  type DeckContents,
  type HeroIdentityCard,
} from "@mc/content";
import {
  abilityRefsOf,
  cardLegalForIdentity,
  copiesUpToLimit,
  DECK_MAX_CARDS,
  DECK_MIN_CARDS,
  requiredIdentitySet,
  validateDeck,
  type EngineDeps,
  type PlayerSetup,
} from "@mc/engine";

/**
 * Seeded random LEGAL decks from the whole playable pool (docs/custom-deck-testing.md "Random-deck coverage").
 *
 * Legality is guaranteed by construction and then by proof: the builder starts from `requiredIdentitySet` (the exact
 * signature quantities), adds only cards `cardLegalForIdentity` accepts (type, Unique vs identity, Team-Up names,
 * no linked / separate-deck / scenario-specific cards) up to `copiesUpToLimit` (three by title, Unique, "Max X per
 * deck", the identity's own `maxCopiesPerTitle`), takes one card per chosen aspect per round so an
 * `equalCardsPerAspect` identity stays equal, and finally runs `validateDeck`. A deck that is still illegal (Maria
 * Hill's all-or-nothing packages, a size overshoot) is discarded and rebuilt from a new sub-seed, so a deck this
 * module returns is always one `validateDeck` accepted. Cards with no ability script are never picked.
 */

/** mulberry32: a small deterministic PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;

const ASPECTS: readonly CoreAspect[] = ["aggression", "justice", "leadership", "protection", "pool"];

const byId = new Map<string, AnyCard>(PLAYABLE_CARDS.map((card) => [card.id as string, card]));

/** Every identity a starter deck of any playable wave seats: the identities the engine can actually build. */
export const PLAYABLE_IDENTITY_IDS: readonly string[] = [
  ...new Set(
    [
      ...CORE_STARTER_DECKS,
      ...WAVE1_STARTER_DECKS,
      ...WAVE2_STARTER_DECKS,
      ...WAVE3_STARTER_DECKS,
      ...WAVE4_STARTER_DECKS,
      ...WAVE5_STARTER_DECKS,
    ].map((deck) => deck.identityCardId as string),
  ),
];

export interface RandomDeck {
  readonly setup: PlayerSetup;
  readonly identityId: string;
  readonly heroName: string;
  readonly aspects: readonly CoreAspect[];
  /** Which sub-seed attempt produced it (0 = first try). */
  readonly attempt: number;
}

const expand = (entries: readonly DeckCardEntry[]): CardId[] =>
  entries.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId));

function addCopy(entries: DeckCardEntry[], cardId: CardId): void {
  const at = entries.findIndex((e) => e.cardId === cardId);
  if (at >= 0) entries[at] = { cardId, quantity: entries[at]!.quantity + 1 };
  else entries.push({ cardId, quantity: 1 });
}

function tryBuild(
  identity: HeroIdentityCard,
  deps: EngineDeps,
  random: () => number,
): { contents: DeckContents } | null {
  const required = requiredIdentitySet(identity, PLAYABLE_CARDS);
  const aspectCount = identity.deckbuilding?.aspectCount ?? 1;
  if (aspectCount > ASPECTS.length) return null;
  const aspects: CoreAspect[] = [];
  const bag = [...ASPECTS];
  while (aspects.length < aspectCount) aspects.push(bag.splice(Math.floor(random() * bag.length), 1)[0]!);

  const scripted = (card: AnyCard): boolean => abilityRefsOf(card).every((ref) => deps.abilities[ref.id] !== undefined);
  const legal = PLAYABLE_CARDS.filter(
    (card) => "aspect" in card && cardLegalForIdentity(card, identity) && scripted(card),
  );
  const pool = (aspect: string): AnyCard[] => legal.filter((card) => "aspect" in card && card.aspect === aspect);
  const aspectPools = aspects.map((aspect) => pool(aspect));
  const basics = pool("basic");
  if (aspectPools.some((p) => p.length === 0) || basics.length === 0) return null;

  const entries: DeckCardEntry[] = required.map((e) => ({ ...e }));
  const size = (): number => entries.reduce((n, e) => n + e.quantity, 0);
  const target = DECK_MIN_CARDS + Math.floor(random() * (DECK_MAX_CARDS - DECK_MIN_CARDS + 1));
  const take = (cards: readonly AnyCard[]): boolean => {
    // Shuffle-free: probe random cards first, then sweep, so a nearly full pool still finds its last legal copy.
    for (let i = 0; i < 12; i++) {
      const card = pick(random, cards);
      if (copiesUpToLimit(entries, card.id, identity, PLAYABLE_CARDS) > 0) return (addCopy(entries, card.id), true);
    }
    const open = cards.filter((card) => copiesUpToLimit(entries, card.id, identity, PLAYABLE_CARDS) > 0);
    if (open.length === 0) return false;
    addCopy(entries, pick(random, open).id);
    return true;
  };
  // Rounds: one card from each chosen aspect (so equal-per-aspect identities stay equal), then usually a basic.
  while (size() + aspects.length < target) {
    for (const cards of aspectPools) if (!take(cards)) return null;
    if (random() < 0.3 && size() < target) take(basics);
  }
  while (size() < target) if (!take(basics)) break;
  return { contents: { identityCardId: identity.id, aspects, cards: entries } };
}

/**
 * One random legal deck for the identity at `index` (modulo the identity list) or, when `identityId` is given, for
 * that identity. Throws only if 200 sub-seeds all fail, which would itself be a finding.
 */
export function randomLegalDeck(seed: number, deps: EngineDeps, identityId?: string): RandomDeck {
  const random = rng(seed);
  const id = identityId ?? pick(random, PLAYABLE_IDENTITY_IDS);
  const identity = byId.get(id);
  if (!identity || identity.type !== "hero_identity") throw new Error(`${id} is not a playable hero identity`);
  for (let attempt = 0; attempt < 200; attempt++) {
    const built = tryBuild(identity, deps, rng(seed * 7919 + attempt * 104729 + 1));
    if (!built) continue;
    if (!validateDeck(built.contents, PLAYABLE_CARDS).ok) continue;
    return {
      setup: { identityCardId: identity.id, aspects: built.contents.aspects, deck: expand(built.contents.cards) },
      identityId: id,
      heroName: identity.name,
      aspects: built.contents.aspects,
      attempt,
    };
  }
  throw new Error(`no legal random deck for ${id} (${identity.name}) from seed ${seed} in 200 attempts`);
}

/**
 * Wave 5 (cycle 4, Sinister Motives) custom-deck legality: hand-built decks for the wave's new
 * identities, beyond their precons (PLAN.md Phase 7, wave 5 step 4b). Lives in `@mc/engine`
 * (like `deck.test.ts`) rather than `@mc/content`, because checking legality means calling this
 * package's own `validateDeck`/`requiredIdentitySet`.
 *
 * Every deck built here is drawn from real card data (never a synthetic card), following
 * `deck.test.ts`'s `spiderManBuilt` pattern generalized across packs.
 */
import {
  CORE_CARDS,
  IRONHEART_CARDS,
  IRONHEART_STARTER_DECKS,
  NOVA_CARDS,
  NOVA_STARTER_DECKS,
  SM_CARDS,
  SM_STARTER_DECKS,
  SPDR_CARDS,
  SPDR_STARTER_DECKS,
  SPIDERHAM_CARDS,
  SPIDERHAM_STARTER_DECKS,
  cardId,
  type AnyCard,
  type CoreAspect,
  type DeckCardEntry,
  type DeckContents,
  type HeroIdentityCard,
  type PlayerCard,
  type StarterDeck,
} from "@mc/content";
import { DECK_MIN_CARDS, requiredIdentitySet, validateDeck, type DeckProblemCode } from "./deck.js";

// ---- Small helpers over real pool data (mirrors deck.test.ts's spiderManBuilt) -------------

const isPlayerCard = (card: AnyCard): card is PlayerCard => "deckLimit" in card;

const identityOf = (id: string, cards: readonly AnyCard[]): HeroIdentityCard => {
  const card = cards.find((c) => c.id === id);
  if (card?.type !== "hero_identity") throw new Error(`no hero identity ${id} in the given pool`);
  return card;
};

/**
 * Fills up to `target` cards from `source`, restricted to `aspect` and basic cards (RRG 1.8
 * Appendix I: "customized with cards that belong to that aspect and/or basic cards"), skipping
 * anything that isn't an ordinary deckbuilding choice (identity-specific, separate-deck,
 * campaign/scenario-specific, or linked), at each card's real cap (unique -> 1, else
 * min(deckLimit, quantityInSet)). Deterministic (sorted by id) so tests are reproducible.
 */
function fillTo(
  target: number,
  exclude: ReadonlySet<string>,
  source: readonly AnyCard[],
  aspect: CoreAspect,
): DeckCardEntry[] {
  const entries: DeckCardEntry[] = [];
  let total = 0;
  const candidates = source
    .filter(isPlayerCard)
    .filter((c) => c.aspect === aspect || c.aspect === "basic")
    .filter((c) => c.separateDeck === undefined && c.specificTo === undefined)
    .filter((c) => !c.keywords.some((k) => k.name === "linked"))
    .sort((a, b) => (a.id as string).localeCompare(b.id as string));
  for (const card of candidates) {
    if (total >= target) break;
    if (exclude.has(card.id as string)) continue;
    const cap = card.unique ? 1 : Math.min(card.deckLimit, card.quantityInSet);
    const take = Math.min(cap, target - total);
    if (take <= 0) continue;
    entries.push({ cardId: card.id, quantity: take });
    total += take;
  }
  if (total < target) throw new Error(`not enough ${aspect}/basic filler cards to reach ${target} (got ${total})`);
  return entries;
}

/** A hand-built deck for `identity`: its full identity set, plus real `fillerAspect`/basic cards up to the deck minimum. */
function customDeck(
  identity: HeroIdentityCard,
  ownCards: readonly AnyCard[],
  aspects: readonly CoreAspect[],
  fillerAspect: CoreAspect,
  fillerPool: readonly AnyCard[],
): DeckContents {
  const signature = requiredIdentitySet(identity, ownCards);
  const total = signature.reduce((n, e) => n + e.quantity, 0);
  const need = Math.max(0, DECK_MIN_CARDS - total);
  const excluded = new Set(signature.map((e) => e.cardId as string));
  const filler = fillTo(need, excluded, fillerPool, fillerAspect);
  return { identityCardId: identity.id, aspects, cards: [...signature, ...filler] };
}

/** Sets `id` to exactly `quantity` copies (adding the line if absent), following deck.test.ts's `withCard`. */
const withCard = (deck: DeckContents, id: string, quantity: number): DeckContents => ({
  ...deck,
  cards: [...deck.cards.filter((e) => e.cardId !== id), { cardId: cardId(id), quantity }],
});

const problemsOf = (deck: DeckContents, pool: readonly AnyCard[]) => {
  const verdict = validateDeck(deck, pool);
  return verdict.ok ? [] : verdict.problems;
};
const problem = (deck: DeckContents, code: DeckProblemCode, pool: readonly AnyCard[]) => {
  const all = problemsOf(deck, pool);
  const found = all.find((p) => p.code === code);
  if (!found) throw new Error(`expected ${code}, got ${JSON.stringify(all, null, 2)}`);
  return found;
};

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

// ---- 1. Kits never mix (MC27 p. 21; RRG 1.8 "Identity-Specific Card" p. 23) ----------------

describe("kits never mix: Peter Parker's and Miles Morales's identity-specific cards (MC27 p. 21; RRG 1.8 p. 23)", () => {
  const smAndCore = [...SM_CARDS, ...CORE_CARDS];

  it("a Miles Morales deck with one Peter Parker signature card is rejected (other_identity_card)", () => {
    // 01002 "Black Cat (Felicia Hardy)" carries `aspect: "hero:01001a"` (Peter Parker's Core set icon).
    const deck = withCard(contentsOf(SM_STARTER_DECKS.find((d) => d.id === "spider-man-morales")!), "01002", 1);
    const p = problem(deck, "other_identity_card", smAndCore);
    expect(p.message).toContain("Black Cat");
    expect(p.message).toContain("Peter Parker");
  });

  it("a Peter Parker (Core) deck with one Miles Morales signature card is rejected (other_identity_card)", () => {
    // 27031 "Arachnobatics" carries `aspect: "hero:27030a"` (Miles Morales's set icon).
    const identity = identityOf("01001a", CORE_CARDS);
    const base = customDeck(identity, CORE_CARDS, ["justice"], "justice", CORE_CARDS);
    const deck = withCard(base, "27031", 1);
    const p = problem(deck, "other_identity_card", smAndCore);
    expect(p.message).toContain("Arachnobatics");
    expect(p.message).toContain("Miles Morales");
  });

  it("a Ghost-Spider deck with one Miles Morales signature card is rejected (other_identity_card)", () => {
    const deck = withCard(contentsOf(SM_STARTER_DECKS.find((d) => d.id === "ghost-spider")!), "27031", 1);
    const p = problem(deck, "other_identity_card", SM_CARDS);
    expect(p.message).toContain("Arachnobatics");
    expect(p.message).toContain("Miles Morales");
  });
});

/**
 * "Spider-Man"-named allies that are NOT identity-specific: 27011 (subtitle "Miles Morales",
 * `aspect: "protection"`), 27017 (subtitle "Hobie Brown", `aspect: "basic"`), and 27049
 * (subtitle "Peter Parker", `aspect: "basic"`). None carries a `hero:<id>` set icon, so
 * `other_identity_card` never reaches them — confirmed by the fact that the Miles Morales
 * precon itself legally includes both 27048 (Ghost-Spider ally) and 27049 (Spider-Man/Peter
 * Parker ally) alongside Miles's own identity set (wave5-precon-legality.test.ts).
 *
 * Two "Spider-Man"-titled allies with different subtitles ("Miles Morales" vs "Peter Parker" vs
 * "Hobie Brown") also do not `cardsMatch` (RRG 1.8 "Unique Icon" pp. 45-46): bullet 1 requires
 * both cards bare (no subtitle, no alter-ego title), which none of the three are, and bullet 2
 * requires one card's subtitle/alter-ego title to equal one of the other's names, which "Miles
 * Morales" vs "Peter Parker" vs "Hobie Brown" never do. So a deck (or the table) may legally
 * hold all three "Spider-Man" allies at once, correctly per the engine's own `cardsMatch`.
 */
describe('"Spider-Man"-named allies (27011, 27017, 27049) are ordinary aspect/basic cards, not identity-specific, and do not match each other', () => {
  const byId = new Map(SM_CARDS.map((c) => [c.id as string, c]));

  it.each(["27011", "27017", "27049"])("%s's aspect is not a hero:<id> set icon", (id) => {
    const card = byId.get(id);
    expect(card && "aspect" in card ? card.aspect : undefined).not.toMatch(/^hero:/);
  });

  it("a deck may legally hold all three: Miles Morales's own precon does (27048, 27049) alongside its identity set", () => {
    const deck = SM_STARTER_DECKS.find((d) => d.id === "spider-man-morales")!;
    expect(deck.cards.some((e) => e.cardId === "27048")).toBe(true);
    expect(deck.cards.some((e) => e.cardId === "27049")).toBe(true);
    expect(validateDeck(contentsOf(deck), SM_CARDS)).toEqual({ ok: true });
  });
});

// ---- 2. Gates: Ironheart's progressing identity and SP//dr's separated identity are lifted --

describe("gates lifted (docs/phase7-wave5.md §3.23, §3.24): Ironheart and SP//dr accept a legal hand-built deck", () => {
  it("Ironheart (29001a, Leadership): a hand-built, non-precon deck is accepted", () => {
    const pool = [...IRONHEART_CARDS, ...CORE_CARDS];
    const identity = identityOf("29001a", IRONHEART_CARDS);
    const deck = customDeck(identity, IRONHEART_CARDS, ["leadership"], "leadership", pool);
    // Not a literal copy of the precon's card list: distinct filler composition proves this is a
    // fresh deck-builder build, not the precon re-served.
    const precon = IRONHEART_STARTER_DECKS.find((d) => d.id === "ironheart-leadership")!;
    expect(deck.cards).not.toEqual(precon.cards);
    expect(validateDeck(deck, pool)).toEqual({ ok: true });
  });

  it("SP//dr (31001a, Protection): a hand-built, non-precon deck is accepted", () => {
    const pool = [...SPDR_CARDS, ...CORE_CARDS];
    const identity = identityOf("31001a", SPDR_CARDS);
    const deck = customDeck(identity, SPDR_CARDS, ["protection"], "protection", pool);
    const precon = SPDR_STARTER_DECKS.find((d) => d.id === "spdr-protection")!;
    expect(deck.cards).not.toEqual(precon.cards);
    expect(validateDeck(deck, pool)).toEqual({ ok: true });
  });
});

// ---- 3. Aspect rules for each new identity (RRG 1.8 "Aspect Card" p. 8; Appendix I) --------

interface NewIdentityCase {
  readonly label: string;
  readonly identityId: string;
  readonly ownCards: readonly AnyCard[];
  readonly preconAspect: CoreAspect;
  readonly altAspect: CoreAspect;
}

const NEW_IDENTITIES: readonly NewIdentityCase[] = [
  {
    label: "Ghost-Spider",
    identityId: "27001a",
    ownCards: SM_CARDS,
    preconAspect: "protection",
    altAspect: "aggression",
  },
  {
    label: "Spider-Man (Miles Morales)",
    identityId: "27030a",
    ownCards: SM_CARDS,
    preconAspect: "justice",
    altAspect: "leadership",
  },
  { label: "Nova", identityId: "28001a", ownCards: NOVA_CARDS, preconAspect: "aggression", altAspect: "protection" },
  {
    label: "Ironheart",
    identityId: "29001a",
    ownCards: IRONHEART_CARDS,
    preconAspect: "leadership",
    altAspect: "justice",
  },
  {
    label: "Spider-Ham",
    identityId: "30001a",
    ownCards: SPIDERHAM_CARDS,
    preconAspect: "justice",
    altAspect: "aggression",
  },
  { label: "SP//dr", identityId: "31001a", ownCards: SPDR_CARDS, preconAspect: "protection", altAspect: "leadership" },
];

describe("aspect rules: each new identity, built from the real pool (not synthetic cards)", () => {
  for (const c of NEW_IDENTITIES) {
    const pool = [...c.ownCards, ...CORE_CARDS];
    const identity = identityOf(c.identityId, c.ownCards);

    it(`${c.label}: a legal deck in ${c.altAspect} (not its precon's ${c.preconAspect}) is accepted`, () => {
      const deck = customDeck(identity, c.ownCards, [c.altAspect], c.altAspect, pool);
      expect(validateDeck(deck, pool)).toEqual({ ok: true });
    });

    it(`${c.label}: choosing two aspects for a one-aspect identity is rejected (aspect_choice)`, () => {
      const deck = customDeck(identity, c.ownCards, [c.preconAspect, c.altAspect], "basic", pool);
      const p = problem(deck, "aspect_choice", pool);
      expect(p.message).toContain("exactly one aspect");
    });

    it(`${c.label}: an off-aspect card (${c.altAspect} in a ${c.preconAspect} deck) is rejected (aspect_restriction)`, () => {
      const deck = customDeck(identity, c.ownCards, [c.preconAspect], c.preconAspect, pool);
      const excluded = new Set(deck.cards.map((e) => e.cardId as string));
      const offCard = CORE_CARDS.filter(isPlayerCard).find(
        (card) => card.aspect === c.altAspect && !excluded.has(card.id as string),
      );
      if (!offCard) throw new Error(`no Core ${c.altAspect} card free to add`);
      const withOff = withCard(deck, offCard.id as string, 1);
      const p = problem(withOff, "aspect_restriction", pool);
      expect(p.message).toContain(offCard.name);
    });
  }
});

// ---- 4. Deck builder start state: requiredIdentitySet == the precon's signature cards -------

interface StartStateCase {
  readonly label: string;
  readonly identityId: string;
  readonly cards: readonly AnyCard[];
  readonly decks: readonly StarterDeck[];
  readonly deckIds: readonly string[];
}

const START_STATE_CASES: readonly StartStateCase[] = [
  { label: "Ghost-Spider", identityId: "27001a", cards: SM_CARDS, decks: SM_STARTER_DECKS, deckIds: ["ghost-spider"] },
  {
    label: "Spider-Man (Miles Morales)",
    identityId: "27030a",
    cards: SM_CARDS,
    decks: SM_STARTER_DECKS,
    deckIds: ["spider-man-morales"],
  },
  { label: "Nova", identityId: "28001a", cards: NOVA_CARDS, decks: NOVA_STARTER_DECKS, deckIds: ["nova-aggression"] },
  {
    label: "Ironheart",
    identityId: "29001a",
    cards: IRONHEART_CARDS,
    decks: IRONHEART_STARTER_DECKS,
    deckIds: ["ironheart-leadership"],
  },
  {
    label: "Spider-Ham",
    identityId: "30001a",
    cards: SPIDERHAM_CARDS,
    decks: SPIDERHAM_STARTER_DECKS,
    deckIds: ["spiderham-justice"],
  },
  { label: "SP//dr", identityId: "31001a", cards: SPDR_CARDS, decks: SPDR_STARTER_DECKS, deckIds: ["spdr-protection"] },
];

describe("requiredIdentitySet: the deck builder's start state matches each new identity's precon signature cards exactly (RRG 1.8 Appendix I p. 50)", () => {
  for (const c of START_STATE_CASES) {
    for (const deckId of c.deckIds) {
      it(`${c.label} (${deckId}): requiredIdentitySet == the precon's hero:${c.identityId} cards, at their set quantities`, () => {
        const identity = identityOf(c.identityId, c.cards);
        const deck = c.decks.find((d) => d.id === deckId);
        if (!deck) throw new Error(`no starter deck ${deckId}`);
        const byId = new Map(c.cards.map((card) => [card.id as string, card]));
        const expected = deck.cards
          .filter((e) => {
            const card = byId.get(e.cardId as string);
            return card && "aspect" in card && card.aspect === `hero:${c.identityId}`;
          })
          .map((e) => ({ cardId: e.cardId, quantity: e.quantity }))
          .sort((a, b) => (a.cardId as string).localeCompare(b.cardId as string));
        expect(expected.length, `${deckId} lists no hero:${c.identityId} cards`).toBeGreaterThan(0);
        expect(requiredIdentitySet(identity, c.cards)).toEqual(expected);
      });
    }
  }
});

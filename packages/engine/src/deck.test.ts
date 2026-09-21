import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  abilityId,
  cardId,
  trait,
  type AnyCard,
  type Aspect,
  type CoreAspect,
  type DeckContents,
  type HeroIdentityCard,
  type IdentityDeckbuilding,
  type IdentitySeparateDeck,
  type KeywordInstance,
  type PlayerCard,
} from "@mc/content";
import * as coreContent from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "./abilities.js";
import { DEFAULT_DEPS } from "./abilities.js";
import {
  abilityRefsOf,
  requiredIdentitySet,
  unscriptedCards,
  validateDeck,
  type DeckProblem,
  type DeckProblemCode,
} from "./deck.js";

describe("requiredIdentitySet: what a new deck starts from", () => {
  it("is exactly the identity-set cards each Core starter deck lists, at their set quantities", () => {
    const { CORE_CARDS, CORE_STARTER_DECKS } = coreContent;
    for (const starter of CORE_STARTER_DECKS) {
      const identity = CORE_CARDS.find((card) => card.id === starter.identityCardId);
      if (identity?.type !== "hero_identity") throw new Error(`no hero identity for ${starter.id as string}`);
      const signature = starter.cards
        .filter(
          ({ cardId }) =>
            (CORE_CARDS.find((card) => card.id === cardId) as { aspect?: string } | undefined)?.aspect ===
            `hero:${identity.id as string}`,
        )
        .map(({ cardId, quantity }) => ({ cardId, quantity }))
        .sort((a, b) => (a.cardId as string).localeCompare(b.cardId as string));
      expect(signature.length, `${starter.id as string} lists no signature cards`).toBeGreaterThan(0);
      expect(requiredIdentitySet(identity, CORE_CARDS)).toEqual(signature);
    }
  });
});

// ---- Helpers over real Core data ---------------------------------------------------------

const SPIDER_MAN_DECK = "core-spider-man-justice";
const SPIDER_MAN = "01001a";

const byId = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id, card]));
const mustCard = (id: string): AnyCard => {
  const card = byId.get(id);
  if (!card) throw new Error(`no Core card ${id}`);
  return card;
};
const isPlayer = (card: AnyCard): card is PlayerCard => "deckLimit" in card;
const coreWhere = (predicate: (card: PlayerCard) => boolean): PlayerCard => {
  const found = CORE_CARDS.find((card): card is PlayerCard => isPlayer(card) && predicate(card));
  if (!found) throw new Error("no Core card matches");
  return found;
};
const spiderMan = (): HeroIdentityCard => {
  const card = mustCard(SPIDER_MAN);
  if (card.type !== "hero_identity") throw new Error("01001a is not an identity");
  return card;
};

const starter = (id = SPIDER_MAN_DECK): DeckContents => {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === id);
  if (!deck) throw new Error(`no starter deck ${id}`);
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};
/** Sets `id` to exactly `quantity` copies (adding the line if absent). */
const withCard = (deck: DeckContents, id: string, quantity: number): DeckContents => ({
  ...deck,
  cards: [...deck.cards.filter((e) => e.cardId !== id), { cardId: cardId(id), quantity }],
});
const without = (deck: DeckContents, id: string): DeckContents => ({
  ...deck,
  cards: deck.cards.filter((e) => e.cardId !== id),
});

const problemsOf = (deck: DeckContents, pool: readonly AnyCard[] = CORE_CARDS): readonly DeckProblem[] => {
  const verdict = validateDeck(deck, pool);
  return verdict.ok ? [] : verdict.problems;
};
const codesOf = (deck: DeckContents, pool?: readonly AnyCard[]): readonly DeckProblemCode[] =>
  problemsOf(deck, pool).map((p) => p.code);
/** The first problem with `code`, failing with the full problem list if there is none. */
const problem = (deck: DeckContents, code: DeckProblemCode, pool?: readonly AnyCard[]): DeckProblem => {
  const all = problemsOf(deck, pool);
  const found = all.find((p) => p.code === code);
  if (!found) throw new Error(`expected ${code}, got ${JSON.stringify(all, null, 2)}`);
  return found;
};

/** A synthetic player card: a copy of a Core card with overrides, for rules no Core card exercises. */
const synthetic = (
  from: PlayerCard,
  overrides: Partial<Omit<PlayerCard, "type" | "aspect">> & { readonly aspect?: Aspect | "campaign" },
): PlayerCard => ({ ...from, ...overrides }) as PlayerCard;
const basicEvent = coreWhere((c) => c.aspect === "basic" && c.type === "event" && !c.unique && c.deckLimit === 3);

/** A pool with Spider-Man's identity replaced by a copy carrying `deckbuilding` (same id, so his set still belongs to him). */
const spiderManWith = (deckbuilding: IdentityDeckbuilding): readonly AnyCard[] =>
  CORE_CARDS.map((card) => (card.id === SPIDER_MAN ? { ...spiderMan(), deckbuilding } : card));

/**
 * A Spider-Man deck built from his identity set plus `picks` cards per classification, each
 * title at its maximum copies (Core id order), so tests can shape aspect counts exactly.
 */
function spiderManBuilt(aspects: readonly CoreAspect[], picks: Partial<Record<CoreAspect, number>>): DeckContents {
  const cards = CORE_CARDS.filter(isPlayer)
    .filter((c) => c.aspect === `hero:${SPIDER_MAN}`)
    .map((c) => ({ cardId: c.id, quantity: c.quantityInSet }));
  for (const [aspect, wanted] of Object.entries(picks)) {
    let remaining = wanted ?? 0;
    for (const card of CORE_CARDS.filter(isPlayer).filter((c) => c.aspect === aspect)) {
      if (remaining === 0) break;
      const take = Math.min(remaining, card.unique ? 1 : Math.min(3, card.deckLimit));
      cards.push({ cardId: card.id, quantity: take });
      remaining -= take;
    }
    if (remaining > 0) throw new Error(`not enough ${aspect} cards in Core`);
  }
  return { identityCardId: cardId(SPIDER_MAN), aspects, cards };
}

// ---- Tests ---------------------------------------------------------------------------------

describe("validateDeck: the Core starter decks", () => {
  it.each(CORE_STARTER_DECKS.map((d) => [d.id]))("%s is legal", (id) => {
    expect(problemsOf(starter(id))).toEqual([]);
    expect(validateDeck(starter(id), CORE_CARDS)).toEqual({ ok: true });
  });

  it("accepts the pool keyed by id as well as a card list", () => {
    const keyed = Object.fromEntries(CORE_CARDS.map((c) => [c.id, c]));
    expect(validateDeck(starter(), keyed)).toEqual({ ok: true });
  });
});

describe("validateDeck: each problem code, from real Core data", () => {
  it("unknown_card: a card code that is not in the pool", () => {
    const p = problem(withCard(starter(), "99999", 1), "unknown_card");
    expect(p.message).toContain("99999");
    expect(p.cardIds).toEqual(["99999"]);
  });

  it("unknown_card: an identity code that is not in the pool", () => {
    const p = problem({ ...starter(), identityCardId: cardId("99999a") }, "unknown_card");
    expect(p.message).toContain("99999a");
  });

  it("not_an_identity: the chosen identity is an ally", () => {
    const p = problem({ ...starter(), identityCardId: cardId("01002") }, "not_an_identity");
    expect(p.message).toContain("Black Cat");
    expect(p.cardIds).toEqual(["01002"]);
  });

  it("identity_in_deck: an identity card in the card list", () => {
    expect(problem(withCard(starter(), "01010a", 1), "identity_in_deck").message).toContain("Captain Marvel");
  });

  it("not_a_player_card: the hero's own obligation, and a minion", () => {
    const obligation = mustCard(spiderMan().obligationCardId);
    const p = problem(withCard(starter(), obligation.id, 1), "not_a_player_card");
    expect(p.message).toContain(obligation.name);
    const minion = CORE_CARDS.find((c) => c.type === "minion");
    if (!minion) throw new Error("no Core minion");
    expect(problem(withCard(starter(), minion.id, 1), "not_a_player_card").message).toContain(minion.name);
  });

  it("deck_size: 38 cards", () => {
    const card = mustCard("01060");
    expect(isPlayer(card) && card.aspect).toBe("justice");
    const p = problem(without(starter(), "01060"), "deck_size");
    expect(p.message).toContain("38");
    expect(p.cardIds).toEqual([]);
  });

  it("deck_size: 51 cards", () => {
    const deck = spiderManBuilt(["justice"], { justice: 19, basic: 17 });
    expect(problem(deck, "deck_size").message).toContain("51");
  });

  it("aspect_restriction: an Aggression card in a Justice deck", () => {
    const aggression = coreWhere((c) => c.aspect === "aggression" && !c.unique && c.type === "event");
    const p = problem(withCard(starter(), aggression.id, 1), "aspect_restriction");
    expect(p.message).toContain(aggression.name);
    expect(p.message).toContain("Aggression");
    expect(p.cardIds).toEqual([aggression.id]);
  });

  it("other_identity_card: Captain Marvel's Helmet in a Spider-Man deck", () => {
    const p = problem(withCard(starter(), "01016", 1), "other_identity_card");
    expect(p.message).toContain("Captain Marvel's Helmet");
    expect(p.message).toContain("Captain Marvel (Carol Danvers)");
  });

  it("identity_set_mismatch: a signature card left out", () => {
    const p = problem(without(starter(), "01002"), "identity_set_mismatch");
    expect(p.message).toContain("Black Cat");
    expect(p.message).toContain("Spider-Man (Peter Parker)");
    expect(p.cardIds).toEqual(["01002"]);
  });

  it("identity_set_mismatch: a signature card at the wrong quantity", () => {
    const card = mustCard("01005");
    expect(card.quantityInSet).toBe(3);
    const p = problem(withCard(starter(), "01005", 2), "identity_set_mismatch");
    expect(p.message).toContain(card.name);
    expect(p.message).toContain("exactly 3 copies");
  });

  it("copy_limit: a fourth copy of a non-unique card", () => {
    const p = problem(withCard(starter(), "01060", 4), "copy_limit");
    expect(p.message).toContain(mustCard("01060").name);
    expect(p.message).toContain("no more than 3");
  });

  it('copy_limit: a second copy of a "Max 1 per deck" card', () => {
    const maxOne = coreWhere((c) => c.aspect === "basic" && !c.unique && c.deckLimit === 1);
    const p = problem(withCard(starter(), maxOne.id, 2), "copy_limit");
    expect(p.message).toContain(maxOne.name);
    expect(p.message).toContain("no more than 1 copy");
  });

  it("identity-set cards are held to their exact set quantity, not the three-copy rule (Black Panther's 5 Wakanda Forever!)", () => {
    const wakanda = CORE_CARDS.filter(isPlayer).filter(
      (c) => c.aspect === "hero:01040a" && c.name === "Wakanda Forever!",
    );
    expect(wakanda.reduce((n, c) => n + c.quantityInSet, 0)).toBe(5);
    expect(problemsOf(starter("core-black-panther-protection"))).toEqual([]);
    const fourCopies = without(starter("core-black-panther-protection"), "01043a");
    expect(codesOf(fourCopies)).toContain("identity_set_mismatch");
    expect(codesOf(fourCopies)).not.toContain("copy_limit");
  });

  it("copies are counted by title and subtitle (RRG 1.8 'Copy')", () => {
    const a = synthetic(basicEvent, { id: cardId("x-sub-a"), name: "Same Title", subtitle: "One" });
    const b = synthetic(basicEvent, { id: cardId("x-sub-b"), name: "Same Title", subtitle: "Two" });
    const deck = withCard(withCard(starter(), "x-sub-a", 3), "x-sub-b", 3);
    expect(codesOf(deck, [...CORE_CARDS, a, b])).not.toContain("copy_limit");
  });

  it("copy_limit counts by title across different card codes", () => {
    const twin = synthetic(basicEvent, { id: cardId("x-twin") });
    const deck = withCard(withCard(starter(), basicEvent.id, 2), "x-twin", 2);
    const p = problem(deck, "copy_limit", [...CORE_CARDS, twin]);
    expect(p.message).toContain(`${basicEvent.name} has 4 copies`);
    expect(p.cardIds).toEqual(expect.arrayContaining([basicEvent.id, "x-twin"]));
  });

  it("unique_match: two copies of a unique ally", () => {
    const p = problem(withCard(starter(), "01083", 2), "unique_match");
    expect(p.message).toContain("Mockingbird");
  });

  it("unique_match: a unique card matching the identity (the identity counts)", () => {
    const peter = synthetic(
      coreWhere((c) => c.id === "01083"),
      { id: cardId("x-peter"), name: "Peter Parker" },
    );
    const { subtitle: _subtitle, ...bare } = peter;
    const p = problem(withCard(starter(), "x-peter", 1), "unique_match", [...CORE_CARDS, bare as PlayerCard]);
    expect(p.message).toContain("Peter Parker");
    expect(p.message).toContain("Spider-Man (Peter Parker)");
    expect(p.cardIds).toEqual([SPIDER_MAN, "x-peter"]);
  });

  it("invalid_quantity and duplicate_entry: a malformed decklist", () => {
    const name = mustCard("01060").name;
    expect(problem(withCard(starter(), "01060", 0), "invalid_quantity").message).toContain(name);
    expect(problem(withCard(starter(), "01060", 1.5), "invalid_quantity").message).toContain(name);
    const doubled = { ...starter(), cards: [...starter().cards, { cardId: cardId("01060"), quantity: 1 }] };
    expect(problem(doubled, "duplicate_entry").message).toContain(name);
  });

  it("aspect_choice: none, Basic, the same aspect twice, or two for a one-aspect hero", () => {
    expect(problem({ ...starter(), aspects: [] }, "aspect_choice").message).toContain("exactly one aspect");
    expect(problem({ ...starter(), aspects: ["basic"] }, "aspect_choice").message).toContain("Basic is not an aspect");
    expect(problem({ ...starter(), aspects: ["justice", "justice"] }, "aspect_choice").message).toContain(
      "more than once",
    );
    expect(problem({ ...starter(), aspects: ["justice", "aggression"] }, "aspect_choice").message).toContain(
      "Justice and Aggression",
    );
  });

  it("an illegal aspect choice is not echoed as an aspect_restriction on every aspect card", () => {
    expect(codesOf({ ...starter(), aspects: [] })).toEqual(["aspect_choice"]);
  });

  it("'Pool is a choosable aspect (RRG 1.8 'Aspect Card')", () => {
    const pool = synthetic(basicEvent, { id: cardId("x-pool"), name: "Pool Party", aspect: "pool" });
    const deck = { ...withCard(spiderManBuilt(["pool"], { basic: 22 }), "x-pool", 3) };
    expect(problemsOf(deck, [...CORE_CARDS, pool])).toEqual([]);
  });
});

describe("validateDeck: synthetic cards for rules no Core card exercises", () => {
  it("linked_card: a linked card cannot be in a deck, and is not a required part of its identity set", () => {
    const linked: KeywordInstance = { name: "linked", cardTitle: "Some Card" };
    const gadget = synthetic(basicEvent, { id: cardId("x-linked"), name: "Linked Gadget", keywords: [linked] });
    const p = problem(withCard(starter(), "x-linked", 1), "linked_card", [...CORE_CARDS, gadget]);
    expect(p.message).toContain("Linked Gadget");
    const signatureLinked = synthetic(basicEvent, {
      id: cardId("x-sig-linked"),
      aspect: `hero:${SPIDER_MAN}`,
      keywords: [linked],
    });
    expect(problemsOf(starter(), [...CORE_CARDS, signatureLinked])).toEqual([]);
  });

  it("permanent cards do not count toward deck size", () => {
    const permanent = synthetic(basicEvent, {
      id: cardId("x-permanent"),
      name: "Permanent Thing",
      keywords: [{ name: "permanent" }],
    });
    const pool = [...CORE_CARDS, permanent];
    expect(problemsOf(withCard(starter(), "x-permanent", 1), pool)).toEqual([]);
    expect(problem(withCard(without(starter(), "01083"), "x-permanent", 1), "deck_size", pool).message).toContain("39");
  });

  it("missing_card_data: no valid deck limit, and a Team-Up with no names", () => {
    const bad = synthetic(basicEvent, { id: cardId("x-bad"), name: "Bad Data", deckLimit: 0 });
    expect(problem(withCard(starter(), "x-bad", 1), "missing_card_data", [...CORE_CARDS, bad]).message).toContain(
      "Bad Data",
    );
    const nameless = synthetic(basicEvent, {
      id: cardId("x-teamup"),
      name: "Nameless Team-Up",
      keywords: [{ name: "teamUp" }],
    });
    expect(
      problem(withCard(starter(), "x-teamup", 1), "missing_card_data", [...CORE_CARDS, nameless]).message,
    ).toContain("Nameless Team-Up");
  });

  it("team_up_identity: a Team-Up card for other heroes; accepted when the identity is named", () => {
    const antWasp = synthetic(basicEvent, {
      id: cardId("x-antwasp"),
      name: "Team Effort",
      keywords: [{ name: "teamUp", names: ["Ant-Man", "Wasp"] }],
    });
    const p = problem(withCard(starter(), "x-antwasp", 1), "team_up_identity", [...CORE_CARDS, antWasp]);
    expect(p.message).toContain("Team Effort");
    expect(p.message).toContain("Ant-Man and Wasp");
    const withPeter = synthetic(basicEvent, {
      id: cardId("x-peterwasp"),
      name: "Web Effort",
      keywords: [{ name: "teamUp", names: ["Peter Parker", "Wasp"] }],
    });
    expect(problemsOf(withCard(starter(), "x-peterwasp", 1), [...CORE_CARDS, withPeter])).toEqual([]);
  });

  it("unrecognized_classification: e.g. a campaign-specific card", () => {
    const campaign = synthetic(basicEvent, { id: cardId("x-campaign"), name: "Campaign Reward", aspect: "campaign" });
    const p = problem(withCard(starter(), "x-campaign", 1), "unrecognized_classification", [...CORE_CARDS, campaign]);
    expect(p.message).toContain("Campaign Reward");
  });
});

describe("validateDeck: identity deckbuilding requirements are data, not card names", () => {
  it("unsupported_deckbuilding_requirement: an unmodeled requirement blocks the deck and quotes it", () => {
    const pool = spiderManWith({ unmodeled: ["Your deck must include something unusual."] });
    const p = problem(starter(), "unsupported_deckbuilding_requirement", pool);
    expect(p.message).toContain("Spider-Man (Peter Parker)");
    expect(p.message).toContain("something unusual");
  });

  it("aspectCount: two aspects are required, and one is refused", () => {
    const pool = spiderManWith({ aspectCount: 2 });
    expect(problem(starter(), "aspect_choice", pool).message).toContain("exactly 2 different aspects");
    expect(
      problemsOf(spiderManBuilt(["justice", "aggression"], { justice: 7, aggression: 7, basic: 11 }), pool),
    ).toEqual([]);
  });

  it("equalCardsPerAspect (FAQ Jessica Drew): 7 and 7 is legal, 8 and 6 is not", () => {
    const pool = spiderManWith({ aspectCount: 2, equalCardsPerAspect: true });
    expect(
      problemsOf(spiderManBuilt(["justice", "aggression"], { justice: 7, aggression: 7, basic: 11 }), pool),
    ).toEqual([]);
    const p = problem(
      spiderManBuilt(["justice", "aggression"], { justice: 8, aggression: 6, basic: 11 }),
      "deckbuilding_requirement",
      pool,
    );
    expect(p.message).toContain("8 Justice and 6 Aggression");
  });

  it("offAspectPackages (FAQ Maria Hill): all of exactly N titles, or none", () => {
    const support = coreWhere(
      (c) =>
        c.type === "support" &&
        (c.aspect === "aggression" || c.aspect === "leadership" || c.aspect === "protection") &&
        c.traits.length > 0,
    );
    const packageTrait = support.traits[0] ?? trait("?");
    const max = support.unique ? 1 : Math.min(3, support.deckLimit);
    const deck = withCard(starter(), support.id, max);

    // Without the requirement it is simply off-aspect.
    expect(problem(deck, "aspect_restriction").message).toContain(support.name);
    // With a one-title package at maximum copies it is legal; none at all is also legal.
    const one = spiderManWith({ offAspectPackages: [{ cardType: "support", trait: packageTrait, titles: 1 }] });
    expect(problemsOf(deck, one)).toEqual([]);
    expect(problemsOf(starter(), one)).toEqual([]);
    // With a two-title package, one title is not enough.
    const two = spiderManWith({ offAspectPackages: [{ cardType: "support", trait: packageTrait, titles: 2 }] });
    const p = problem(deck, "deckbuilding_requirement", two);
    expect(p.message).toContain("exactly 2 different titles");
    expect(p.cardIds).toEqual([support.id]);
  });
});

describe("unscriptedCards: playability, separate from legality", () => {
  const everyRef: AbilityRegistry = Object.fromEntries(
    CORE_CARDS.flatMap(abilityRefsOf).map((ref) => [ref.id, {} as AbilityDefinition]),
  );

  it("is empty when every ability the deck and its identity sets reference is registered", () => {
    expect(unscriptedCards(starter(), CORE_CARDS, { abilities: everyRef })).toEqual([]);
  });

  it("names the identity, deck cards, and the identity's obligation when nothing is registered", () => {
    const missing = unscriptedCards(starter(), CORE_CARDS, DEFAULT_DEPS);
    expect(missing[0]).toBe(SPIDER_MAN);
    expect(missing).toContain("01002");
    expect(missing).toContain(spiderMan().obligationCardId);
    expect(new Set(missing).size).toBe(missing.length);
  });

  it("skips card codes that are not in the pool (validateDeck reports those)", () => {
    expect(unscriptedCards(withCard(starter(), "99999", 1), CORE_CARDS, { abilities: everyRef })).toEqual([]);
  });
});

/**
 * RRG 1.8 "Deck" (p. 15): "Certain identities or scenarios may add other decks to the game." The Doctor Strange Hero
 * Pack insert: a "five-card 'INVOCATION deck' in addition to his player deck", built by shuffling all five Invocation
 * cards. No Core identity has one, so Spider-Man stands in with two synthetic spells.
 */
describe("validateDeck: an identity's separate deck (the Invocation deck)", () => {
  const INVOCATION = "Invocation";
  const spell = (id: string, name: string): PlayerCard =>
    synthetic(basicEvent, {
      id: cardId(id),
      name,
      aspect: `hero:${SPIDER_MAN}`,
      traits: [trait("Invocation")],
      quantityInSet: 1,
      deckLimit: 0,
      separateDeck: INVOCATION,
      abilities: [{ id: abilityId(`${id}.special`) }],
    });
  const spells = [spell("x-inv-1", "First Spell"), spell("x-inv-2", "Second Spell")];
  const invocationDeck = (cardIds: readonly string[]): IdentitySeparateDeck => ({
    name: INVOCATION,
    cards: cardIds.map((id) => ({ cardId: cardId(id), quantity: 1 })),
    topCardFaceup: true,
    discardPile: "own",
    whenEmpty: "reshuffleDiscardWithoutPenalty",
  });
  const poolWith = (deck: IdentitySeparateDeck): readonly AnyCard[] => [
    ...CORE_CARDS.map((card) => (card.id === SPIDER_MAN ? { ...spiderMan(), separateDecks: [deck] } : card)),
    ...spells,
  ];
  const pool = poolWith(invocationDeck(["x-inv-1", "x-inv-2"]));

  it("its cards are not part of the identity set a deck must include, so the precon stays legal", () => {
    expect(problemsOf(starter(), pool)).toEqual([]);
  });

  it("separate_deck_card: listing one is refused, and it does not count toward deck size", () => {
    const deck = withCard(without(starter(), "01083"), "x-inv-1", 1);
    const p = problem(deck, "separate_deck_card", pool);
    expect(p.message).toContain("First Spell");
    expect(p.message).toContain("Spider-Man (Peter Parker)'s Invocation deck");
    expect(p.cardIds).toEqual(["x-inv-1"]);
    expect(problem(deck, "deck_size", pool).message).toContain("39");
    expect(codesOf(deck, pool)).not.toContain("identity_set_mismatch");
  });

  it("missing_card_data: the identity names a card the pool lacks, or one not marked for that deck", () => {
    const absent = problem(starter(), "missing_card_data", poolWith(invocationDeck(["x-inv-1", "x-inv-gone"])));
    expect(absent.message).toContain("x-inv-gone");
    const unmarked = problem(starter(), "missing_card_data", poolWith(invocationDeck(["x-inv-1", basicEvent.id])));
    expect(unmarked.message).toContain(basicEvent.name);
    expect(unmarked.message).toContain("does not mark it");
  });

  it("unscriptedCards names separate-deck cards whose abilities are not registered, since setup brings them in", () => {
    const everyCoreRef: AbilityRegistry = Object.fromEntries(
      CORE_CARDS.flatMap(abilityRefsOf).map((ref) => [ref.id, {} as AbilityDefinition]),
    );
    expect(unscriptedCards(starter(), pool, { abilities: everyCoreRef })).toEqual(["x-inv-1", "x-inv-2"]);
    const withSpells: AbilityRegistry = {
      ...everyCoreRef,
      "x-inv-1.special": {} as AbilityDefinition,
      "x-inv-2.special": {} as AbilityDefinition,
    };
    expect(unscriptedCards(starter(), pool, { abilities: withSpells })).toEqual([]);
  });
});

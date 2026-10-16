/**
 * Appendix I's Team-Up replacement, RRG v1.8 p.50 ("Deck customization"): "If a player's deck includes an
 * identity-specific card that is considered to 'match' (according to the rules for uniqueness; see Unique Icon) an
 * identity chosen by another player during setup, that player may replace the matching card in their deck with a card
 * with the Team-Up keyword that names both their own identity and the other player's identity."
 *
 * Real data: Quicksilver's identity set holds the Scarlet Witch ally (14002), which matches the Scarlet Witch identity
 * (15001a); Order and Chaos (14018) is Team-Up (Quicksilver and Scarlet Witch).
 */
import { WAVE2_CARDS, WAVE2_STARTER_DECKS, cardId, type CardId, type DeckContents, type PlayerCard } from "@mc/content";
import { cardLegalForIdentity, validateDeck } from "./deck.js";
import { illegalDecksOf } from "./setup.js";

const QUICKSILVER = "14001a";
const SCARLET_WITCH = "15001a";
const SPIDER_MAN = "01001a";
const SCARLET_WITCH_ALLY = "14002";
const ORDER_AND_CHAOS = "14018";

const starterOf = (identity: string): DeckContents => {
  const starter = WAVE2_STARTER_DECKS.find((deck) => (deck.identityCardId as string) === identity);
  if (!starter) throw new Error(`no starter deck for ${identity}`);
  return { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards };
};

const quicksilverIdentity = WAVE2_CARDS.find((card) => (card.id as string) === QUICKSILVER);
if (quicksilverIdentity?.type !== "hero_identity") throw new Error("no Quicksilver identity");

/** Basic, non-unique, non-Team-Up cards legal for Quicksilver that the starter does not hold: deck-size fillers. */
const fillers = (deck: DeckContents): readonly CardId[] =>
  WAVE2_CARDS.filter(
    (card) =>
      "aspect" in card &&
      card.aspect === "basic" &&
      !card.unique &&
      !(card as PlayerCard).keywords.some((k) => k.name === "teamUp" || k.name === "permanent") &&
      cardLegalForIdentity(card, quicksilverIdentity) &&
      !deck.cards.some((entry) => entry.cardId === card.id),
  ).map((card) => card.id);

const without = (deck: DeckContents, ...ids: string[]): DeckContents => ({
  ...deck,
  cards: deck.cards.filter((entry) => !ids.includes(entry.cardId as string)),
});
const plus = (deck: DeckContents, ...ids: CardId[]): DeckContents => ({
  ...deck,
  cards: [...deck.cards, ...ids.map((id) => ({ cardId: id, quantity: 1 }))],
});

const STARTER = starterOf(QUICKSILVER);
const [FILLER_A, FILLER_B] = fillers(STARTER);
if (!FILLER_A || !FILLER_B) throw new Error("no filler cards");
/** The starter with the Scarlet Witch ally replaced: Order and Chaos stands in for it, a filler keeps it at 40 cards. */
const REPLACED = plus(without(STARTER, SCARLET_WITCH_ALLY), FILLER_A);

const problemsOf = (verdict: ReturnType<typeof validateDeck>) => (verdict.ok ? [] : verdict.problems);
const codes = (deck: DeckContents, context?: Parameters<typeof validateDeck>[2]) =>
  problemsOf(validateDeck(deck, WAVE2_CARDS, context)).map((p) => p.code);

describe("Team-Up replacement (RRG v1.8 p.50, Appendix I)", () => {
  it("the Quicksilver starter is legal as printed, with or without Scarlet Witch seated", () => {
    expect(codes(STARTER)).toEqual([]);
    expect(codes(STARTER, { otherSeatIdentityIds: [SCARLET_WITCH] })).toEqual([]);
  });

  it("legal: the Scarlet Witch ally replaced by Order and Chaos when Scarlet Witch is seated", () => {
    expect(codes(REPLACED, { otherSeatIdentityIds: [SCARLET_WITCH] })).toEqual([]);
    expect(codes(REPLACED, { otherSeatIdentityIds: [SPIDER_MAN, SCARLET_WITCH] })).toEqual([]);
  });

  it("illegal: no table known, or the matching identity is not seated", () => {
    expect(codes(REPLACED)).toEqual(["identity_set_mismatch"]);
    expect(codes(REPLACED, { otherSeatIdentityIds: [SPIDER_MAN] })).toEqual(["identity_set_mismatch"]);
    // Quicksilver's own identity is not "another player's".
    expect(codes(REPLACED, { otherSeatIdentityIds: [QUICKSILVER] })).toEqual(["identity_set_mismatch"]);
  });

  it("illegal: no Team-Up card in the deck to stand in for the missing card", () => {
    const noTeamUp = plus(without(STARTER, SCARLET_WITCH_ALLY, ORDER_AND_CHAOS), FILLER_A, FILLER_B);
    expect(codes(noTeamUp, { otherSeatIdentityIds: [SCARLET_WITCH] })).toEqual(["identity_set_mismatch"]);
  });

  it("illegal: a Team-Up card that does not name both Quicksilver and Scarlet Witch", () => {
    const original = WAVE2_CARDS.find((card) => (card.id as string) === ORDER_AND_CHAOS) as PlayerCard;
    const wrongPair: PlayerCard = {
      ...original,
      id: cardId("x-wrong-team-up"),
      name: "Wrong Team-Up",
      keywords: original.keywords.map((k) =>
        k.name === "teamUp" ? { name: "teamUp", names: ["Quicksilver", "Spider-Man"] as const } : k,
      ),
    } as PlayerCard;
    const deck = plus(without(REPLACED, ORDER_AND_CHAOS), wrongPair.id);
    const verdict = validateDeck(deck, [...WAVE2_CARDS, wrongPair], { otherSeatIdentityIds: [SCARLET_WITCH] });
    expect(problemsOf(verdict).map((p) => p.code)).toContain("identity_set_mismatch");
    expect(problemsOf(verdict).find((p) => p.code === "identity_set_mismatch")?.cardIds).toEqual([SCARLET_WITCH_ALLY]);
  });

  it("setup judges each seat against the other seats' identities", () => {
    const expand = (deck: DeckContents): CardId[] =>
      deck.cards.flatMap((entry) => Array.from({ length: entry.quantity }, () => entry.cardId));
    const seat = (deck: DeckContents) => ({
      identityCardId: deck.identityCardId,
      deck: expand(deck),
      aspects: deck.aspects,
    });
    const scarletWitch = starterOf(SCARLET_WITCH);
    expect(codes(scarletWitch)).toEqual([]);
    expect(illegalDecksOf({ players: [seat(REPLACED), seat(scarletWitch)], cards: WAVE2_CARDS })).toEqual([]);
    const alone = illegalDecksOf({ players: [seat(REPLACED)], cards: WAVE2_CARDS });
    expect(alone.map((d) => d.problems.map((p) => p.code))).toEqual([["identity_set_mismatch"]]);
  });
});

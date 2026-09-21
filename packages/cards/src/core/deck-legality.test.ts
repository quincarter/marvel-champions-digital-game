import { CORE_CARDS, CORE_STARTER_DECKS, cardId, type DeckContents, type StarterDeck } from "@mc/content";
import { abilityRefsOf, createGame, unscriptedCards, type AbilityRegistry } from "@mc/engine";
import { CORE_DEPS } from "./index.js";
import { coreScenario, starterDeckSetup } from "./setup.js";

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});
const spiderManDeck = (): StarterDeck => {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === "core-spider-man-justice");
  if (!deck) throw new Error("no Spider-Man starter deck");
  return deck;
};
const registryWithout = (abilityId: string): AbilityRegistry =>
  Object.fromEntries(Object.entries(CORE_DEPS.abilities).filter(([id]) => id !== abilityId));

describe("unscriptedCards with the Core ability registry", () => {
  it.each(CORE_STARTER_DECKS.map((d) => [d.id, d] as const))("%s needs nothing unscripted", (_id, deck) => {
    expect(unscriptedCards(contentsOf(deck), CORE_CARDS, CORE_DEPS)).toEqual([]);
  });

  it("names a deck card whose ability is removed from a copy of the registry", () => {
    const blackCat = CORE_CARDS.find((c) => c.id === "01002");
    const ref = blackCat ? abilityRefsOf(blackCat)[0] : undefined;
    if (!ref) throw new Error("Black Cat has no ability reference");
    expect(unscriptedCards(contentsOf(spiderManDeck()), CORE_CARDS, { abilities: registryWithout(ref.id) })).toEqual([
      cardId("01002"),
    ]);
  });

  it("names the identity's obligation too, since setup brings it into the game", () => {
    const identity = CORE_CARDS.find((c) => c.id === spiderManDeck().identityCardId);
    if (identity?.type !== "hero_identity") throw new Error("no Spider-Man identity");
    const obligation = CORE_CARDS.find((c) => c.id === identity.obligationCardId);
    const ref = obligation ? abilityRefsOf(obligation)[0] : undefined;
    if (!ref) throw new Error("Spider-Man's obligation has no ability reference");
    expect(unscriptedCards(contentsOf(spiderManDeck()), CORE_CARDS, { abilities: registryWithout(ref.id) })).toEqual([
      identity.obligationCardId,
    ]);
  });
});

describe("createGame refuses an illegal deck (coreScenario enforces legality)", () => {
  const spiderMan = starterDeckSetup("core-spider-man-justice");

  it("a custom seat missing a signature card is refused with illegal_deck, naming the card", () => {
    const deck = spiderMan.deck.filter((id) => id !== "01002");
    const result = createGame(
      coreScenario("rhino", { players: [{ identityCardId: "01001a", deck, aspects: ["justice"] }], seed: 1 }),
      CORE_DEPS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("illegal_deck");
    expect(result.error.message).toContain("Black Cat");
    const [seat] = result.error.illegalDecks ?? [];
    expect(seat?.seatIndex).toBe(0);
    expect(seat?.playerId).toBe("p1");
    expect(seat?.problems.map((p) => p.code)).toEqual(expect.arrayContaining(["identity_set_mismatch", "deck_size"]));
  });

  it("names every illegal seat, and only those", () => {
    const result = createGame(
      coreScenario("rhino", {
        players: [
          { starterDeckId: "core-captain-marvel-leadership" },
          { identityCardId: "01001a", deck: [...spiderMan.deck, "01016"], aspects: ["justice"] },
        ],
        seed: 1,
      }),
      CORE_DEPS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.illegalDecks?.map((s) => s.playerId)).toEqual(["p2"]);
    expect(result.error.illegalDecks?.[0]?.problems.map((p) => p.code)).toContain("other_identity_card");
  });

  it("a custom seat that chooses no aspect is refused", () => {
    const result = createGame(
      coreScenario("rhino", { players: [{ identityCardId: "01001a", deck: spiderMan.deck }], seed: 1 }),
      CORE_DEPS,
    );
    expect(!result.ok && result.error.illegalDecks?.[0]?.problems.map((p) => p.code)).toEqual(["aspect_choice"]);
  });

  it("a custom seat with a legal list and its aspect is seated", () => {
    const result = createGame(
      coreScenario("rhino", {
        players: [{ identityCardId: "01001a", deck: spiderMan.deck, aspects: ["justice"] }],
        seed: 1,
      }),
      CORE_DEPS,
    );
    expect(result.ok).toBe(true);
  });
});

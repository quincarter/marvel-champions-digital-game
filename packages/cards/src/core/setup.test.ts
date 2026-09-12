import { CORE_STARTER_DECKS, cardId, type HeroIdentityCard } from "@mc/content";
import { createGame } from "@mc/engine";
import { CORE_DEPS } from "./index.js";
import { coreScenario } from "./setup.js";

/**
 * RRG "Unique": "The players as a group are permitted to have only one copy of each unique
 * card (by title) in play." The identity card is included in that evaluation, so a table
 * cannot seat the same hero twice — not even from two different starter decks.
 */
const identityOf = (starterDeckId: string): string => {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!deck) throw new Error(`no Core starter deck ${starterDeckId}`);
  return deck.identityCardId;
};

const setUp = (starterDeckIds: readonly string[]) =>
  createGame(coreScenario("rhino", { players: starterDeckIds.map((starterDeckId) => ({ starterDeckId })), seed: 99 }), CORE_DEPS);

test("two seats on the same Core starter deck are rejected", () => {
  const result = setUp(["core-captain-marvel-leadership", "core-captain-marvel-leadership"]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("duplicate_unique_card");
    expect(result.error.message).toContain("Captain Marvel (Carol Danvers)");
  }
});

test("two *different* Captain Marvel starter decks are still the same hero, and rejected", () => {
  // Same identity card (01010a) reached by two different decklists — the case a player hit.
  const leadership = "core-captain-marvel-leadership";
  const aggression = "core-captain-marvel-aggression-tutorial";
  expect(identityOf(leadership)).toBe(identityOf(aggression));
  const result = setUp([leadership, aggression]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("duplicate_unique_card");
    expect(result.error.message).toContain("Captain Marvel (Carol Danvers)");
  }
});

test("a four-hero table of distinct heroes is still accepted", () => {
  const result = setUp([
    "core-captain-marvel-leadership",
    "core-iron-man-aggression",
    "core-black-panther-protection",
    "core-spider-man-justice",
  ]);
  expect(result.ok).toBe(true);
});

/** Proves the exception is wired to the alter-ego, not the card id, using real Core data. */
test("a re-titled alter-ego of the same hero may share the table", () => {
  const base = coreScenario("rhino", { players: [{ starterDeckId: "core-captain-marvel-leadership" }], seed: 99 });
  const captainMarvel = base.cards.find((card) => card.id === "01010a");
  if (!captainMarvel || captainMarvel.type !== "hero_identity") throw new Error("no Captain Marvel in the Core pool");
  const otherCarol: HeroIdentityCard = {
    ...captainMarvel,
    id: cardId("01010a-alt"),
    alterEgo: { ...captainMarvel.alterEgo, faceName: "Monica Rambeau" },
  };
  const seat = base.players[0];
  if (!seat) throw new Error("no seat");
  const result = createGame(
    {
      ...base,
      cards: [...base.cards, otherCarol],
      players: [seat, { identityCardId: otherCarol.id, deck: seat.deck }],
    },
    CORE_DEPS,
  );
  expect(result.ok).toBe(true);
});

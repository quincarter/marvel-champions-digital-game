import { describe, expect, it } from "vitest";
import type { DeckOption } from "./deck-list-model.js";
import { deckForSeat, epicTableSessionConfig, EPIC_SCENARIO_ID, missingHeroes } from "./epic-table-config.js";

const option = (id: string, name: string, identity: string, seatable = true): DeckOption =>
  ({
    seatable,
    deck: { id, name, identityCardId: identity, source: { kind: "precon", starterDeckId: `starter-${id}` } },
  }) as unknown as DeckOption;

const DECKS = [
  option("d1", "Spider-Man (Justice) - Core Set starter deck", "01001a"),
  option("d2", "My Spidey deck", "01001a"),
  option("d3", "She-Hulk (Aggression) - Core Set starter deck", "01019a"),
  option("d4", "Broken Iron Man", "01029a", false),
];

describe("a table host's deck for each seat", () => {
  it("prefers the deck the label names, else any seatable deck of that hero", () => {
    expect(deckForSeat("Spider-Man (Justice) - Core Set starter deck|01001a", DECKS)?.deck.id).toBe("d1");
    expect(deckForSeat("Spider-Man|01001a", DECKS)?.deck.id).toBe("d1");
    expect(deckForSeat("My Spidey deck|01001a", DECKS)?.deck.id).toBe("d2");
  });

  it("finds none for a hero it has no seatable deck for, or a seat with no hero", () => {
    expect(deckForSeat("Iron Man|01029a", DECKS)).toBeNull();
    expect(deckForSeat("?", DECKS)).toBeNull();
    expect(missingHeroes(["Iron Man (Aggression) - Core|01029a", "She-Hulk|01019a", "?"], DECKS)).toEqual([
      "Iron Man (Aggression)",
    ]);
  });
});

describe("the table's game", () => {
  it("is the god-of-lies scenario with the table's own difficulty and one player per seat", () => {
    const result = epicTableSessionConfig({
      seats: [{ label: "Spider-Man|01001a" }, { label: "She-Hulk|01019a" }],
      difficulty: "expert",
      decks: DECKS,
      scenario: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.scenarioId).toBe(EPIC_SCENARIO_ID);
    expect(result.config.difficulty).toBe("expert");
    expect(result.config.players).toEqual([{ starterDeckId: "starter-d1" }, { starterDeckId: "starter-d3" }]);
  });

  it("is standard for anything the organizer did not set to expert", () => {
    const result = epicTableSessionConfig({
      seats: [{ label: "Spider-Man|01001a" }],
      difficulty: undefined,
      decks: DECKS,
      scenario: undefined,
    });
    expect(result.ok && result.config.difficulty).toBe("standard");
  });

  it("names the heroes it has no deck for instead of starting", () => {
    expect(
      epicTableSessionConfig({
        seats: [{ label: "Spider-Man|01001a" }, { label: "Iron Man (Aggression)|01029a" }],
        difficulty: "standard",
        decks: DECKS,
        scenario: undefined,
      }),
    ).toEqual({ ok: false, missing: ["Iron Man (Aggression)"] });
  });
});

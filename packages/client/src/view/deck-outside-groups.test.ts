import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import { POOL_CARDS } from "../content/pool-cards.js";
import { outsideDeckGroupsOf } from "./deck-stats.js";

// #960: Deck check lists what the identity brings besides its player deck, none of it counted in the deck.
describe("outsideDeckGroupsOf", () => {
  test("Doctor Strange: the Invocation deck, then his obligation and nemesis set", () => {
    const groups = outsideDeckGroupsOf(cardId("09001a"), POOL_CARDS);
    expect(groups.map((group) => group.label)).toEqual(["Invocation deck", "Obligation", "Nemesis set"]);
    const [invocation, obligation, nemesis] = groups;
    expect(invocation!.entries.map((entry) => entry.cardId).sort()).toEqual([
      "09032",
      "09033",
      "09034",
      "09035",
      "09036",
    ]);
    expect(invocation!.count).toBe(5);
    expect(obligation!.entries.map((entry) => entry.cardId)).toEqual(["09027"]);
    expect(nemesis!.count).toBeGreaterThan(0);
    expect(nemesis!.entries.some((entry) => entry.cardId === "09027")).toBe(false);
  });

  test("Hercules: both the Gift and the Labor decks", () => {
    const labels = outsideDeckGroupsOf(cardId("59001a"), POOL_CARDS).map((group) => group.label);
    expect(labels).toEqual(["Labor deck", "Gift deck", "Obligation", "Nemesis set"]);
  });

  test("a hero with no separate deck still shows its obligation and nemesis set", () => {
    const labels = outsideDeckGroupsOf(cardId("01001a"), POOL_CARDS).map((group) => group.label);
    expect(labels).toEqual(["Obligation", "Nemesis set"]);
  });

  test("an obligation printed twice shows both copies (Scarlet Witch's Slipping Sanity)", () => {
    const scarlet = POOL_CARDS.find(
      (card) => card.type === "hero_identity" && (card.obligationCardId as string) === "15023",
    )!;
    const obligation = outsideDeckGroupsOf(scarlet.id, POOL_CARDS).find((group) => group.key === "obligation")!;
    expect(obligation.count).toBe(2);
    expect(obligation.entries).toEqual([expect.objectContaining({ cardId: "15023", quantity: 2 })]);
  });

  test("an id that is not an identity gives nothing", () => {
    expect(outsideDeckGroupsOf(cardId("no-such-card"), POOL_CARDS)).toEqual([]);
  });
});

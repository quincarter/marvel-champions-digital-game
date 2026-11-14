import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck } from "@mc/content";
import { CORE_DEPS } from "@mc/cards";
import { deckOptionOf } from "./deck-list-model.js";
import { blockedTagOf, deckStatusOf } from "./deck-status.js";

const starter = CORE_STARTER_DECKS[0]!;

describe("deckStatusOf", () => {
  test("a real Core precon reads legal", () => {
    const deck = deckFromStarterDeck(starter, CORE_POOL_VERSION);
    expect(deckStatusOf(deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS))).toEqual({
      text: "Legal",
      tone: "legal",
    });
  });

  test("an illegal deck reads illegal, even if it would also be unscripted or stale", () => {
    const deck = { ...deckFromStarterDeck(starter, "v1-00000000"), cards: [] };
    const status = deckStatusOf(deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS));
    expect(status).toEqual({ text: "Illegal", tone: "illegal" });
  });

  test("a legal deck this build can't script yet reads not-playable", () => {
    const deck = deckFromStarterDeck(starter, CORE_POOL_VERSION);
    const status = deckStatusOf(deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, { abilities: {} }));
    expect(status).toEqual({ text: "Partly playable", tone: "unscripted" });
  });

  test("a legal, playable deck built against an old pool flags the pool change", () => {
    const deck = deckFromStarterDeck(starter, "v1-00000000");
    expect(deckStatusOf(deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS))).toEqual({
      text: "Pool changed",
      tone: "poolChanged",
    });
  });
});

describe("not-ready decks", () => {
  test("the status chip and the seats tag say so", () => {
    const option = {
      checking: false,
      legal: true,
      seatable: false,
      blockedReason: "Not ready yet",
      unscripted: [],
      poolChanged: false,
    } as never;
    expect(deckStatusOf(option).text).toBe("Not ready yet");
    expect(blockedTagOf("Not ready yet")).toBe("NOT READY");
    expect(blockedTagOf("Captain Marvel is already at the table")).toBe("AT THE TABLE");
  });
});

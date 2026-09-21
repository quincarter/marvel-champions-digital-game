import { describe, expect, test } from "vitest";
import { deckFromStarterDeck, type Deck } from "@mc/content";
import { POOL_CARDS, POOL_DEPS, POOL_STARTER_DECKS, POOL_VERSION } from "../content/pool.js";
import { deckOptionOf } from "./deck-list-model.js";
import { cardTitleOf, deckMetaLine, titleCase } from "./deck-title.js";

describe("titleCase", () => {
  test("capitalizes the first letter only", () => {
    expect(titleCase("justice")).toBe("Justice");
    expect(titleCase("")).toBe("");
  });
});

describe("cardTitleOf / deckMetaLine: Decks & Collection and Deck check read a deck with the same words", () => {
  const starter = POOL_STARTER_DECKS[0]!;
  const precon: Deck = deckFromStarterDeck(starter, POOL_VERSION);
  const preconOption = deckOptionOf(precon, POOL_CARDS, POOL_VERSION, POOL_DEPS);

  test("a precon's title is the short HERO / ASPECT form; the long printed name moves to the meta line", () => {
    const title = cardTitleOf(preconOption);
    expect(title).not.toContain("—");
    expect(title).toContain("/");
    const meta = deckMetaLine(preconOption, POOL_CARDS);
    expect(meta).not.toEqual(title);
    expect(meta).toMatch(/cards · legal/);
  });

  test("a saved deck's title is simply its own name, and the meta line names its source", () => {
    const saved: Deck = {
      ...precon,
      id: "userdeck:1" as Deck["id"],
      name: "My Spidey deck",
      source: { kind: "userBuilt", createdAt: "2026-01-01T00:00:00.000Z" },
    };
    const option = deckOptionOf(saved, POOL_CARDS, POOL_VERSION, POOL_DEPS);
    expect(cardTitleOf(option)).toBe("My Spidey deck");
    expect(deckMetaLine(option, POOL_CARDS)).toMatch(/· built$/);
  });
});

import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck, type Deck } from "@mc/content";
import { CORE_DEPS } from "@mc/cards";
import { deckOptionOf } from "./deck-list-model.js";
import { deckActionsOf } from "./deck-actions.js";

const precon = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, CORE_POOL_VERSION);
const own: Deck = { ...precon, source: { kind: "userBuilt", createdAt: "2026-11-21T00:00:00.000Z" } };
const optionOf = (deck: Deck) => deckOptionOf(deck, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
const ids = (actions: ReturnType<typeof deckActionsOf>) => actions.map((a) => a.id);

describe("deckActionsOf (#958)", () => {
  test("a deck of the player's own: Play first, then Edit, the hidden panes, Check, Duplicate and Delete", () => {
    const actions = deckActionsOf({ option: optionOf(own) });
    expect(ids(actions)).toEqual(["play", "edit", "cards", "stats", "check", "duplicate", "delete"]);
    expect(actions.find((a) => a.id === "edit")?.label).toBe("Edit");
    expect(actions.filter((a) => a.primary).map((a) => a.id)).toEqual(["play"]);
    expect(actions.every((a) => a.enabled)).toBe(true);
  });

  test("a precon edits a copy and has no Delete", () => {
    const actions = deckActionsOf({ option: optionOf(precon) });
    expect(ids(actions)).not.toContain("delete");
    expect(actions.find((a) => a.id === "edit")?.label).toBe("Edit a copy");
  });

  test("Delete asks for a second press once armed", () => {
    const actions = deckActionsOf({ option: optionOf(own), deleteArmed: true });
    expect(actions.find((a) => a.id === "delete")?.label).toBe("Confirm delete");
  });

  test("an illegal deck can't be played, and says why", () => {
    const actions = deckActionsOf({ option: optionOf({ ...own, cards: [] }) });
    const play = actions.find((a) => a.id === "play")!;
    expect(play.enabled).toBe(false);
    expect(play.reason).toBeTruthy();
    // Editing is how the player fixes it.
    expect(actions.find((a) => a.id === "edit")?.enabled).toBe(true);
  });

  test("a community deck offers Add, its cards and Check, and nothing that changes it", () => {
    const actions = deckActionsOf({ option: optionOf(precon), community: { lock: null, added: false } });
    expect(ids(actions)).toEqual(["add", "cards", "check"]);
    expect(actions[0]).toMatchObject({ label: "Add to my decks ▸", primary: true, enabled: true });
    const again = deckActionsOf({ option: optionOf(precon), community: { lock: null, added: true } });
    expect(again[0]?.label).toBe("Add another copy ▸");
  });

  test("a locked community deck can't be added, and says what opens it", () => {
    const actions = deckActionsOf({
      option: optionOf(precon),
      community: { lock: "Win a game with Spider-Man to open this deck.", added: false },
    });
    expect(actions[0]).toMatchObject({
      id: "add",
      enabled: false,
      reason: "Win a game with Spider-Man to open this deck.",
    });
  });
});

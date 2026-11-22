import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck, type Deck } from "@mc/content";
import { CORE_DEPS } from "@mc/cards";
import { deckOptionOf } from "./deck-list-model.js";
import {
  deckActionsHeight,
  deckActionsOf,
  deckActionsPlan,
  deckActionsTextWidths,
  type DeckActionsMeasured,
  type DeckActionsTextWidths,
} from "./deck-actions.js";

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

describe("deckActionsPlan (#958 review)", () => {
  // The tallest sheet there is: an own deck's grid (Edit, View cards, Stats, Check, Duplicate, Delete), a long name
  // over two lines, and both notes (Delete's warning, then why a press on Play did nothing): about 220 characters of
  // 13px text at ~7px a character, so the notes grow as their column narrows.
  const measure = (widths: DeckActionsTextWidths): DeckActionsMeasured => ({
    header: widths.header < 260 ? 128 : 80,
    notes: Math.ceil((220 * 7) / widths.notes) * 17,
  });

  test.each([
    [375, 667],
    [412, 924],
    [820, 1180],
    [1180, 820],
    [667, 375],
    [740, 360],
    [844, 390],
  ])("every button, Back and both notes fit on screen at %ix%i", (width, height) => {
    const plan = deckActionsPlan({ width, height, gridCount: 6, measure });
    expect(plan, "a plan fits").not.toBeNull();
    expect(deckActionsHeight(plan!, 6, measure(deckActionsTextWidths(plan!)))).toBeLessThanOrEqual(
      height - plan!.margin * 2,
    );
    expect(plan!.row).toBeGreaterThanOrEqual(44);
    expect(plan!.boxWidth).toBeLessThanOrEqual(width - plan!.margin * 2);
  });

  test("a phone held upright keeps two columns of tall buttons; sideways steps to more columns", () => {
    expect(deckActionsPlan({ width: 375, height: 667, gridCount: 6, measure })).toMatchObject({ columns: 2, row: 52 });
    expect(deckActionsPlan({ width: 667, height: 375, gridCount: 6, measure })!.columns).toBeGreaterThan(2);
  });

  test("nothing fits a screen far too short: null, so the sheet shortens its notes", () => {
    expect(deckActionsPlan({ width: 667, height: 200, gridCount: 6, measure })).toBeNull();
  });
});

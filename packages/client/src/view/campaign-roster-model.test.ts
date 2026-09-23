import { describe, expect, test } from "vitest";
import type { CardId, Deck } from "@mc/content";
import { TRORS_STORY } from "../campaign/stories/trors.js";
import { POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import { preconRosterOf, rosterDeckOptions, rosterModelOf } from "./campaign-roster-model.js";

const precons = preconDecks(POOL_VERSION);
const hawkeye = precons.find((d) => d.identityCardId === "04001a")!;
const spiderWoman = precons.find((d) => d.identityCardId === "04031a")!;

describe("preconRosterOf", () => {
  test("MC10's cast pre-fills seats 1 and 2, leaving 3 and 4 empty", () => {
    const seats = preconRosterOf(TRORS_STORY.castIdentityIds as readonly CardId[], POOL_VERSION);
    expect(seats).toHaveLength(4);
    expect(seats[0]?.identityCardId).toBe("04001a");
    expect(seats[1]?.identityCardId).toBe("04031a");
    expect(seats[2]).toBeNull();
    expect(seats[3]).toBeNull();
  });
});

describe("rosterModelOf", () => {
  test("the box's precon roster signs, with the labels the design prints", () => {
    const seats: (Deck | null)[] = [hawkeye, spiderWoman, null, null];
    const model = rosterModelOf(seats, POOL_CARDS);
    expect(model.canSign).toBe(true);
    expect(model.blockedReason).toBeNull();
    expect(model.seats[0]).toMatchObject({ identityName: "Hawkeye", aspectsLabel: "Leadership · starter deck" });
    expect(model.seats[1]?.identityName).toBe("Spider-Woman");
  });

  test("no seats signed cannot be signed", () => {
    const model = rosterModelOf([null, null, null, null], POOL_CARDS);
    expect(model.canSign).toBe(false);
    expect(model.blockedReason).toMatch(/seat/i);
  });

  test("two seats with the same identity cannot be signed (MC10 p. 3)", () => {
    const model = rosterModelOf([hawkeye, hawkeye, null, null], POOL_CARDS);
    expect(model.canSign).toBe(false);
    expect(model.blockedReason).toMatch(/different hero/);
  });

  test("an illegal deck blocks signing", () => {
    const brokenDeck: Deck = { ...hawkeye, cards: [] };
    const model = rosterModelOf([brokenDeck, null, null, null], POOL_CARDS);
    expect(model.canSign).toBe(false);
    expect(model.seats[0]?.legal).toBe(false);
  });
});

describe("rosterDeckOptions", () => {
  test("a seat's picker excludes an identity already seated elsewhere", () => {
    const seats: (Deck | null)[] = [hawkeye, null, null, null];
    const options = rosterDeckOptions(seats, 2, [], POOL_VERSION);
    expect(options.some((deck) => deck.identityCardId === "04001a")).toBe(false);
    expect(options.some((deck) => deck.identityCardId === "04031a")).toBe(true);
  });

  test("a seat's own current deck is not excluded from its own picker", () => {
    const seats: (Deck | null)[] = [hawkeye, null, null, null];
    const options = rosterDeckOptions(seats, 1, [], POOL_VERSION);
    expect(options.some((deck) => deck.identityCardId === "04001a")).toBe(true);
  });
});

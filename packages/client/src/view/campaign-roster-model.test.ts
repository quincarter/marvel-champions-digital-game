import { describe, expect, test } from "vitest";
import type { CardId, Deck } from "@mc/content";
import { TRORS_STORY } from "../campaign/stories/trors.js";
import { POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import { preconRosterOf, rosterDeckOptions, rosterModelOf } from "./campaign-roster-model.js";
import { DEFAULT_UNLOCK_PREFS, NO_PROGRESS, Unlocks } from "../progression/unlocks.js";

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
  test("an identity already seated elsewhere is listed, not dropped — just marked blocked", () => {
    const seats: (Deck | null)[] = [hawkeye, null, null, null];
    const options = rosterDeckOptions(seats, 2, [], POOL_VERSION);
    const hawkeyeOption = options.find((o) => o.deck.identityCardId === "04001a");
    expect(hawkeyeOption).toMatchObject({ blocked: true, blockedReason: "Already seated at #1" });
    const spiderWomanOption = options.find((o) => o.deck.identityCardId === "04031a");
    expect(spiderWomanOption).toMatchObject({ blocked: false, blockedReason: null });
  });

  test("a seat's own current deck is never blocked in its own picker", () => {
    const seats: (Deck | null)[] = [hawkeye, null, null, null];
    const options = rosterDeckOptions(seats, 1, [], POOL_VERSION);
    const hawkeyeOption = options.find((o) => o.deck.identityCardId === "04001a");
    expect(hawkeyeOption?.blocked).toBe(false);
  });

  test("every precon is listed regardless of scroll position — nothing is ever excluded outright", () => {
    const seats: (Deck | null)[] = [hawkeye, spiderWoman, null, null];
    const options = rosterDeckOptions(seats, 3, [], POOL_VERSION);
    expect(options.length).toBe(precons.length);
  });
});

describe("rosterDeckOptions with progression", () => {
  test("a hero the player hasn't unlocked is listed, blocked, with what opens it", () => {
    const seats = preconRosterOf(TRORS_STORY.castIdentityIds as readonly CardId[], POOL_VERSION);
    const options = rosterDeckOptions(seats, 3, [], POOL_VERSION, (deck) =>
      deck.identityCardId === "03001a" ? "Beat Rhino to unlock Wave 1" : null,
    );
    const cap = options.find((o) => o.deck.identityCardId === "03001a")!;
    expect(cap).toMatchObject({ blocked: true, blockedReason: "Beat Rhino to unlock Wave 1" });
    expect(options.find((o) => o.deck.identityCardId === "01001a")).toMatchObject({ blocked: false });
    // Already seated wins over a lock: that is the reason the player can act on here.
    expect(options.find((o) => o.deck.identityCardId === "04001a")?.blockedReason).toBe("Already seated at #1");
  });
});

describe("rosterDeckOptions with the real unlocks", () => {
  test("locks a precon, never a deck the player imported or built", () => {
    const u = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS });
    const capPrecon = precons.find((d) => d.identityCardId === "03001a")!;
    const built = { ...capPrecon, id: "my-cap", source: { kind: "built" } } as unknown as Deck;
    const options = rosterDeckOptions([null, null, null, null], 1, [built], POOL_VERSION, (deck) => u.deckLock(deck));
    expect(options.find((o) => o.deck.id === capPrecon.id)).toMatchObject({ blocked: true });
    expect(options.find((o) => o.deck.id === built.id)).toMatchObject({ blocked: false, blockedReason: null });
  });
});

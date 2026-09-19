import { describe, expect, test } from "vitest";
import { activeSeatRosterOf, aspectLabelOf, heroCandidateDetailOf, seatSlotsOf } from "./seat-slots.js";
import { deckOptionOf, preconDecks } from "./deck-list-model.js";
import { seatOptions } from "./seats.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_VERSION } from "../content/pool.js";

const deckOptions = preconDecks(POOL_VERSION).map((deck) => deckOptionOf(deck, POOL_CARDS, POOL_VERSION, POOL_DEPS));
const spiderMan = deckOptions.find((o) => (o.deck.id as string) === "precon:core-spider-man-justice")!;

describe("aspectLabelOf", () => {
  test("one aspect", () => expect(aspectLabelOf(["justice"])).toBe("Justice"));
  test("more than one aspect", () => expect(aspectLabelOf(["aggression", "justice"])).toBe("Aggression + Justice"));
});

describe("seatSlotsOf", () => {
  test("fills seated slots and pads the rest empty, up to maxSeats", () => {
    const slots = seatSlotsOf([spiderMan.deck.id as string], deckOptions, CARDS_BY_ID);
    expect(slots.length).toBe(4);
    expect(slots[0]!.deckId).toBe(spiderMan.deck.id);
    expect(slots[0]!.identityName).toBe(spiderMan.identityName);
    expect(slots[0]!.aspectLabel).toBe("Justice");
    expect(slots[0]!.hp).toBeGreaterThan(0);
    expect(slots[1]).toEqual({ index: 1, deckId: null, deckName: null, identityName: null, aspectLabel: null, hp: null, handSize: null, thw: null, atk: null, def: null, active: false });
  });

  test("a full table (4 seats) has no empty slots", () => {
    const fourDeckIds = deckOptions.slice(0, 4).map((o) => o.deck.id as string);
    const slots = seatSlotsOf(fourDeckIds, deckOptions, CARDS_BY_ID);
    expect(slots.every((s) => s.deckId !== null)).toBe(true);
  });

  test("exactly one slot is active, at the given index, clamped into range", () => {
    const slots = seatSlotsOf([spiderMan.deck.id as string], deckOptions, CARDS_BY_ID, 4, 2);
    expect(slots.filter((s) => s.active)).toHaveLength(1);
    expect(slots[2]!.active).toBe(true);
    const clamped = seatSlotsOf([spiderMan.deck.id as string], deckOptions, CARDS_BY_ID, 4, 99);
    expect(clamped[3]!.active).toBe(true);
    const defaulted = seatSlotsOf([spiderMan.deck.id as string], deckOptions, CARDS_BY_ID);
    expect(defaulted[0]!.active).toBe(true);
  });
});

describe("activeSeatRosterOf (docs/phase4-screen-gaps.md §3, the owner's 'only seat 1' bug)", () => {
  const fourDeckIds = deckOptions.slice(0, 4).map((o) => o.deck.id as string);

  test("a deck seated at the active seat is never blocked and is marked isActiveSeat", () => {
    const seats = [spiderMan.deck.id as string];
    const entries = activeSeatRosterOf(seatOptions(deckOptions, seats, CARDS_BY_ID), seats, 0);
    const own = entries.find((e) => e.deckId === spiderMan.deck.id)!;
    expect(own.isActiveSeat).toBe(true);
    expect(own.blockedBy).toBeNull();
    expect(own.seatIndex).toBe(0);
  });

  test("a deck seated at a different seat is blocked, named by that seat's own number — not by seatOptions' 'never blocks a seated deck'", () => {
    const seats = fourDeckIds;
    const entries = activeSeatRosterOf(seatOptions(deckOptions, seats, CARDS_BY_ID), seats, 0);
    const atSeatThree = entries.find((e) => e.deckId === seats[2])!;
    expect(atSeatThree.isActiveSeat).toBe(false);
    expect(atSeatThree.blockedBy).toBe("Already seated · Seat 3");
  });

  test("an unseated deck keeps seatOptions' own verdict — legal decks pick-able for every active seat, seat 4 included (the owner's bug)", () => {
    const seats = [fourDeckIds[0]!];
    for (let active = 0; active < 4; active++) {
      const entries = activeSeatRosterOf(seatOptions(deckOptions, seats, CARDS_BY_ID), seats, active);
      const other = entries.find((e) => e.deckId === fourDeckIds[1])!;
      expect(other.blockedBy).toBeNull();
      expect(other.isActiveSeat).toBe(false);
      expect(other.seatIndex).toBeNull();
    }
  });

  test("a genuinely illegal/duplicate-identity deck stays blocked regardless of which seat is active", () => {
    const seats = [fourDeckIds[0]!, fourDeckIds[1]!];
    const base = seatOptions(deckOptions, seats, CARDS_BY_ID);
    const entriesAtSeat3 = activeSeatRosterOf(base, seats, 2);
    const entriesAtSeat4 = activeSeatRosterOf(base, seats, 3);
    // Both seated decks read identically regardless of which *other* seat is active.
    expect(entriesAtSeat3.find((e) => e.deckId === seats[0])!.blockedBy).toBe("Already seated · Seat 1");
    expect(entriesAtSeat4.find((e) => e.deckId === seats[0])!.blockedBy).toBe("Already seated · Seat 1");
  });
});

describe("heroCandidateDetailOf", () => {
  test("Spider-Man's own obligation and nemesis set", () => {
    const detail = heroCandidateDetailOf(spiderMan, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.identityName.length).toBeGreaterThan(0);
    expect(detail.aspectLabel).toBe("Justice");
    expect(detail.obligationName).not.toBeNull();
    expect(detail.nemesisSetName).toBe("Spider-Man Nemesis");
  });
});

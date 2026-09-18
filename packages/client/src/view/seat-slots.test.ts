import { describe, expect, test } from "vitest";
import { aspectLabelOf, heroCandidateDetailOf, seatSlotsOf } from "./seat-slots.js";
import { deckOptionOf, preconDecks } from "./deck-list-model.js";
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
    expect(slots[1]).toEqual({ index: 1, deckId: null, deckName: null, identityName: null, aspectLabel: null, hp: null, handSize: null, thw: null, atk: null, def: null });
  });

  test("a full table (4 seats) has no empty slots", () => {
    const fourDeckIds = deckOptions.slice(0, 4).map((o) => o.deck.id as string);
    const slots = seatSlotsOf(fourDeckIds, deckOptions, CARDS_BY_ID);
    expect(slots.every((s) => s.deckId !== null)).toBe(true);
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

/**
 * Travels: whether a `cardMoved` event turns into a flight, and between what.
 *
 * The risk this guards against is the same shape as beats' — a travel that
 * claims a card went somewhere it didn't, or a card silently gliding between
 * two zones the player was never shown the inside of.
 */

import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import { encounterDeckId, type GameEvent, type InstanceId, type PlayerId, type ZoneId } from "@mc/engine";
import type { Rect } from "./layout.js";
import { DRAW_SPREAD_MAX_MS, DRAW_STAGGER_MS, handArrivalsFrom, travelsFrom } from "./travel.js";

const id = (value: string): InstanceId => value as InstanceId;
const player = (value: string): PlayerId => value as PlayerId;
const card = (value: string): CardId => value as CardId;

const RECT_A: Rect = { x: 0, y: 0, width: 10, height: 10 };
const RECT_B: Rect = { x: 100, y: 100, width: 10, height: 10 };

function moved(instanceId: InstanceId, from: ZoneId, to: ZoneId): GameEvent {
  return { type: "cardMoved", instanceId, cardId: card("test"), from, to };
}

describe("travelsFrom", () => {
  test("travels between two rects when both anchors resolve", () => {
    const hand: ZoneId = { kind: "hand", playerId: player("p1") };
    const playArea: ZoneId = { kind: "playArea", playerId: player("p1") };
    const travels = travelsFrom(
      [moved(id("card-1"), hand, playArea)],
      () => RECT_A,
      () => RECT_B,
      () => null,
    );
    expect(travels).toHaveLength(1);
    expect(travels[0]).toEqual({
      id: "travel-0",
      instanceId: id("card-1"),
      from: RECT_A,
      to: RECT_B,
      delayMs: 0,
      draw: false,
      facedown: false,
      art: null,
    });
  });

  test("carries the art the artOf callback resolves for the moved card's instance id", () => {
    const hand: ZoneId = { kind: "hand", playerId: player("p1") };
    const playArea: ZoneId = { kind: "playArea", playerId: player("p1") };
    const art = { key: "art:test", url: "/card-art/test.png" };
    const travels = travelsFrom(
      [moved(id("card-1"), hand, playArea)],
      () => RECT_A,
      () => RECT_B,
      (instanceId) => (instanceId === id("card-1") ? art : null),
    );
    expect(travels[0]?.art).toEqual(art);
  });

  test("no travel when either anchor is unresolved — the deck has no on-screen rect", () => {
    const deck: ZoneId = { kind: "deck", playerId: player("p1") };
    const hand: ZoneId = { kind: "hand", playerId: player("p1") };
    const travels = travelsFrom(
      [moved(id("card-1"), deck, hand)],
      () => null,
      () => RECT_B,
      () => null,
    );
    expect(travels).toEqual([]);
  });

  test("no travel between two zones the player is never shown the inside of", () => {
    const setAside: ZoneId = { kind: "setAside", playerId: player("p1") };
    const tucked: ZoneId = { kind: "tucked", hostInstanceId: id("host-1") };
    // Even when both sides *could* resolve to a rect, the move never happened
    // on screen, so nothing should fly.
    const travels = travelsFrom(
      [moved(id("card-1"), setAside, tucked)],
      () => RECT_A,
      () => RECT_B,
      () => null,
    );
    expect(travels).toEqual([]);
  });

  test("a reveal from a hidden deck to a visible zone still travels — the pile itself is public", () => {
    const encounterDeck: ZoneId = { kind: "encounterDeck", deckId: encounterDeckId("e1") };
    const villainArea: ZoneId = { kind: "villainArea" };
    const travels = travelsFrom(
      [moved(id("minion-1"), encounterDeck, villainArea)],
      () => RECT_A,
      () => RECT_B,
      () => null,
    );
    expect(travels).toHaveLength(1);
  });

  test("no travel when the card didn't actually change zone", () => {
    const hand: ZoneId = { kind: "hand", playerId: player("p1") };
    const travels = travelsFrom(
      [moved(id("card-1"), hand, { kind: "hand", playerId: player("p1") })],
      () => RECT_A,
      () => RECT_B,
      () => null,
    );
    expect(travels).toEqual([]);
  });

  test("no travel when the resolved rects are identical — nothing to see", () => {
    const hand: ZoneId = { kind: "hand", playerId: player("p1") };
    const playArea: ZoneId = { kind: "playArea", playerId: player("p1") };
    const travels = travelsFrom(
      [moved(id("card-1"), hand, playArea)],
      () => RECT_A,
      () => RECT_A,
      () => null,
    );
    expect(travels).toEqual([]);
  });

  test("ignores non-move events", () => {
    const travels = travelsFrom(
      [{ type: "roundStarted", round: 2 }],
      () => RECT_A,
      () => RECT_B,
      () => null,
    );
    expect(travels).toEqual([]);
  });

  test("keys travels by event order, so a list can key on them", () => {
    const hand: ZoneId = { kind: "hand", playerId: player("p1") };
    const playArea: ZoneId = { kind: "playArea", playerId: player("p1") };
    const travels = travelsFrom(
      [{ type: "roundStarted", round: 2 }, moved(id("card-1"), hand, playArea)],
      () => RECT_A,
      () => RECT_B,
      () => null,
    );
    expect(travels[0]!.id).toBe("travel-1");
  });

  describe("facedown encounter deals", () => {
    const encounter: ZoneId = { kind: "encounterDeck", deckId: encounterDeckId("e1") };
    const dealt: ZoneId = { kind: "dealtEncounter", playerId: player("p1") };

    test("a deal flies from the encounter deck to the player's pile as the card back, never the face", () => {
      const face = { key: "art:face", url: "/face.png" };
      const travels = travelsFrom(
        [moved(id("card-0"), encounter, dealt)],
        () => RECT_A,
        () => RECT_B,
        () => face,
      );
      expect(travels).toHaveLength(1);
      expect(travels[0]).toMatchObject({ facedown: true, draw: false, art: null, from: RECT_A, to: RECT_B });
    });

    test("several deals in one command fly one after another", () => {
      const travels = travelsFrom(
        [0, 1, 2].map((i) => moved(id(`card-${i}`), encounter, dealt)),
        () => RECT_A,
        () => RECT_B,
        () => null,
      );
      expect(travels.map((travel) => travel.delayMs)).toEqual([0, DRAW_STAGGER_MS, DRAW_STAGGER_MS * 2]);
    });

    test("a card dealt and revealed in one command flies to the pile and has no second flight", () => {
      const inPlay: ZoneId = { kind: "villainArea" };
      const travels = travelsFrom(
        [moved(id("card-0"), encounter, dealt), moved(id("card-0"), dealt, inPlay)],
        () => RECT_A,
        () => RECT_B,
        () => null,
      );
      expect(travels.map((travel) => travel.id)).toEqual(["travel-0"]);
    });
  });

  describe("draws", () => {
    const deck: ZoneId = { kind: "deck", playerId: player("p1") };
    const hand: ZoneId = { kind: "hand", playerId: player("p1") };
    const drawsOf = (count: number): GameEvent[] =>
      Array.from({ length: count }, (_, i) => moved(id(`card-${i}`), deck, hand));

    test("a deck-to-hand move is a draw, flying from the deck pile to the hand slot", () => {
      const travels = travelsFrom(
        drawsOf(1),
        (_, zone) => (zone.kind === "deck" ? RECT_A : null),
        (_, zone) => (zone.kind === "hand" ? RECT_B : null),
        () => null,
      );
      expect(travels).toEqual([
        {
          id: "travel-0",
          instanceId: id("card-0"),
          from: RECT_A,
          to: RECT_B,
          delayMs: 0,
          draw: true,
          facedown: false,
          art: null,
        },
      ]);
    });

    test("several draws are dealt one by one, in draw order", () => {
      const travels = travelsFrom(
        drawsOf(3),
        () => RECT_A,
        () => RECT_B,
        () => null,
      );
      expect(travels.map((travel) => travel.delayMs)).toEqual([0, DRAW_STAGGER_MS, DRAW_STAGGER_MS * 2]);
    });

    test("a long draw is squeezed so its last card still starts within the spread limit", () => {
      const travels = travelsFrom(
        drawsOf(11),
        () => RECT_A,
        () => RECT_B,
        () => null,
      );
      expect(travels.at(-1)!.delayMs).toBe(DRAW_SPREAD_MAX_MS);
      expect(travels[1]!.delayMs).toBeLessThan(DRAW_STAGGER_MS);
    });

    test("a draw that has no on-screen slot (teammate, hidden tab) does not take a place in the line", () => {
      const travels = travelsFrom(
        drawsOf(3),
        () => RECT_A,
        (instanceId) => (instanceId === id("card-0") ? null : RECT_B),
        () => null,
      );
      expect(travels.map((travel) => travel.delayMs)).toEqual([0, DRAW_STAGGER_MS]);
    });

    test("an ordinary move does not wait behind a draw", () => {
      const playArea: ZoneId = { kind: "playArea", playerId: player("p1") };
      const travels = travelsFrom(
        [...drawsOf(2), moved(id("ally"), hand, playArea)],
        () => RECT_A,
        () => RECT_B,
        () => null,
      );
      expect(travels.find((travel) => travel.instanceId === id("ally"))?.delayMs).toBe(0);
    });

    test("handArrivalsFrom lists only the cards that reach this player's hand from their deck", () => {
      const other: ZoneId = { kind: "hand", playerId: player("p2") };
      const discard: ZoneId = { kind: "discard", playerId: player("p1") };
      const events = [
        moved(id("mine"), deck, hand),
        moved(id("theirs"), { kind: "deck", playerId: player("p2") }, other),
        moved(id("returned"), discard, hand),
        moved(id("played"), hand, { kind: "playArea", playerId: player("p1") }),
      ];
      expect(handArrivalsFrom(events, "p1")).toEqual([id("mine")]);
    });
  });
});

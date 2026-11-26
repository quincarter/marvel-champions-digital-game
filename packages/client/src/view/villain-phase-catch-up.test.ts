import type { GameEvent, GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { eventsToTakeIn, gamesForTakeIn } from "./villain-phase-catch-up.js";

const ev = (n: number): GameEvent => ({ type: "threatPlaced", amount: n }) as unknown as GameEvent;
const trailOf = (count: number) => Array.from({ length: count }, (_, i) => ({ events: [ev(i)] }));

describe("eventsToTakeIn (#1017)", () => {
  it("takes an update's own events when the screen has seen nothing yet", () => {
    expect(eventsToTakeIn(-2, { version: 5, lastEvents: [ev(4)], commandTrail: trailOf(5) })).toEqual([[ev(4)]]);
  });

  it("takes one command's events as they come", () => {
    expect(eventsToTakeIn(4, { version: 5, lastEvents: [ev(99)], commandTrail: trailOf(4) })).toEqual([[ev(99)]]);
  });

  it("takes every command a guest's catch-up batch skipped, from the trail, in order", () => {
    // A batch of three of the host's moves lands as one update with no events of its own (live/seat-core.ts).
    expect(eventsToTakeIn(4, { version: 7, lastEvents: [], commandTrail: trailOf(7) })).toEqual([
      [ev(4)],
      [ev(5)],
      [ev(6)],
    ]);
  });

  it("takes a single missed command from the trail when the update carries no events (a reconnect's log)", () => {
    expect(eventsToTakeIn(4, { version: 5, lastEvents: [], commandTrail: trailOf(5) })).toEqual([[ev(4)]]);
  });

  it("falls back to the update's own events on a rewind or a trail that does not line up with the update", () => {
    expect(eventsToTakeIn(6, { version: 4, lastEvents: [ev(3)], commandTrail: trailOf(4) })).toEqual([[ev(3)]]);
    expect(eventsToTakeIn(4, { version: 7, lastEvents: [], commandTrail: trailOf(5) })).toEqual([[]]);
    // One entry long reads every index one command off: never trusted.
    expect(eventsToTakeIn(4, { version: 5, lastEvents: [], commandTrail: trailOf(6) })).toEqual([[]]);
  });

  it("winds an earlier command's table back by the rounds the later commands started", () => {
    const game = { round: 3 } as unknown as GameState;
    const started = { type: "roundStarted", round: 3 } as unknown as GameEvent;
    const tables = gamesForTakeIn([[ev(0)], [started], [ev(1)]], game);
    expect(tables.map((t) => t.round)).toEqual([2, 3, 3]);
    expect(tables[2]).toBe(game);
  });
});

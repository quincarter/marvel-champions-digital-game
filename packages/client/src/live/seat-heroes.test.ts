import { describe, expect, test } from "vitest";
import type { RoomSeat } from "./room-state.js";
import { heroesOfSeats, sameHeroes } from "./seat-heroes.js";
import { seatFeedMessage } from "./seat-protocol.js";

const seat = (id: string, extra: Partial<RoomSeat>): RoomSeat =>
  ({ id, mine: false, mismatch: false, takenOver: false, player: null, ...extra }) as RoomSeat;

describe("heroesOfSeats", () => {
  test("counts only my seats that may act, in seat order", () => {
    const seats = [
      seat("s1", { mine: true, player: "p1" }),
      seat("s2", { mine: false, player: "p2" }),
      seat("s3", { mine: true, player: "p3", mismatch: true }),
      seat("s4", { mine: true, player: "p4", takenOver: true }),
      seat("s5", { mine: true, player: null }),
      seat("s6", { mine: true, player: "p6" }),
    ];
    expect(heroesOfSeats({ seats })).toEqual(["p1", "p6"]);
    expect(heroesOfSeats({ seats: [] })).toEqual([]);
  });

  test("sameHeroes compares in order", () => {
    expect(sameHeroes(["p1", "p2"], ["p1", "p2"])).toBe(true);
    expect(sameHeroes(["p1", "p2"], ["p2", "p1"])).toBe(false);
    expect(sameHeroes([], ["p1"])).toBe(false);
  });
});

describe("seatFeedMessage", () => {
  test("turns a seat's proposal into the room's propose message for the first table", () => {
    const command = { type: "endTurn", playerId: "p1" };
    expect(seatFeedMessage({ kind: "propose", command, base: 7 })).toEqual({
      ch: "game",
      kind: "propose",
      table: "t1",
      command,
      base: 7,
    });
  });

  test("ignores anything else on the feed", () => {
    expect(seatFeedMessage({ kind: "resync" })).toBeNull();
    expect(seatFeedMessage(null)).toBeNull();
    expect(seatFeedMessage({ kind: "propose", command: null, base: 1 })).toBeNull();
    expect(seatFeedMessage({ kind: "propose", command: {}, base: -1 })).toBeNull();
    expect(seatFeedMessage({ kind: "propose", command: {}, base: 1.5 })).toBeNull();
  });
});

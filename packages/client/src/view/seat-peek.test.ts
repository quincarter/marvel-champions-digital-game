import { describe, expect, it } from "vitest";
import type { PlayerId } from "@mc/engine";
import { padPickBinding } from "./pick-assign.js";
import { seatIndexOfSlot, seatPeekChips, seatPeekLabel, seatPeekQuestionPrefix, seatPeekSlot } from "./seat-peek.js";

const seats = (count: number) => ({
  players: Array.from({ length: count }, (_unused, index) => ({ playerId: `p${index + 1}` as PlayerId })),
});
const names: Record<string, string> = { p1: "Iron Man", p2: "Captain Marvel", p3: "Spider-Man", p4: "Black Panther" };
const nameOf = (id: PlayerId): string => names[id] ?? id;

describe("the seat combos: LB + a face button by seat order", () => {
  it("seat 1 to 4 wear LB + A, B, X, Y; a fifth wears nothing", () => {
    const faces = [0, 1, 2, 3].map((index) => padPickBinding(seatPeekSlot(index)!));
    expect(faces.map((binding) => binding?.modifier)).toEqual(["lb", "lb", "lb", "lb"]);
    expect(faces.map((binding) => binding?.index)).toEqual([0, 1, 2, 3]);
    expect(seatPeekSlot(4)).toBeNull();
    expect(seatPeekSlot(-1)).toBeNull();
  });

  it("reads a slot back to its seat, and no other slot as a seat", () => {
    for (const index of [0, 1, 2, 3]) expect(seatIndexOfSlot(seatPeekSlot(index))).toBe(index);
    expect(seatIndexOfSlot(0)).toBeNull();
    expect(seatIndexOfSlot(null)).toBeNull();
  });
});

describe("seatPeekChips", () => {
  it("offers nothing in a one-seat game", () => {
    expect(seatPeekChips(seats(1), "p1" as PlayerId, "p1" as PlayerId, nameOf)).toEqual([]);
  });

  it("lists every seat in order, marks the one shown and the one deciding", () => {
    const chips = seatPeekChips(seats(3), "p2" as PlayerId, "p1" as PlayerId, nameOf);
    expect(chips.map((chip) => chip.name)).toEqual(["Iron Man", "Captain Marvel", "Spider-Man"]);
    expect(chips.map((chip) => chip.viewing)).toEqual([false, true, false]);
    expect(chips.map((chip) => chip.home)).toEqual([true, false, false]);
    expect(chips.map((chip) => chip.slot)).toEqual([0, 1, 2].map(seatPeekSlot));
    expect(seatPeekLabel(chips[0]!)).toBe("Iron Man ★");
    expect(seatPeekLabel(chips[1]!)).toBe("Captain Marvel");
  });

  it("the banner names whose side the table is on only while it is a teammate's", () => {
    expect(seatPeekQuestionPrefix(null)).toBe("Your decision");
    expect(seatPeekQuestionPrefix("Spider-Man")).toBe("Looking at Spider-Man · your decision");
  });
});

import { describe, expect, it } from "vitest";
import { seatToClear, steppedSeatIndex } from "./seat-step.js";
import { initialSetupDraft, type SetupDraft } from "./setup-draft.js";

const draftOf = (seats: readonly string[], activeSeatIndex: number): SetupDraft => ({
  ...initialSetupDraft({ scenarioId: "rhino", seatDeckId: seats[0]!, seed: 1 }),
  seats,
  activeSeatIndex,
});

describe("steppedSeatIndex", () => {
  it("steps through the filled seats and the one empty seat after them, wrapping at both ends", () => {
    const draft = draftOf(["a", "b"], 0);
    expect(steppedSeatIndex(draft, 1, 4)).toBe(1);
    expect(steppedSeatIndex({ ...draft, activeSeatIndex: 1 }, 1, 4)).toBe(2);
    expect(steppedSeatIndex({ ...draft, activeSeatIndex: 2 }, 1, 4)).toBe(0);
    expect(steppedSeatIndex(draft, -1, 4)).toBe(2);
  });

  it("never reaches a seat past the empty one", () => {
    expect(steppedSeatIndex(draftOf(["a"], 0), 1, 4)).toBe(1);
    expect(steppedSeatIndex(draftOf(["a"], 1), 1, 4)).toBe(0);
  });

  it("has four seats to walk on a full table", () => {
    const draft = draftOf(["a", "b", "c", "d"], 3);
    expect(steppedSeatIndex(draft, 1, 4)).toBe(0);
  });
});

describe("seatToClear", () => {
  it("takes the focused seat tile, else the active seat", () => {
    const draft = draftOf(["a", "b", "c"], 0);
    expect(seatToClear(draft, "seat:2")).toBe(2);
    expect(seatToClear(draft, "hero:x")).toBe(0);
    expect(seatToClear(draft, null)).toBe(0);
  });

  it("leaves an empty seat and the last hero alone", () => {
    expect(seatToClear(draftOf(["a", "b"], 0), "seat:3")).toBeNull();
    expect(seatToClear(draftOf(["a", "b"], 1), "seat:2")).toBeNull();
    expect(seatToClear(draftOf(["a"], 0), "seat:0")).toBeNull();
  });
});

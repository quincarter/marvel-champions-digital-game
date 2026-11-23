import { describe, expect, it } from "vitest";
import { boardReadOnly, type BoardInputHold } from "./board-read-only.js";

const free: BoardInputHold = { replay: false, leaving: false, heldElsewhere: false, villainPhaseOpen: false };

describe("boardReadOnly", () => {
  it("takes input only when nothing holds the table", () => {
    expect(boardReadOnly(free)).toBe(false);
  });

  it("stays read-only while the villain phase is open, whoever's decision it is", () => {
    // The case a store update used to clear: the phase is open and the table is this device's to act on.
    expect(boardReadOnly({ ...free, villainPhaseOpen: true })).toBe(true);
  });

  it("stays read-only for another seat's decision once the villain phase closes", () => {
    expect(boardReadOnly({ ...free, heldElsewhere: true })).toBe(true);
  });

  it("is read-only on a replay and while a seat is being left", () => {
    expect(boardReadOnly({ ...free, replay: true })).toBe(true);
    expect(boardReadOnly({ ...free, leaving: true })).toBe(true);
  });
});

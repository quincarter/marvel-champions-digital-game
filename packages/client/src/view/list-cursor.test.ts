import { describe, expect, it } from "vitest";
import { listWantsHandCursor } from "./list-cursor.js";

const base = { rect: { x: 100, y: 50, width: 400, height: 300 }, scrollbarWidth: 20, rowCount: 5 };

describe("listWantsHandCursor", () => {
  it("shows the hand over a pressable row inside the list", () => {
    expect(listWantsHandCursor({ ...base, x: 150, y: 100, rowIndex: 1, pressable: true })).toBe(true);
  });
  it("follows what a tap would do at the spot", () => {
    expect(listWantsHandCursor({ ...base, x: 150, y: 100, rowIndex: 0, pressable: true })).toBe(true);
    expect(listWantsHandCursor({ ...base, x: 150, y: 100, rowIndex: 0, pressable: false })).toBe(false);
  });
  it("not outside the list, over the scrollbar column, or past the last row", () => {
    expect(listWantsHandCursor({ ...base, x: 50, y: 100, rowIndex: 0, pressable: true })).toBe(false);
    expect(listWantsHandCursor({ ...base, x: 300, y: 400, rowIndex: 0, pressable: true })).toBe(false);
    expect(listWantsHandCursor({ ...base, x: 490, y: 100, rowIndex: 0, pressable: true })).toBe(false);
    expect(listWantsHandCursor({ ...base, x: 150, y: 100, rowIndex: 5, pressable: true })).toBe(false);
    expect(listWantsHandCursor({ ...base, x: 150, y: 100, rowIndex: -1, pressable: true })).toBe(false);
  });
});

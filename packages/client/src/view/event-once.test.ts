import { describe, expect, it } from "vitest";
import { eventOnce } from "./event-once.js";

describe("eventOnce", () => {
  it("accepts an event the first time and refuses a redelivery of the same object", () => {
    const first = eventOnce();
    const shift = { key: "Shift" };
    const tab = { key: "Tab" };
    // Phaser's queue replay for a Shift+Tab chord: Shift, Tab, then Shift, Tab, Shift, Tab again.
    const delivered = [shift, tab, shift, tab, shift, tab].filter((event) => first(event));
    expect(delivered).toEqual([shift, tab]);
  });

  it("treats two distinct events with equal contents as two presses", () => {
    const first = eventOnce();
    expect(first({ key: "Tab" })).toBe(true);
    expect(first({ key: "Tab" })).toBe(true);
  });
});

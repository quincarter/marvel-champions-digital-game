import { describe, expect, it } from "vitest";
import {
  clearLegacyDeckFreezeOptIn,
  legacyDeckFreezeOptIn,
  writeLegacyDeckFreezeOptInForTest,
} from "./deck-freeze-choice.js";

// This suite's own Vitest run has no `localStorage` (node environment, no jsdom), which exercises this module's
// in-memory fallback — each run/seat pair below is unique, so no cross-test cleanup is needed either way.
describe("MC27 p. 6's optional deck-freeze opt-in — the legacy pre-record bridge", () => {
  it("is false until a seat's legacy key is written", () => {
    expect(legacyDeckFreezeOptIn("run-1", 1)).toBe(false);
  });

  it("is true for that run and seat once written, and stays false for a different seat or run", () => {
    writeLegacyDeckFreezeOptInForTest("run-2", 1);
    expect(legacyDeckFreezeOptIn("run-2", 1)).toBe(true);
    expect(legacyDeckFreezeOptIn("run-2", 2)).toBe(false);
    expect(legacyDeckFreezeOptIn("run-3", 1)).toBe(false);
  });

  it("clearing the legacy key makes it read false again", () => {
    writeLegacyDeckFreezeOptInForTest("run-4", 1);
    expect(legacyDeckFreezeOptIn("run-4", 1)).toBe(true);
    clearLegacyDeckFreezeOptIn("run-4", 1);
    expect(legacyDeckFreezeOptIn("run-4", 1)).toBe(false);
  });
});

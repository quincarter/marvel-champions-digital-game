import { describe, expect, it } from "vitest";
import { isDeckFreezeOptedIn, optIntoDeckFreeze } from "./deck-freeze-choice.js";

// This suite's own Vitest run has no `localStorage` (node environment, no jsdom), which exercises this module's
// in-memory fallback — each run/seat pair below is unique, so no cross-test cleanup is needed either way.
describe("MC27 p. 6's optional deck-freeze opt-in, persisted client-side per run and seat", () => {
  it("is false until a seat opts in", () => {
    expect(isDeckFreezeOptedIn("run-1", 1)).toBe(false);
  });

  it("is true for that run and seat once opted in, and stays false for a different seat or run", () => {
    optIntoDeckFreeze("run-2", 1);
    expect(isDeckFreezeOptedIn("run-2", 1)).toBe(true);
    expect(isDeckFreezeOptedIn("run-2", 2)).toBe(false);
    expect(isDeckFreezeOptedIn("run-3", 1)).toBe(false);
  });
});

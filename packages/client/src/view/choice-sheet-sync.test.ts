import { describe, expect, test } from "vitest";
import { choiceSheetAction, STUCK_SHEET_GRACE_MS, stuckSheetShouldRecover } from "./choice-sheet-sync.js";

describe("choiceSheetAction", () => {
  test("an open decision on a sheet that is not leaving is simply drawn", () => {
    expect(choiceSheetAction({ leaving: false, shownChoiceId: null, pendingChoiceId: "c1" })).toBe("draw");
    expect(choiceSheetAction({ leaving: false, shownChoiceId: "c1", pendingChoiceId: "c1" })).toBe("draw");
    expect(choiceSheetAction({ leaving: false, shownChoiceId: "c1", pendingChoiceId: "c2" })).toBe("draw");
  });

  test("no pending decision means hold, leaving or not — the Board stops the scene", () => {
    expect(choiceSheetAction({ leaving: false, shownChoiceId: "c1", pendingChoiceId: null })).toBe("hold");
    expect(choiceSheetAction({ leaving: true, shownChoiceId: "c1", pendingChoiceId: null })).toBe("hold");
  });

  test("leaving on the same decision holds: the sheet's own answer is still in flight", () => {
    expect(choiceSheetAction({ leaving: true, shownChoiceId: "c1", pendingChoiceId: "c1" })).toBe("hold");
  });

  test("leaving when a *different* decision is pending restarts: the engine answered one and raised the next in the same command (the 2026-09-21 'popup never came back' regression)", () => {
    expect(choiceSheetAction({ leaving: true, shownChoiceId: "c1", pendingChoiceId: "c2" })).toBe("restart");
  });
});

describe("stuckSheetShouldRecover", () => {
  const stuck = {
    leaving: true,
    shownChoiceId: "c4",
    pendingChoiceId: "c4",
    inFlight: false,
    idleForMs: STUCK_SHEET_GRACE_MS,
  };

  test("an answered sheet idle on the same open decision past the grace comes back", () => {
    expect(stuckSheetShouldRecover(stuck)).toBe(true);
  });

  test("not while the answer is still in flight, not before the grace, not on a new or closed decision, not when not leaving", () => {
    expect(stuckSheetShouldRecover({ ...stuck, inFlight: true })).toBe(false);
    expect(stuckSheetShouldRecover({ ...stuck, idleForMs: STUCK_SHEET_GRACE_MS - 1 })).toBe(false);
    expect(stuckSheetShouldRecover({ ...stuck, pendingChoiceId: "c5" })).toBe(false);
    expect(stuckSheetShouldRecover({ ...stuck, pendingChoiceId: null })).toBe(false);
    expect(stuckSheetShouldRecover({ ...stuck, leaving: false })).toBe(false);
  });
});

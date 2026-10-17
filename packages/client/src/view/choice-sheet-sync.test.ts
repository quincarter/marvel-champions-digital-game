import { describe, expect, test } from "vitest";
import {
  choiceSheetAction,
  choiceSheetKey,
  sheetIsCovered,
  STUCK_SHEET_GRACE_MS,
  stuckSheetShouldRecover,
} from "./choice-sheet-sync.js";

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

describe("sheetIsCovered", () => {
  test("covered only while the other screen is running and above the sheet", () => {
    expect(sheetIsCovered({ coverActive: true, coverIndex: 5, sheetIndex: 4 })).toBe(true);
    expect(sheetIsCovered({ coverActive: true, coverIndex: 3, sheetIndex: 4 })).toBe(false);
    expect(sheetIsCovered({ coverActive: false, coverIndex: 5, sheetIndex: 4 })).toBe(false);
  });
});

describe("choiceSheetKey", () => {
  const option = (id: string) => ({ optionId: id, label: id, ref: { kind: "card", instanceId: id } }) as never;
  const target = {
    choiceId: "c9",
    playerId: "p1",
    prompt: { kind: "chooseTarget" },
    options: [option("i1"), option("i116")],
  } as never;
  const discard = {
    choiceId: "c9",
    playerId: "p1",
    prompt: { kind: "discardDownToHandSize", handSize: 5 },
    options: [option("i70"), option("i64"), option("i55"), option("i85"), option("i82")],
  } as never;

  test("an undone decision and the one that takes its id after the undo are two decisions (issue #211)", () => {
    // Rhino picked as the target, the play undone, then the end-of-turn discard raised as c9 again.
    expect(choiceSheetKey(target)).not.toBe(choiceSheetKey(discard));
    expect(
      choiceSheetAction({
        leaving: true,
        shownChoiceId: choiceSheetKey(target),
        pendingChoiceId: choiceSheetKey(discard),
      }),
    ).toBe("restart");
  });

  test("the same decision redrawn keeps its key", () => {
    expect(choiceSheetKey(discard)).toBe(choiceSheetKey({ ...(discard as object) } as never));
  });
});

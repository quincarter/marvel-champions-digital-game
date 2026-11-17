/**
 * Issue #791: a game adjusted on one device stays adjusted whichever device's log sync keeps (`keptAdjusted`). Device A
 * undid past a reveal (a shorter log, marked); device B played on (a longer log, unmarked): B's log wins, A's mark stays.
 */
import { describe, expect, test } from "vitest";
import { keptAdjusted } from "./sync-engine.js";

describe("keptAdjusted", () => {
  test("a remote meta written over a marked local one keeps the mark", () => {
    const remote = { id: "g1", commandCount: 12 };
    expect(keptAdjusted("game:g1:meta", { id: "g1", commandCount: 9, adjusted: true }, remote)).toEqual({
      id: "g1",
      commandCount: 12,
      adjusted: true,
    });
  });

  test("an unmarked local side, a marked remote, and records that are not a meta are taken as they are", () => {
    const remote = { id: "g1" };
    expect(keptAdjusted("game:g1:meta", { id: "g1" }, remote)).toBe(remote);
    const marked = { id: "g1", adjusted: true };
    expect(keptAdjusted("game:g1:meta", undefined, marked)).toBe(marked);
    expect(keptAdjusted("game:g1:log:0", { adjusted: true }, remote)).toBe(remote);
  });
});

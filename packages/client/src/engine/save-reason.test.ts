import { describe, expect, test } from "vitest";
import { saveReason } from "./save-reason.js";

describe("saveReason", () => {
  test("a new round starting means the last one ended", () => {
    expect(saveReason({ state: { outcome: null }, events: [{ type: "roundStarted" }] })).toBe("round");
  });

  test("a finished game counts, whatever else happened", () => {
    expect(saveReason({ state: { outcome: "won" }, events: [] })).toBe("round");
  });

  test("any other command does not", () => {
    expect(saveReason({ state: { outcome: null }, events: [{ type: "turnEnded" }] })).toBe("game");
    expect(saveReason({ state: {}, events: [] })).toBe("game");
  });
});

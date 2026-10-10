import { describe, expect, it } from "vitest";
import { addAccelerationToken } from "./effects.js";
import { self, victoryDisplayCount, query } from "./index.js";

describe("addAccelerationToken count (Diplomatic Immunity, aos 50127)", () => {
  it("existing callers are unchanged: no target and no count add neither key", () => {
    expect(addAccelerationToken()).toEqual({ kind: "addAccelerationToken" });
    expect(addAccelerationToken(self)).toEqual({ kind: "addAccelerationToken", target: { kind: "self" } });
  });

  it("a literal count becomes a constant value", () => {
    expect(addAccelerationToken(self, 3)).toEqual({
      kind: "addAccelerationToken",
      target: { kind: "self" },
      count: { kind: "const", value: 3 },
    });
  });

  it("a live value is passed through", () => {
    const live = victoryDisplayCount(query("minion"));
    expect(addAccelerationToken(self, live)).toMatchObject({ count: live });
  });
});

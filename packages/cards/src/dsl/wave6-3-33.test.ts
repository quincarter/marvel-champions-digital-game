/** docs/phase7-wave6.md §3.33: `printedStatOf`, "where X is that minion's printed SCH" (Marvel Girl, 34015). */

import { describe, expect, it } from "vitest";
import { printedStatOf, statOf } from "./values.js";

describe("§3.33 `printedStatOf`", () => {
  it("emits `stat` with `printed`; `statOf` is unchanged", () => {
    const of = { kind: "slot", slot: "minion" } as const;
    expect(printedStatOf(of, "sch")).toEqual({ kind: "stat", of, stat: "sch", printed: true });
    expect(statOf(of, "sch")).toEqual({ kind: "stat", of, stat: "sch" });
  });
});

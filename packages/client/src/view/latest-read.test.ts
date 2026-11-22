import { describe, expect, it } from "vitest";
import { LatestRead } from "./latest-read.js";

describe("LatestRead", () => {
  it("drops a load's older read once an update's newer read was kept (the load waited on the catalog)", () => {
    const reads = new LatestRead();
    const load = reads.issue();
    const refresh = reads.issue();
    expect(reads.keep(refresh)).toBe(true);
    expect(reads.keep(load)).toBe(false);
  });

  it("keeps a load issued while a refresh is in flight: its read is the newer one", () => {
    const reads = new LatestRead();
    const refresh = reads.issue();
    const load = reads.issue();
    expect(reads.keep(refresh)).toBe(true);
    expect(reads.keep(load)).toBe(true);
    // ...and the refresh, answering last, is not kept over it.
    const again = new LatestRead();
    const r = again.issue();
    const l = again.issue();
    expect(again.keep(l)).toBe(true);
    expect(again.keep(r)).toBe(false);
  });

  it("keeps reads that do not overlap", () => {
    const reads = new LatestRead();
    expect(reads.keep(reads.issue())).toBe(true);
    expect(reads.keep(reads.issue())).toBe(true);
  });
});

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

  it("lets an older read that succeeds be kept after a newer one failed (a failed read is never kept)", () => {
    const reads = new LatestRead();
    const load = reads.issue();
    reads.issue(); // a refresh whose read failed: the scene never calls keep for it
    expect(reads.keep(load)).toBe(true);
  });

  it("never keeps a read from before a store change, even when the read after the change fails", () => {
    const reads = new LatestRead();
    const load = reads.issue();
    // An update lands; its own read is fenced in before it is answered, and that answer fails (keep is never called).
    reads.fence(reads.issue());
    expect(reads.keep(load)).toBe(false);
    // The next good read is kept.
    expect(reads.keep(reads.issue())).toBe(true);
  });

  it("keeps reads that do not overlap", () => {
    const reads = new LatestRead();
    expect(reads.keep(reads.issue())).toBe(true);
    expect(reads.keep(reads.issue())).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";

/**
 * Single player stays offline-first (issue #880): visiting the Title or leaving a room that was never joined spawns no
 * room worker and posts nothing.
 */
describe("room worker is lazy", () => {
  it("leaving at the Title with no room joined starts no worker", async () => {
    const workers: unknown[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          workers.push(this);
        }
        postMessage(): void {}
        addEventListener(): void {}
      },
    );
    const { leaveRoomAtTitle } = await import("./live-watch.js");
    leaveRoomAtTitle();
    expect(workers).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});

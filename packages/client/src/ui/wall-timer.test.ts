import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterWallMs } from "./wall-timer.js";

describe("afterWallMs", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once after the real time has passed, whatever the frame loop is doing", () => {
    const run = vi.fn();
    afterWallMs(2500, run);
    vi.advanceTimersByTime(2499);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not run once cancelled, and cancelling after it ran is harmless", () => {
    const early = vi.fn();
    const cancel = afterWallMs(100, early);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(early).not.toHaveBeenCalled();

    const late = vi.fn();
    const cancelLate = afterWallMs(100, late);
    vi.advanceTimersByTime(100);
    expect(() => cancelLate()).not.toThrow();
    expect(late).toHaveBeenCalledTimes(1);
  });
});

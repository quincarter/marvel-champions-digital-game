import { describe, expect, test, vi } from "vitest";
import { watchScenes, type SceneSignal } from "./discord-scene-watch.js";

function fakeSystems() {
  const calls: { name: string; self: unknown; data: unknown }[] = [];
  class Systems {
    settings: { key: string; data?: Record<string, unknown> | undefined } = { key: "CampaignRun" };
    start(data?: object) {
      calls.push({ name: "start", self: this, data });
      return "started";
    }
    wake(data?: object) {
      calls.push({ name: "wake", self: this, data });
      return this;
    }
    shutdown(data?: object) {
      calls.push({ name: "shutdown", self: this, data });
    }
    sleep(data?: object) {
      calls.push({ name: "sleep", self: this, data });
      return this;
    }
  }
  return { Systems, calls };
}

describe("watchScenes", () => {
  test("runs the original with the same this and data, passes its return value through, then reports", () => {
    const { Systems, calls } = fakeSystems();
    const signals: SceneSignal[] = [];
    watchScenes(Systems, (signal) => signals.push(signal));
    const sys = new Systems();
    const data = { x: 1 };
    sys.settings.data = { campaignId: "mts", runId: "r1" };
    expect(sys.start(data)).toBe("started");
    expect(calls[0]).toMatchObject({ name: "start", self: sys, data });
    expect(sys.wake()).toBe(sys);
    expect(sys.sleep()).toBe(sys);
    sys.shutdown();
    expect(signals).toEqual([
      { up: true, key: "CampaignRun", campaignId: "mts", runId: "r1" },
      { up: true, key: "CampaignRun", campaignId: "mts", runId: "r1" },
      { up: false, key: "CampaignRun" },
      { up: false, key: "CampaignRun" },
    ]);
  });

  test("reads the start data after the original ran, and drops non-strings", () => {
    const { Systems } = fakeSystems();
    const signals: SceneSignal[] = [];
    watchScenes(Systems, (signal) => signals.push(signal));
    const sys = new Systems();
    sys.settings.data = { campaignId: 7, runId: null };
    sys.start();
    expect(signals[0]).toEqual({ up: true, key: "CampaignRun" });
    sys.settings.data = undefined;
    sys.start();
    expect(signals[1]).toEqual({ up: true, key: "CampaignRun" });
  });

  test("a second call swaps the listener and does not wrap twice", () => {
    const { Systems, calls } = fakeSystems();
    const first = vi.fn();
    const second = vi.fn();
    watchScenes(Systems, first);
    watchScenes(Systems, second);
    new Systems().start();
    expect(calls).toHaveLength(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("a throwing listener does not break the scene call", () => {
    const { Systems } = fakeSystems();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    watchScenes(Systems, () => {
      throw new Error("boom");
    });
    expect(new Systems().start()).toBe("started");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";
import { bootWaitingOn, settledWithin, startupReportText } from "./startup-watchdog.js";

describe("a startup read that never settles (issue #871)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("is given up on after its time, so Boot still reaches Title", async () => {
    vi.useFakeTimers();
    const never = new Promise<void>(() => undefined);
    const outcome = settledWithin(never, 6000);
    await vi.advanceTimersByTimeAsync(6000);
    await expect(outcome).resolves.toBe(false);
  });

  test("is waited for when it settles in time, a failed read included", async () => {
    vi.useFakeTimers();
    await expect(settledWithin(Promise.resolve(true), 6000)).resolves.toBe(true);
    await expect(settledWithin(Promise.reject(new Error("no database")), 6000)).resolves.toBe(true);
  });

  test("names the step Boot is waiting on for the last-resort panel", () => {
    const boot: { stage: string; waiting?: string | null } = { stage: "frame" };
    vi.stubGlobal("__mcBoot", boot);
    bootWaitingOn("saved progress");
    expect(boot.waiting).toBe("saved progress");
    bootWaitingOn(null);
    expect(boot.waiting).toBeNull();
  });
});

describe("the failed-start panel's text (issue #157)", () => {
  test("names the reason, each error and the device's WebGL details", () => {
    expect(
      startupReportText({
        reason: "the WebGL context was lost and not restored within 3 seconds",
        errors: ["WebGL context lost"],
        webgl: {
          version: "WebGL 2",
          renderer: "Adreno (TM) 740",
          vendor: "Qualcomm",
          maxTextureSize: 4096,
          maxTextureUnits: 16,
        },
        devicePixelRatio: 3,
        screen: "412x915",
        userAgent: "Mozilla/5.0 (Linux; Android 14) EdgA/129",
      }),
    ).toBe(
      [
        "The game could not draw on this device.",
        "Reason: the WebGL context was lost and not restored within 3 seconds",
        "Error: WebGL context lost",
        "WebGL: WebGL 2 · Adreno (TM) 740 (Qualcomm) · max texture 4096 · texture units 16",
        "Screen: 412x915 at device pixel ratio 3",
        "Browser: Mozilla/5.0 (Linux; Android 14) EdgA/129",
      ].join("\n"),
    );
  });

  test("says so when WebGL does not start at all", () => {
    const text = startupReportText({
      reason: "an error stopped the game before its first screen",
      errors: [],
      webgl: null,
      devicePixelRatio: 2,
      screen: "390x844",
      userAgent: "test",
    });
    expect(text.split("\n")).toContain("WebGL: not available");
  });
});

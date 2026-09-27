import { describe, expect, test } from "vitest";
import type Phaser from "phaser";
import { wipeFrame, wipeTimingFor } from "../view/phase-wipe.js";
import { syncSceneClock } from "./scene-clock.js";

type ClockedScene = Pick<Phaser.Scene, "time" | "game">;

function sceneAt(clockNow: number, loopTime: number): ClockedScene {
  return { time: { now: clockNow }, game: { loop: { time: loopTime } } } as unknown as ClockedScene;
}

describe("syncSceneClock", () => {
  test("brings a stale scene clock up to the game loop's current time", () => {
    const scene = sceneAt(16, 42_000);
    syncSceneClock(scene);
    expect(scene.time.now).toBe(42_000);
  });

  test("the opening band timed at create still plays once the first frame arrives", () => {
    const slideMs = 300;
    const timing = wipeTimingFor(true, 250);
    // The Board booted with the game (~16ms) and starts 42s later, after Title, the comic and the mulligan.
    const frameTime = 42_000;
    const stale = sceneAt(16, frameTime);
    const staleStart = stale.time.now + timing.delayMs;
    // Without the sync, the band is already over by the time the delay has run out.
    expect(wipeFrame(frameTime + timing.delayMs - staleStart, slideMs, timing.holdMs)).toBeNull();

    const synced = sceneAt(16, frameTime);
    syncSceneClock(synced);
    const start = synced.time.now + timing.delayMs;
    expect(wipeFrame(frameTime + timing.delayMs - start, slideMs, timing.holdMs)?.stage).toBe("in");
  });
});

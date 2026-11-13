import { describe, expect, test } from "vitest";
import type { ReplayMoment } from "./replay-cursor.js";
import {
  STOPPED,
  bannerOf,
  nextMoment,
  nextSpeed,
  playFrom,
  positionAtX,
  previousMoment,
  roundAt,
  scrubSteps,
  seekMarkers,
  stepDelayMs,
  tickAutoPlay,
  transportLayout,
} from "./replay-transport-model.js";

const moment = (commandIndex: number, round: number, kind: ReplayMoment["kind"]): ReplayMoment => ({
  commandIndex,
  round,
  label: `${kind} ${round}`,
  kind,
});
const MOMENTS = [moment(0, 1, "start"), moment(10, 1, "villainPhase"), moment(14, 2, "round"), moment(30, 3, "round")];

describe("replay transport model", () => {
  test("speeds cycle 1x, 2x, 4x and shorten the step interval", () => {
    expect(nextSpeed(1)).toBe(2);
    expect(nextSpeed(2)).toBe(4);
    expect(nextSpeed(4)).toBe(1);
    expect(stepDelayMs(1)).toBe(1200);
    expect(stepDelayMs(4)).toBe(300);
  });

  test("finds the round at a position and the neighbouring moments", () => {
    expect(roundAt(MOMENTS, 0)).toBe(1);
    expect(roundAt(MOMENTS, 14)).toBe(2);
    expect(roundAt(MOMENTS, 29)).toBe(2);
    expect(previousMoment(MOMENTS, 14)).toBe(10);
    expect(previousMoment(MOMENTS, 15)).toBe(14);
    expect(previousMoment(MOMENTS, 3)).toBe(0);
    expect(nextMoment(MOMENTS, 14, 50)).toBe(30);
    expect(nextMoment(MOMENTS, 30, 50)).toBe(50);
  });

  test("marks rounds tall and phases short, and none at the ends", () => {
    const markers = seekMarkers(MOMENTS, 30);
    expect(markers.map((m) => [m.commandIndex, m.major])).toEqual([
      [10, false],
      [14, true],
    ]);
    expect(markers[1]!.fraction).toBeCloseTo(14 / 30);
  });

  test("maps a pointer to a position, clamped to the track", () => {
    expect(positionAtX(150, 100, 200, 100)).toBe(25);
    expect(positionAtX(0, 100, 200, 100)).toBe(0);
    expect(positionAtX(999, 100, 200, 100)).toBe(100);
    expect(positionAtX(5, 0, 0, 100)).toBe(0);
  });

  test("the banner names the most serious problem first, in 1-based command numbers", () => {
    expect(bannerOf({ otherBuild: true, divergedAt: 4, failure: { commandIndex: 9 } })).toEqual({
      kind: "failure",
      n: 10,
    });
    expect(bannerOf({ otherBuild: true, divergedAt: 4, failure: null })).toEqual({ kind: "diverged", n: 4 });
    expect(bannerOf({ otherBuild: true, divergedAt: null, failure: null })?.kind).toBe("otherBuild");
    expect(bannerOf({ otherBuild: false, divergedAt: null, failure: null })).toBeNull();
  });

  test("autoplay steps once per interval, waits on the board, and stops at the end", () => {
    const context = { speed: 2 as const, waiting: false, position: 3, length: 10 };
    let state = { playing: true, elapsedMs: 0 };
    let result = tickAutoPlay(state, 400, context);
    expect(result.step).toBe(false);
    result = tickAutoPlay(result.state, 250, context);
    expect(result.step).toBe(true);
    expect(result.state.elapsedMs).toBe(0);
    // Waiting on an animation or the villain phase holds the clock at zero.
    state = { playing: true, elapsedMs: 500 };
    expect(tickAutoPlay(state, 100, { ...context, waiting: true })).toEqual({
      state: { playing: true, elapsedMs: 0 },
      step: false,
    });
    expect(tickAutoPlay(state, 100, { ...context, position: 10 }).state).toEqual(STOPPED);
    expect(tickAutoPlay(STOPPED, 5000, context).step).toBe(false);
  });

  test("playing from the end starts over", () => {
    expect(playFrom(10, 10).restart).toBe(true);
    expect(playFrom(9, 10).restart).toBe(false);
  });

  test("a held scrub waits, then repeats faster", () => {
    expect(scrubSteps(100, 0)).toBe(0);
    expect(scrubSteps(0, -1)).toBe(1);
    expect(scrubSteps(400, 0)).toBe(1);
    expect(scrubSteps(1600, 1550)).toBe(3);
  });

  test("lays the bar out as one row when wide and two when stacked, every control inside it", () => {
    for (const [bar, kind] of [
      [{ x: 0, y: 700, width: 1280, height: 56 }, "row"],
      [{ x: 0, y: 700, width: 1024, height: 56 }, "row"],
      [{ x: 0, y: 700, width: 667, height: 56 }, "row"],
      [{ x: 0, y: 700, width: 768, height: 96 }, "stacked"],
      [{ x: 0, y: 700, width: 375, height: 96 }, "stacked"],
    ] as const) {
      const layout = transportLayout(bar);
      expect(layout.kind).toBe(kind);
      for (const [id, rect] of layout.controls) {
        expect(rect.x, id).toBeGreaterThanOrEqual(bar.x);
        expect(rect.x + rect.width, id).toBeLessThanOrEqual(bar.x + bar.width);
        expect(rect.y, id).toBeGreaterThanOrEqual(bar.y);
        expect(rect.y + rect.height, id).toBeLessThanOrEqual(bar.y + bar.height);
        expect(rect.height, id).toBeGreaterThanOrEqual(36);
      }
      expect(layout.seek.width).toBeGreaterThan(60);
      expect(layout.seek.x + layout.seek.width).toBeLessThanOrEqual(bar.x + bar.width);
      // No two controls overlap.
      const rects = [...layout.controls.values(), layout.seek];
      for (const [i, a] of rects.entries())
        for (const b of rects.slice(i + 1))
          expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height).toBe(
            false,
          );
    }
  });
});

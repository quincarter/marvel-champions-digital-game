import { describe, expect, it } from "vitest";
import type { GameEvent } from "@mc/engine";
import { PHASE_WIPE_HOLD_MS, phaseTransitionFrom, wipeFrame } from "./phase-wipe.js";

const stepChanged = (fromPhase: string, toPhase: string): GameEvent =>
  ({ type: "stepChanged", from: { phase: fromPhase } as never, to: { phase: toPhase } as never }) as GameEvent;

const roundStarted = (round: number): GameEvent => ({ type: "roundStarted", round });

describe("phaseTransitionFrom", () => {
  it("is null when nothing crossed a phase boundary", () => {
    expect(phaseTransitionFrom([])).toBeNull();
    expect(phaseTransitionFrom([stepChanged("villain", "villain")])).toBeNull();
  });

  it("captions a crossing into the villain phase, carrying no round", () => {
    const transition = phaseTransitionFrom([stepChanged("player", "villain")]);
    expect(transition).toEqual({ to: "villain", round: null, caption: "VILLAIN PHASE" });
  });

  it("captions a crossing into the player phase with the round from the same batch", () => {
    const transition = phaseTransitionFrom([roundStarted(3), stepChanged("villain", "player")]);
    expect(transition).toEqual({ to: "player", round: 3, caption: "ROUND 3 · PLAYER PHASE" });
  });

  it("falls back to a bare caption crossing into the player phase with no roundStarted in the batch", () => {
    const transition = phaseTransitionFrom([stepChanged("villain", "player")]);
    expect(transition).toEqual({ to: "player", round: null, caption: "PLAYER PHASE" });
  });

  it("fires on the game's first setup -> player crossing", () => {
    const transition = phaseTransitionFrom([roundStarted(1), stepChanged("setup", "player")]);
    expect(transition?.caption).toBe("ROUND 1 · PLAYER PHASE");
  });

  it("ignores a crossing into game over", () => {
    expect(phaseTransitionFrom([stepChanged("villain", "gameOver")])).toBeNull();
  });

  it("ignores step changes that stay within the villain phase", () => {
    expect(phaseTransitionFrom([stepChanged("villain", "villain"), roundStarted(2)])).toBeNull();
  });
});

describe("wipeFrame", () => {
  const slideMs = 420;

  it("is in the 'in' stage for the first slide window", () => {
    expect(wipeFrame(0, slideMs)?.stage).toBe("in");
    expect(wipeFrame(0, slideMs)?.progress).toBe(0);
    expect(wipeFrame(slideMs - 1, slideMs)?.stage).toBe("in");
  });

  it("holds at full width for PHASE_WIPE_HOLD_MS", () => {
    const atHoldStart = wipeFrame(slideMs, slideMs);
    expect(atHoldStart?.stage).toBe("hold");
    expect(atHoldStart?.progress).toBe(0);
    const atHoldEnd = wipeFrame(slideMs + PHASE_WIPE_HOLD_MS - 1, slideMs);
    expect(atHoldEnd?.stage).toBe("hold");
  });

  it("slides out after the hold", () => {
    const frame = wipeFrame(slideMs + PHASE_WIPE_HOLD_MS, slideMs);
    expect(frame?.stage).toBe("out");
    expect(frame?.progress).toBe(0);
    const almostDone = wipeFrame(slideMs + PHASE_WIPE_HOLD_MS + slideMs - 1, slideMs);
    expect(almostDone?.stage).toBe("out");
  });

  it("is null once the whole timeline has elapsed", () => {
    expect(wipeFrame(slideMs * 2 + PHASE_WIPE_HOLD_MS, slideMs)).toBeNull();
    expect(wipeFrame(slideMs * 2 + PHASE_WIPE_HOLD_MS + 1000, slideMs)).toBeNull();
  });

  it("recomputes correctly for a redraw mid-flight (same elapsed time, called again)", () => {
    const first = wipeFrame(100, slideMs);
    const second = wipeFrame(100, slideMs);
    expect(second).toEqual(first);
  });
});

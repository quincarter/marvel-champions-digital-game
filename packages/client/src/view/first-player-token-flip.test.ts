import { describe, expect, it } from "vitest";
import { FLIGHT_SAMPLES, flightFrom } from "./first-player-token-flip.js";
import { tokenMotionDurationMs } from "./first-player-token-motion.js";

describe("flightFrom", () => {
  const from = { x: -300, y: 40 };

  it("plays the style's own duration, from the old place to rest, upright at its own size", () => {
    const flight = flightFrom("toss", from)!;
    expect(flight.durationMs).toBe(tokenMotionDurationMs("toss", from, { x: 0, y: 0 }));
    expect(flight.frames).toHaveLength(FLIGHT_SAMPLES + 1);
    expect(flight.frames[0]).toMatchObject({ x: -300, y: 40, lift: 0 });
    expect(flight.frames.at(-1)).toEqual({ x: 0, y: 0, lift: 0, scaleX: 1, scaleY: 1, angle: 0 });
  });

  it("rises above the straight line on a toss (lift and a smaller y)", () => {
    const flight = flightFrom("toss", from)!;
    expect(Math.max(...flight.frames.map((f) => f.lift))).toBeGreaterThan(36);
    expect(Math.min(...flight.frames.map((f) => f.y))).toBeLessThan(0);
  });

  it("grows toward the viewer at the top of a toss", () => {
    const flight = flightFrom("toss", from)!;
    expect(Math.max(...flight.frames.map((f) => f.scaleX))).toBeGreaterThan(1.2);
  });

  it("has no flight for the instant style, or when the token did not move", () => {
    expect(flightFrom("instant", from)).toBeNull();
    expect(flightFrom("toss", null)).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import { FIRST_PLAYER_TOKEN_MOTION_VALUES } from "../settings.js";
import {
  effectiveTokenMotion,
  tokenMotionDurationMs,
  tokenMotionFrame,
  tossArcHeight,
} from "./first-player-token-motion.js";

const FROM = { x: 100, y: 400 };
const TO = { x: 700, y: 400 };

describe("first player token motion", () => {
  test("every style starts at the old first player and rests upright on the new one", () => {
    for (const style of FIRST_PLAYER_TOKEN_MOTION_VALUES) {
      const end = tokenMotionFrame(style, FROM, TO, 1);
      expect(end, style).toEqual({ x: 700, y: 400, lift: 0, scaleX: 1, scaleY: 1, angle: 0 });
      if (style === "instant") continue;
      const start = tokenMotionFrame(style, FROM, TO, 0);
      expect(start.x, style).toBeCloseTo(100);
      expect(start.y + start.lift, style).toBeCloseTo(400);
    }
  });

  test("a toss rises in an arc over the table and comes down with a small bounce", () => {
    const top = tokenMotionFrame("toss", FROM, TO, 0.4);
    expect(top.lift).toBeCloseTo(tossArcHeight(FROM, TO));
    expect(top.y).toBeLessThan(400 - 100);
    expect(top.scaleX).toBeGreaterThan(1.3);
    const landed = tokenMotionFrame("toss", FROM, TO, 0.8);
    expect(landed.x).toBeCloseTo(700);
    expect(landed.lift).toBeCloseTo(0);
    const hop = tokenMotionFrame("toss", FROM, TO, 0.9);
    expect(hop.lift).toBeGreaterThan(0);
    expect(hop.lift).toBeLessThanOrEqual(16);
  });

  test("a slide stays on the table the whole way", () => {
    for (let t = 0; t <= 1; t += 0.1) expect(tokenMotionFrame("slide", FROM, TO, t).lift).toBe(0);
  });

  test("a bounce hops lower each time", () => {
    const peaks = [0.21, 0.58, 0.87].map((t) => tokenMotionFrame("bounce", FROM, TO, t).lift);
    expect(peaks[0]).toBeGreaterThan(peaks[1]!);
    expect(peaks[1]).toBeGreaterThan(peaks[2]!);
  });

  test("a spin flips the token on its edge", () => {
    const flips = [0.05, 0.08, 0.12].map((t) => tokenMotionFrame("spin", FROM, TO, t).scaleX);
    expect(Math.min(...flips)).toBeLessThan(0);
  });

  test("Reduced motion always places the token", () => {
    expect(effectiveTokenMotion({ reducedMotion: true, firstPlayerTokenMotion: "toss" })).toBe("instant");
    expect(effectiveTokenMotion({ reducedMotion: false, firstPlayerTokenMotion: "slide" })).toBe("slide");
    expect(tokenMotionDurationMs("instant", FROM, TO)).toBe(0);
  });

  test("a longer throw takes a little longer, within limits", () => {
    const near = tokenMotionDurationMs("toss", FROM, { x: 150, y: 400 });
    const far = tokenMotionDurationMs("toss", FROM, TO);
    const huge = tokenMotionDurationMs("toss", FROM, { x: 5000, y: 400 });
    expect(far).toBeGreaterThan(near);
    expect(huge).toBeLessThanOrEqual(1000);
  });
});

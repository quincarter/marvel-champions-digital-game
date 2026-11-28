import { describe, expect, it } from "vitest";
import { flightKeyframes, flipOffset, shadowFade } from "./token-motion.js";
import type { TokenFlight, TokenRect } from "./mc-first-player-token.types.js";

const rect = (x: number, y: number, size = 40): TokenRect => ({ x, y, width: size, height: size });

describe("flipOffset", () => {
  it("is where the token was, as an offset from where it rests now (centre to centre)", () => {
    expect(flipOffset(rect(100, 50), rect(400, 80))).toEqual({ x: -300, y: -30 });
  });

  it("ignores a different size: only the centres count", () => {
    expect(flipOffset(rect(100, 100, 40), rect(110, 110, 20))).toBeNull();
  });

  it("is null with no earlier place, and when the token did not move", () => {
    expect(flipOffset(null, rect(10, 10))).toBeNull();
    expect(flipOffset(rect(10, 10), rect(10.2, 10.2))).toBeNull();
  });
});

describe("flightKeyframes", () => {
  const flight: TokenFlight = {
    durationMs: 640,
    frames: [
      { x: -300, y: 0, lift: 0, scaleX: 1, scaleY: 1, angle: 0 },
      { x: -150, y: -120, lift: 120, scaleX: 1.35, scaleY: 1.35, angle: 180 },
      { x: 0, y: 0, lift: 0, scaleX: 1, scaleY: 1, angle: 0 },
    ],
  };

  it("writes only transform and opacity, spaced evenly from the old place to rest", () => {
    const { token, shadow } = flightKeyframes(flight);
    expect(token.map((k) => k.offset)).toEqual([0, 0.5, 1]);
    for (const k of [...token, ...shadow])
      for (const prop of Object.keys(k)) expect(["offset", "transform", "opacity"]).toContain(prop);
    expect(token[0]!.transform).toBe("translate(-300px, 0px) rotate(0deg) scale(1, 1)");
    expect(token[2]!.transform).toBe("translate(0px, 0px) rotate(0deg) scale(1, 1)");
  });

  it("keeps the shadow on the table under the token and fades it as the token rises", () => {
    const { shadow } = flightKeyframes(flight);
    // At the top of the arc the token is 120px up (y -120), so the ground point is back at y 0.
    expect(shadow[1]!.transform).toBe(`translate(-150px, 0px) scale(${shadowFade(120)})`);
    expect(shadow[1]!.opacity).toBeLessThan(shadow[0]!.opacity as number);
    expect(shadowFade(1000)).toBe(0.12);
  });
});

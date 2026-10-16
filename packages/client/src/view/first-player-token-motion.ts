/**
 * The first player token's flight between two seats: the physical game's token, thrown, slid or bounced across the
 * table to whoever is first player now (the owner, 2026-10-16). Pure math, so each style can be tested frame by frame;
 * `ui/first-player-token.ts` draws the token and plays these frames.
 */

import type { FirstPlayerTokenMotion } from "../settings.js";
import { lerp } from "./motion-math.js";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the token is and how it is held at one moment of a flight. `angle` is degrees; `scaleX` is the spin's flip.
 * `lift` is how far above the table it is, so its shadow can stay on the table at `y + lift`.
 */
export interface TokenFrame {
  readonly x: number;
  readonly y: number;
  readonly lift: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly angle: number;
}

export const FIRST_PLAYER_TOKEN_MOTION_LABELS: Readonly<Record<FirstPlayerTokenMotion, string>> = {
  toss: "Toss",
  slide: "Slide",
  bounce: "Bounce",
  spin: "Spin",
  instant: "Instant",
};

/** The style a flight actually plays: Reduced motion always places the token without moving it. */
export function effectiveTokenMotion(settings: {
  readonly reducedMotion: boolean;
  readonly firstPlayerTokenMotion: FirstPlayerTokenMotion;
}): FirstPlayerTokenMotion {
  return settings.reducedMotion ? "instant" : settings.firstPlayerTokenMotion;
}

/** How long a flight takes: a longer throw takes a little longer, within limits so neither end drags. 0 for instant. */
export function tokenMotionDurationMs(style: FirstPlayerTokenMotion, from: Point, to: Point): number {
  if (style === "instant") return 0;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const base = style === "slide" ? 420 : style === "bounce" ? 760 : 640;
  return Math.round(base + Math.min(320, distance * 0.35));
}

/** How high a throw rises over the straight line between its ends: higher for a longer throw, never flat. */
export function tossArcHeight(from: Point, to: Point): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.min(180, 36 + distance * 0.4);
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

/** The token at `t` (0 to 1, clamped) of a flight from `from` to `to`. Every style starts at `from` and rests at `to`, upright at scale 1. */
export function tokenMotionFrame(style: FirstPlayerTokenMotion, from: Point, to: Point, t: number): TokenFrame {
  const p = Math.min(1, Math.max(0, t));
  const at = (k: number, lift = 0): Pick<TokenFrame, "x" | "y" | "lift"> => ({
    x: lerp(from.x, to.x, k),
    y: lerp(from.y, to.y, k) - lift,
    lift,
  });
  // Every style rests exactly where it lands, upright and at its own size.
  if (style === "instant" || p >= 1) return { x: to.x, y: to.y, lift: 0, scaleX: 1, scaleY: 1, angle: 0 };
  switch (style) {
    case "slide": {
      // Pushed across the felt: quick start, a slow stop, and a small wobble as it settles.
      const k = easeOutCubic(p);
      return { ...at(k), scaleX: 1, scaleY: 1, angle: Math.sin(p * Math.PI) * 14 * (1 - p) };
    }
    case "bounce": {
      // Three hops along the line, each lower than the last.
      const k = easeInOutSine(p);
      const hops = [0.42, 0.74, 1];
      const heights = [tossArcHeight(from, to) * 0.55, tossArcHeight(from, to) * 0.25, 10];
      let start = 0;
      let lift = 0;
      let squash = 1;
      for (let i = 0; i < hops.length; i += 1) {
        const end = hops[i]!;
        if (p <= end) {
          const local = (p - start) / (end - start);
          lift = Math.sin(local * Math.PI) * heights[i]!;
          // Flattens a touch on each landing, and springs back as it leaves the felt.
          squash = 1 - 0.15 * Math.max(0, 1 - Math.min(local, 1 - local) * 10);
          break;
        }
        start = end;
      }
      return { ...at(k, lift), scaleX: 1 + (1 - squash) * 0.6, scaleY: squash, angle: 0 };
    }
    case "spin": {
      // A flat flick: the token spins on its edge (a coin flip) on a low arc.
      const k = easeInOutSine(p);
      const lift = Math.sin(p * Math.PI) * tossArcHeight(from, to) * 0.45;
      const flips = 3;
      const scaleX = Math.cos(p * Math.PI * 2 * flips);
      return { ...at(k, lift), scaleX, scaleY: 1, angle: 0 };
    }
    case "toss": {
      // Thrown: up in an arc, turning as it flies and growing toward the viewer at the top, then a small bounce.
      const flight = 0.8;
      if (p < flight) {
        const local = p / flight;
        const k = easeInOutSine(local);
        const lift = Math.sin(local * Math.PI) * tossArcHeight(from, to);
        const grow = 1 + 0.35 * Math.sin(local * Math.PI);
        return { ...at(k, lift), scaleX: grow, scaleY: grow, angle: 360 * easeOutCubic(local) };
      }
      const local = (p - flight) / (1 - flight);
      const lift = Math.sin(local * Math.PI) * Math.min(16, tossArcHeight(from, to) * 0.12);
      return { ...at(1, lift), scaleX: 1, scaleY: 1, angle: 0 };
    }
  }
}

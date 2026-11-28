/**
 * The first player token's flight as a FLIP animation: the token is placed at its new seat, and this samples the throw from
 * where it was (an offset from the new place) so the panel can play it as a transform. Pure, over the same per-style frame
 * math the board's token flies by (`view/first-player-token-motion.ts`), so the timing, the arc, the spin and the bounce are
 * the ones the player chose in Settings.
 */
import type { TokenFlight, TokenPoint } from "@mc/ui";
import type { FirstPlayerTokenMotion } from "../settings.js";
import { tokenMotionDurationMs, tokenMotionFrame } from "./first-player-token-motion.js";

/** How many frames a flight is sampled into: enough for the arc and the bounces to read smooth over linear steps. */
export const FLIGHT_SAMPLES = 32;

const REST: TokenPoint = { x: 0, y: 0 };

/** The flight from `from` (an offset from the resting place) to rest, or null for an instant style or no move. */
export function flightFrom(style: FirstPlayerTokenMotion, from: TokenPoint | null): TokenFlight | null {
  if (!from) return null;
  const durationMs = tokenMotionDurationMs(style, from, REST);
  if (durationMs <= 0) return null;
  const frames = Array.from({ length: FLIGHT_SAMPLES + 1 }, (_, i) =>
    tokenMotionFrame(style, from, REST, i / FLIGHT_SAMPLES),
  );
  return { frames, durationMs };
}

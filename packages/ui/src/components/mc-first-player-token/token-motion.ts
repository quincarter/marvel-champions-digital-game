import type { TokenFlight, TokenPoint, TokenRect } from "./mc-first-player-token.types.js";

/** The token's centre. */
const centreOf = (rect: TokenRect): TokenPoint => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

/**
 * FLIP's "invert": where the token was, as an offset from where it rests now (the new place is placed first, then the
 * token is moved back over this offset and eased to zero). Null when it did not move, or had no earlier place.
 */
export function flipOffset(before: TokenRect | null, after: TokenRect): TokenPoint | null {
  if (!before) return null;
  const a = centreOf(before);
  const b = centreOf(after);
  const x = a.x - b.x;
  const y = a.y - b.y;
  return Math.abs(x) < 0.5 && Math.abs(y) < 0.5 ? null : { x, y };
}

/** The shadow shrinks and fades as the token rises. */
export const shadowFade = (lift: number): number => Math.max(0.12, 1 - lift / 160);

/** The token's and its shadow's keyframes for a flight: transform and opacity only, so it never lays out. */
export function flightKeyframes(flight: TokenFlight): { readonly token: Keyframe[]; readonly shadow: Keyframe[] } {
  const last = Math.max(1, flight.frames.length - 1);
  const token: Keyframe[] = [];
  const shadow: Keyframe[] = [];
  flight.frames.forEach((f, i) => {
    const offset = i / last;
    token.push({
      offset,
      transform: `translate(${f.x}px, ${f.y}px) rotate(${f.angle}deg) scale(${f.scaleX}, ${f.scaleY})`,
    });
    const fade = shadowFade(f.lift);
    shadow.push({
      offset,
      transform: `translate(${f.x}px, ${f.y + f.lift}px) scale(${fade})`,
      opacity: fade,
    });
  });
  return { token, shadow };
}

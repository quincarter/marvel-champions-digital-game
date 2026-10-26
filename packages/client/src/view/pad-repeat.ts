/**
 * The timing and stick decisions behind controller navigation, pure so they are testable with fake time.
 *
 * Phaser's gamepad plugin reports a button once per press and knows nothing of a held D-pad or a leaning stick, so
 * `scenes/board/input.ts#bindGamepad` polls each frame and asks this module what, if anything, to do: which
 * direction a D-pad plus left stick mean, whether a held direction is due to fire again, and how far the right stick
 * scrolls. The scene only wires the answers to `onIntent` / `onScroll`.
 */

import type { FocusDirection } from "./spatial-nav.js";

/** The first repeat of a held direction waits this long (a deliberate hold, not a slow tap)... */
export const PAD_REPEAT_FIRST_MS = 400;
/** ...then it repeats at this interval, fast enough to cross a row of cards without button-mashing. */
export const PAD_REPEAT_EVERY_MS = 110;

/** A stick must lean this far on its dominant axis to count as pressed... */
export const STICK_ENGAGE = 0.5;
/** ...and stays pressed until it falls below this, so a stick resting near the edge doesn't chatter. */
export const STICK_RELEASE = 0.35;
/** The right stick is a scroll, not a press: it starts moving the view past this radial deadzone (worn sticks drift, and drift must not scroll forever or force pad mode). */
export const SCROLL_DEADZONE = 0.25;
/** Content scrolled per second at full deflection, in pixels. */
export const SCROLL_SPEED_PX_PER_S = 900;

/**
 * The direction a left-stick vector means, or null for centre. `previous` is what it meant last frame: it lowers the
 * bar to stay engaged (hysteresis), and a diagonal only flips to the other axis once that axis clearly leads, so a
 * stick pushed up-right doesn't alternate between up and right every frame.
 */
export function stickDirection(x: number, y: number, previous: FocusDirection | null): FocusDirection | null {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (Math.max(ax, ay) < (previous === null ? STICK_ENGAGE : STICK_RELEASE)) return null;
  const horizontal = (direction: FocusDirection | null): boolean => direction === "left" || direction === "right";
  let useX = ax >= ay;
  // Stay on the held axis unless the other one leads by a margin.
  if (previous !== null) {
    const held = horizontal(previous) ? ax : ay;
    const other = horizontal(previous) ? ay : ax;
    useX = horizontal(previous) ? !(other > held + 0.15) : other > held + 0.15;
  }
  return useX ? (x < 0 ? "left" : "right") : y < 0 ? "up" : "down";
}

/** The right stick as a scroll velocity in -1..1 per axis, rescaled so it ramps up from the deadzone edge; null at rest. */
export function scrollVector(x: number, y: number): { readonly x: number; readonly y: number } | null {
  const magnitude = Math.hypot(x, y);
  if (magnitude < SCROLL_DEADZONE) return null;
  const scaled = Math.min(1, (magnitude - SCROLL_DEADZONE) / (1 - SCROLL_DEADZONE));
  return { x: (x / magnitude) * scaled, y: (y / magnitude) * scaled };
}

/** Pixels to scroll this frame for a stick vector and the frame's time, or null when the stick is at rest. */
export function scrollDelta(x: number, y: number, dtMs: number): { readonly dx: number; readonly dy: number } | null {
  const vector = scrollVector(x, y);
  if (vector === null) return null;
  const seconds = dtMs / 1000;
  return { dx: vector.x * SCROLL_SPEED_PX_PER_S * seconds, dy: vector.y * SCROLL_SPEED_PX_PER_S * seconds };
}

/**
 * One held-direction repeater. Feed it the direction held this frame (D-pad winning over the stick) and the clock; it
 * returns the direction to act on now, or null.
 *
 *  - A new direction fires at once, then again after `PAD_REPEAT_FIRST_MS`, then every `PAD_REPEAT_EVERY_MS`.
 *  - Releasing, or changing direction, restarts the timing.
 *  - While `enabled` is false (an overlay owns input) nothing fires, and whatever is held then is remembered as
 *    pressed-before-the-block: it must be released before it counts again, so a press that began under an overlay
 *    never starts repeating when the overlay closes.
 *  - A direction already held on the first frame is treated the same way.
 *  - A long frame fires once, not once per missed interval, so a hitch can't skip the focus across the board.
 */
export interface PadRepeater {
  update(held: FocusDirection | null, nowMs: number, enabled: boolean): FocusDirection | null;
}

export function createPadRepeater(): PadRepeater {
  let current: FocusDirection | null = null;
  let nextAt = 0;
  let suppressed: FocusDirection | null = null;
  let first = true;
  return {
    update(held, nowMs, enabled) {
      // Whatever is already held when the scene binds began before it: it must be released first (as Phaser's own
      // Button seeds isPressed), or a held D-pad would fire and repeat on a new scene's first frame.
      if (first) {
        first = false;
        suppressed = held;
      }
      if (!enabled) {
        suppressed = held;
        current = null;
        return null;
      }
      if (held === null || held !== suppressed) suppressed = null;
      if (held === null || held === suppressed) {
        current = null;
        return null;
      }
      if (held !== current) {
        current = held;
        nextAt = nowMs + PAD_REPEAT_FIRST_MS;
        return held;
      }
      if (nowMs < nextAt) return null;
      // Keep the cadence steady against frame jitter; after a hitch, don't leave a backlog.
      nextAt += PAD_REPEAT_EVERY_MS;
      if (nextAt <= nowMs) nextAt = nowMs + PAD_REPEAT_EVERY_MS;
      return held;
    },
  };
}

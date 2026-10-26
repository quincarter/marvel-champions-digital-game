/**
 * A bumper held as a pick modifier (`view/pick-assign.ts`): while a direct pick is open, LB / RB wait instead of firing
 * their zone jump or page turn on press. A face button pressed under one picks a target and marks the bumper used; on
 * release an unused bumper fires its own meaning, so a quick tap keeps its old behavior and a combo never also jumps.
 *
 * Pure, with the clock passed in; `scenes/board/input.ts` feeds it the pad's presses and releases.
 */

import type { PickBumper } from "./pad-layer-bindings.js";
import { HOLD_MS } from "./pad-hold-tap.js";

export interface BumperHold {
  /** The bumper held now, or null. */
  held(): PickBumper | null;
  /** A bumper went down while a pick is open: "held" when it is the modifier, "swallowed" when another is already held. */
  press(pad: number, meaning: number, bumper: PickBumper, now: number): "held" | "swallowed";
  /** A face button went down: the held bumper (now used), or null when none is held. */
  face(): PickBumper | null;
  /** A trigger combo was made while a bumper was held: its release must not also fire the bumper's own meaning. */
  markUsed(): void;
  /**
   * The release of a button: `released` when it was the held bumper, and `tap` when its own meaning should fire now
   * (unused, and the pick is still open or the press was a quick one).
   */
  release(pad: number, meaning: number, now: number, pickOpen: boolean): { released: boolean; tap: boolean };
  /** Forget the hold (the screen was blocked). True when one was held. */
  cancel(): boolean;
}

export function createBumperHold(tapMs: number = HOLD_MS): BumperHold {
  let hold: { pad: number; meaning: number; bumper: PickBumper; at: number; used: boolean } | null = null;
  return {
    held: () => hold?.bumper ?? null,
    press(pad, meaning, bumper, now) {
      if (hold) return "swallowed";
      hold = { pad, meaning, bumper, at: now, used: false };
      return "held";
    },
    face() {
      if (!hold) return null;
      hold.used = true;
      return hold.bumper;
    },
    markUsed() {
      if (hold) hold.used = true;
    },
    release(pad, meaning, now, pickOpen) {
      if (!hold || hold.pad !== pad || hold.meaning !== meaning) return { released: false, tap: false };
      const done = hold;
      hold = null;
      return { released: true, tap: !done.used && (pickOpen || now - done.at < tapMs) };
    },
    cancel() {
      const was = hold !== null;
      hold = null;
      return was;
    },
  };
}

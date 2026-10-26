/**
 * A pad press that began while something else owned the pad is not the screen's to act on.
 *
 * The case it exists for: a sheet over the Board (End turn's confirm, the take-back and unlock confirms) switches the
 * Board's input off while it is up, so the Board's pad plugin stops polling. The press that answers the sheet (Start)
 * closes it, and the Board's plugin, polling again with the button still held and its old state saying "up", reports a
 * fresh `down` for it one frame later. The Board is no longer blocked by then, so the same Start also opened Pause.
 *
 * Phaser builds a Button as already pressed for a button held when the pad connects, for the same reason. This is that,
 * for a screen that was held: a screen records each frame it was held (`noteHeld`), and a `down` within a couple of
 * frames after is the tail of a press the owner already took (`allows` says no). The window is frames, not time, so a
 * slow machine gets the same answer as a fast one; a person cannot release and press a button again that quickly.
 */

/** Frames after the last held one in which a `down` still counts as the press that began under the owner. */
export const PRESS_GUARD_FRAMES = 2;

export interface PressGuard {
  /** This frame the screen was held (blocked, or its input switched off). */
  noteHeld(frame: number): void;
  /** False for a `down` at `frame` that belongs to a press which began while the screen was held. */
  allows(frame: number): boolean;
}

export function createPressGuard(): PressGuard {
  let lastHeld = Number.NEGATIVE_INFINITY;
  return {
    noteHeld: (frame) => {
      lastHeld = Math.max(lastHeld, frame);
    },
    allows: (frame) => frame - lastHeld > PRESS_GUARD_FRAMES,
  };
}

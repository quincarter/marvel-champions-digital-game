/**
 * A pad press that began while something else owned the pad is not the screen's to act on.
 *
 * The case it exists for: a sheet over the Board (End turn's confirm, the take-back and unlock confirms) switches the
 * Board's input off while it is up, so the Board's pad plugin stops polling. The press that answers the sheet (Start)
 * closes it, and the Board's plugin, polling again with the button still held and its old state saying "up", reports a
 * fresh `down` for it one frame later. The Board is no longer blocked by then, so the same Start also opened Pause.
 *
 * Phaser builds a Button as already pressed for a button held when the pad connects, for the same reason. This is that,
 * for a screen that was held: each frame it was held, the screen records which buttons were down on the pad itself
 * (`noteHeld`, from the live `navigator.getGamepads()`, since its own plugin was not polling), and a `down` within a couple
 * of frames after, for a button that was already down then, is the tail of a press the owner already took (`allows`
 * says no). A button that was up while the screen was held is a new press and always goes through, however soon: only
 * the stale one is dropped. The window is frames, not time, so a slow machine gets the same answer as a fast one.
 */

/** Frames after the last held one in which a `down` still counts as the press that began under the owner. */
export const PRESS_GUARD_FRAMES = 2;

export interface PressGuard {
  /** This frame the screen was held (blocked, or its input switched off), with the buttons down on the pad then. */
  noteHeld(frame: number, pressed: readonly number[]): void;
  /** False for a `down` of `button` at `frame` that belongs to a press which began while the screen was held. */
  allows(frame: number, button: number): boolean;
}

export function createPressGuard(): PressGuard {
  let lastHeld = Number.NEGATIVE_INFINITY;
  let downThen = new Set<number>();
  return {
    noteHeld: (frame, pressed) => {
      if (frame < lastHeld) return;
      lastHeld = frame;
      downThen = new Set(pressed);
    },
    allows: (frame, button) => frame - lastHeld > PRESS_GUARD_FRAMES || !downThen.has(button),
  };
}

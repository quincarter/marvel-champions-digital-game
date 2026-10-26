/**
 * One pad press can reach two scenes: the choice sheet over the villain phase and the phase's own route both hear R3 (or
 * View). The sheet's COLLAPSE docks the decision and drops the sheet, so by the time the phase's route asks whether it is
 * blocked the sheet is gone, and the same press EXPANDs the decision again: the owner saw it start to collapse, flicker and
 * come back. A toggle (EXPAND, COLLAPSE, PEEK) stamps its time; a second toggle press in the same game frame is the same press (keyboard X / P too).
 */

/** True when a toggle arrives in the very game frame of the last one: the same press heard a second time. A frame count, not a clock, so a slow device answers as a fast one does. */
export function isSamePress(lastToggleFrame: number | null, frame: number): boolean {
  return lastToggleFrame !== null && frame === lastToggleFrame;
}

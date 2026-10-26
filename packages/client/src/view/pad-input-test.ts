/**
 * The Controls screen's input test: what the browser itself reports from the connected pad, read straight from
 * `navigator.getGamepads()` rather than through Phaser, so a pad that is detected but never moves the game shows
 * whether its presses reach the page at all (the Linux webview, 2026-10-24).
 */

export interface RawPad {
  readonly connected: boolean;
  readonly mapping: string;
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

/** A stick past this reads as moved. */
const AXIS_MOVED = 0.5;

/** What is pressed or pushed right now on the first connected pad, e.g. "button 0, axis 1", or null for nothing. */
export function padInputNow(pads: readonly (RawPad | null)[]): string | null {
  const pad = pads.find((candidate) => candidate?.connected);
  if (!pad) return null;
  const parts: string[] = [];
  pad.buttons.forEach((button, index) => {
    if (button.pressed) parts.push(`button ${index}`);
  });
  pad.axes.forEach((value, index) => {
    if (Math.abs(value) >= AXIS_MOVED) parts.push(`axis ${index}`);
  });
  return parts.length > 0 ? parts.join(", ") : null;
}

/** The test line: the last input seen (kept after release), and a note when the pad's layout is not the standard one. */
export function padInputTestLine(lastSeen: string | null, mapping: string | null): string {
  const seen = lastSeen === null ? "Press a button to test it" : `Last input: ${lastSeen}`;
  return mapping === null || mapping === "standard" ? seen : `${seen} · layout "${mapping}" is not standard`;
}

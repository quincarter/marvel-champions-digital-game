/**
 * The "Your hero: X" note a guest sees while watching the room's game (issue #880): set when the watch opens, read by the
 * replay transport's banner. Tied to the watch it was made for, so a later, unrelated replay never shows it.
 */
import type { ReplayHost } from "../replay/replay-host.js";

let note: { readonly text: string; readonly host: ReplayHost } | null = null;

export function setSeatNote(text: string | null, host?: ReplayHost): void {
  note = text && host ? { text, host } : null;
}

/** The note for `host` (the replay on screen), or null. */
export function seatNoteFor(host: ReplayHost | null): string | null {
  return note && host === note.host ? note.text : null;
}

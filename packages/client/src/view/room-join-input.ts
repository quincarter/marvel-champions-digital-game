/**
 * The "Join a room" field (issue #880): what the player typed or pasted, as the code it names. A bare code in any case
 * (dashes and spaces ignored), a `#join=` link or a `marvelchampions://join/<code>` link all read the same, so pasting
 * the host's link into the code field just works.
 */
import { joinTargetOf } from "../live/join-link.js";

export const ROOM_CODE_LENGTH = 6;

/** The text a join call takes for `input`, or null while it does not name a room yet. */
export function joinTargetFromInput(input: string): string | null {
  const text = input.trim();
  if (text === "") return null;
  const fragment = /[#?&]join=([^&#\s]+)/.exec(text);
  if (fragment) return joinTargetOf(fragment[1]!);
  const app = /^marvelchampions:\/\/join\/([^/?#\s]+)/i.exec(text);
  if (app) return joinTargetOf(app[1]!);
  return joinTargetOf(text);
}

/** The field's own text kept tidy as it is typed: a short code in capitals, a pasted link left whole. */
export function tidyJoinInput(input: string): string {
  const text = input.trim();
  if (/[:/#=]/.test(text) || text.length > 16) return text;
  return text.replace(/[\s-]+/g, "").toUpperCase();
}

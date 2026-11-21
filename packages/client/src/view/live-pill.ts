/**
 * A watcher's live marker (issue #876), shown in the top bar's log line in place of "LOG": "● LIVE" while the host is
 * there, "○ HOST AWAY" while not, "FEED LOST" once following stopped. A glyph and words, so no state rests on colour
 * alone. Plain functions over the replay host's live state, so the board only draws what these say.
 */
import { t } from "../i18n/translate.js";
import type { LiveState } from "../live/watch-events.js";

export type LivePillTone = "live" | "away" | "failed";

export interface LivePill {
  readonly tone: LivePillTone;
  /** The dot drawn before the words (it pulses while the host is there), or null. */
  readonly glyph: string | null;
  /** The words, upper case like the label they replace. */
  readonly word: string;
}

/** The marker for a live game's state, or null when there is none to show (an ordinary replay, or the game is over). */
export function livePillOf(state: LiveState | null): LivePill | null {
  if (!state) return null;
  if (state.failed) return { tone: "failed", glyph: null, word: t("watch.failed").toUpperCase() };
  if (state.over) return null;
  return state.hostConnected
    ? { tone: "live", glyph: "\u25cf", word: t("watch.live").toUpperCase() }
    : { tone: "away", glyph: "\u25cb", word: t("watch.hostAway").toUpperCase() };
}

/** What a redraw is keyed on: the marker's words, not the watcher count. */
export const livePillKey = (pill: LivePill | null): string => (pill ? `${pill.tone}:${pill.word}` : "");

/**
 * The break timer behind Break Time (44046), docs/phase7-wave7.md Q49: "wall-clock time from playing the card,
 * including time the app is backgrounded or suspended; whole minutes, rounded down; no cap; the minute count is
 * stored in the log; the player who played the card ends the break."
 *
 * The engine never reads a clock; it asks a `reportFact` choice of kind `minutesAway` and logs the number it is
 * given. This module only chooses that number. Elapsed time is always `now() - startedAt` read when drawn (never
 * summed from frame deltas), so a background tab, a locked phone or a suspended laptop counts. The start time is kept
 * in `localStorage` (an `mc-` key, so a save export carries it), keyed by the game's seed, the choice and the seat,
 * so a game closed mid-break and resumed shows the true elapsed time: the save replays to the same open choice.
 *
 * A clock that went backward (the system time was changed) never yields a negative: elapsed reads as 0, and the
 * start is rebased to the new now, so the break counts up again from there instead of waiting to catch up.
 */

import type { PendingChoice } from "@mc/engine";

export type BreakClock = () => number;

export const BREAK_START_KEY = "mc-break-time-start";

type BreakStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** What names one break: the game (its seed), the open choice and the seat it is addressed to. */
export interface BreakIdentity {
  readonly seed: number;
  readonly choiceId: string;
  readonly playerId: string;
}

interface StoredBreak extends BreakIdentity {
  readonly startedAt: number;
}

const browserStorage = (): BreakStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Whether this choice is the minutes-away report, the one the break screen answers. */
export function isBreakChoice(choice: Pick<PendingChoice, "prompt">): boolean {
  const prompt = choice.prompt;
  return prompt.kind === "reportFact" && prompt.fact === "minutesAway" && prompt.answer === "wholeNumber";
}

/**
 * The wall-clock time this break began. The first call for a break records `now()`; a later call (a redraw, or a
 * resume after a restart) returns the recorded time. A recorded start in the future (the clock moved back) is rebased
 * to now. Storage that is missing or throws only costs the persistence: the start then lives in the caller.
 */
export function breakStartedAt(
  identity: BreakIdentity,
  now: BreakClock,
  storage: BreakStorage | null = browserStorage(),
): number {
  const at = now();
  try {
    const raw = storage?.getItem(BREAK_START_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredBreak>;
      if (
        stored.seed === identity.seed &&
        stored.choiceId === identity.choiceId &&
        stored.playerId === identity.playerId &&
        typeof stored.startedAt === "number" &&
        Number.isFinite(stored.startedAt)
      ) {
        if (stored.startedAt <= at) return stored.startedAt;
        write(storage, identity, at);
        return at;
      }
    }
  } catch {
    // An unreadable record is a fresh break.
  }
  write(storage, identity, at);
  return at;
}

function write(storage: BreakStorage | null, identity: BreakIdentity, startedAt: number): void {
  try {
    storage?.setItem(BREAK_START_KEY, JSON.stringify({ ...identity, startedAt } satisfies StoredBreak));
  } catch {
    // A full or blocked store only means the start is not remembered across a restart.
  }
}

/** Forgets the break (it ended, or the manual path answered). */
export function clearBreakStart(storage: BreakStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(BREAK_START_KEY);
  } catch {
    // Nothing to forget.
  }
}

export interface BreakReadout {
  /** Whole minutes so far, rounded down; never negative. */
  readonly minutes: number;
  /** "3:20", or "1:05:09" from the first hour. */
  readonly clockText: string;
  /** What ending the break would do right now. */
  readonly healText: string;
}

/** What the break screen shows at `now`. */
export function breakReadout(startedAt: number, now: number): BreakReadout {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const pad = (n: number): string => String(n).padStart(2, "0");
  const clockText = hours > 0 ? `${hours}:${pad(minutes % 60)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
  return { minutes, clockText, healText: `Heal ${minutes} from each identity` };
}

/** The engine answer for ending the break at `now`: the whole minutes in decimal digits. */
export function breakAnswerAt(startedAt: number, now: number): readonly string[] {
  return [String(breakReadout(startedAt, now).minutes)];
}

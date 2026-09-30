/**
 * The Log tab/panel's tutorial gate (guided mode G8 part 2, `docs/guided-mode.md` §3 decision 11, §3.11): "The Log
 * tab and the Log chip unlock after lesson 5. They stay visible, dashed, with 'Lesson 5' as the reason." Only a
 * guided tutorial run is ever gated — a normal game, or a guided run whose guidance has already stopped (§3.10
 * "Stop tutorial"), always reads unlocked.
 *
 * `lessons.length` stands in for "lesson 5" the same way `round-debrief-model.ts#newOnBoardLines` already does, so
 * this still reads right if the run's lesson count ever changes.
 */
import type { LessonListEntry } from "./lesson-model.js";

export interface LogGate {
  readonly locked: boolean;
  /** Non-null exactly when `locked` is true — the reason to show beside the dashed control. */
  readonly reason: string | null;
}

const UNLOCK_REASON = "Lesson 5";

export function logGateFor(guidedRunActive: boolean, lessons: readonly LessonListEntry[]): LogGate {
  if (!guidedRunActive || lessons.length === 0) return { locked: false, reason: null };
  const last = lessons[lessons.length - 1]!;
  return last.status === "done" ? { locked: false, reason: null } : { locked: true, reason: UNLOCK_REASON };
}

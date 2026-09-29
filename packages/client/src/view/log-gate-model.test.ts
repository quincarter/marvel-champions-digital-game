/**
 * `view/log-gate-model.ts` (guided mode G8 part 2, `docs/guided-mode.md` §3.11): a normal game (or a guided run
 * that isn't active) is always unlocked; a guided tutorial run stays locked until the run's last lesson is done.
 */
import { describe, expect, test } from "vitest";
import type { Lesson, LessonListEntry } from "./lesson-model.js";
import { logGateFor } from "./log-gate-model.js";

function lesson(id: string): Lesson {
  return { id, title: `Lesson ${id}`, steps: [] };
}

function entries(...statuses: readonly ("done" | "current" | "upcoming")[]): readonly LessonListEntry[] {
  return statuses.map((status, index) => ({ lesson: lesson(String(index + 1)), status }));
}

describe("logGateFor", () => {
  test("a plain game is never locked, whatever the lesson list says", () => {
    expect(logGateFor(false, entries("upcoming", "upcoming"))).toEqual({ locked: false, reason: null });
  });

  test("locked with the last lesson still open, in a guided run", () => {
    expect(logGateFor(true, entries("done", "done", "current"))).toEqual({ locked: true, reason: "Lesson 5" });
  });

  test("unlocked the moment the last lesson is done", () => {
    expect(logGateFor(true, entries("done", "done", "done"))).toEqual({ locked: false, reason: null });
  });

  test("no lessons at all reads unlocked rather than stuck locked", () => {
    expect(logGateFor(true, [])).toEqual({ locked: false, reason: null });
  });
});

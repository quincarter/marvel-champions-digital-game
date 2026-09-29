/**
 * Starting the tutorial partway through (guided mode G6c part 2, `docs/guided-mode.md` §4 G6c: "Any later lesson
 * starts the same `TUTORIAL_CONFIG` game and replays `TUTORIAL_SCRIPT` up to that lesson's start point before
 * handing over"). A pure mapping only — `guide/start-tutorial.ts` is what actually replays commands through the
 * store; this module just says how many.
 *
 * **How the prefixes were picked** (cross-checked against `tutorial-config.test.ts`'s own dispatch trace; owner's
 * lesson reorder 2026-09-29 swapped lessons 2 and 3 — paying for cards, as Peter Parker, now comes before the
 * flip, not after):
 * - `paying-for-cards` (lesson 2): 0 — nothing replayed. `startTutorialGame`'s existing "if a choice is pending,
 *   resolve it empty" step answers the mulligan (`TUTORIAL_SCRIPT[0]`) on its own, same as starting from the top.
 * - `hero-and-alter-ego` (lesson 3): 2 — mulligan, then play Black Cat as Peter Parker (`TUTORIAL_SCRIPT[0..1]`).
 *   Nothing is left pending after she's played, so lesson 3 opens exactly "ready to flip".
 * - `villain-phase` (lesson 4): 4 — through ending the turn (`TUTORIAL_SCRIPT[0..3]`: mulligan, play Black Cat,
 *   flip, end turn). That leaves the end-of-player-phase discard choice pending (trivial: nothing to discard with
 *   this stacked hand) — the same "if a choice is pending, resolve it empty" step in `startTutorialGame` answers
 *   it, which is what actually flips `GameState.step.phase` to `"villain"` and rolls the villain's boost/attack
 *   setup forward to the next *real* decision (Spider-Sense), left for the player to make live rather than
 *   scripted away.
 * - `threat-and-thwarting` (lesson 5): `TUTORIAL_SCRIPT.length` (7) — the whole script, including the two real
 *   round-1 decisions (decline Spider-Sense, defend with Black Cat) a player replaying from lesson 2 would have
 *   already made. Declaring Black Cat as defender resolves Rhino's attack and rolls straight into round 2's
 *   player phase, with nothing left pending.
 */
import { TUTORIAL_LESSONS } from "./tutorial-lessons.js";
import { TUTORIAL_SCRIPT } from "./tutorial-config.js";

/** Lesson ids reachable from `scenes/how-to-play.ts`'s hub rows 2–5 — every `TUTORIAL_LESSONS` id except
 * `"how-to-win"`, which is its own pre-game screen (G6b) and never a board checkpoint. */
export type TutorialLessonId = Exclude<(typeof TUTORIAL_LESSONS)[number]["id"], "how-to-win">;

/**
 * How many of `TUTORIAL_SCRIPT`'s commands, from index 0, `guide/start-tutorial.ts#startTutorialGame` replays so
 * that `lessonId` is the lesson-model's own current lesson (or, where a trivial pending choice is still owed, one
 * `resolveChoice([])` away from it) the moment replay hands back to the player. See this file's own header for how
 * each number was picked, and `tutorial-checkpoints.test.ts` for the proof against a real session core.
 */
export const TUTORIAL_CHECKPOINTS: Readonly<Record<TutorialLessonId, number>> = {
  "paying-for-cards": 0,
  "hero-and-alter-ego": 2,
  "villain-phase": 4,
  "threat-and-thwarting": TUTORIAL_SCRIPT.length,
};

/** `TUTORIAL_SCRIPT`'s prefix to replay for `lessonId` (`TUTORIAL_CHECKPOINTS`, above). */
export function tutorialCheckpointFor(lessonId: TutorialLessonId): number {
  // `noUncheckedIndexedAccess` widens the lookup to `number | undefined` even though `TutorialLessonId` is exactly
  // `TUTORIAL_CHECKPOINTS`'s key type — every key is present by construction, above.
  return TUTORIAL_CHECKPOINTS[lessonId] as number;
}

/**
 * Lesson ids to mark done, for this run only, when starting straight at `lessonId` — every lesson before it in
 * `TUTORIAL_LESSONS`'s own order, `"how-to-win"` included: `scenes/board.ts` already marks that one done
 * unconditionally, since "How to win" is its own pre-game screen (G6b) rather than a board step. A no-op empty
 * list if `lessonId` isn't found (shouldn't happen — `TutorialLessonId` is drawn from the same list).
 */
export function tutorialLessonsDoneBefore(lessonId: TutorialLessonId): readonly string[] {
  const index = TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === lessonId);
  return index < 0 ? [] : TUTORIAL_LESSONS.slice(0, index).map((lesson) => lesson.id);
}

/**
 * Resuming a half-finished guided run (guided mode §3.12, `docs/guided-mode.md`): Title's Continue on a save whose
 * `SaveMeta.guided` (`engine/game-storage.ts`, stamped by `guide/start-tutorial.ts`/`guide/start-aspect-tryit.ts`)
 * marks it a guided run asks whether to resume guidance or just open the save as a plain game. Pure decision logic
 * only — `scenes/title.ts` is what actually shows the prompt and dispatches `startTutorialGame`/
 * `startAspectTryItGame`.
 *
 * A tutorial save prompts by lesson: the first of `TUTORIAL_LESSONS` (excluding `"how-to-win"`, which is its own
 * pre-game screen, never a board checkpoint — same exclusion `TutorialLessonId` already makes) not yet in the
 * saved prefs' `tutorial.lessonsDone`. If every lesson is done, or the tutorial was stopped outright
 * (`tutorial.skipped`) or finished (`tutorial.finished`), there's nothing left to resume — the save opens plainly,
 * no prompt. An aspect "Try it" save always prompts (there is only the one lesson, so "resume" and "restart" are
 * the same thing); "Include this only if it's trivial" per the brief — it is, so it's included.
 */
import type { GuidePrefs } from "./guide-prefs.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { TUTORIAL_LESSONS } from "./tutorial-lessons.js";
import type { TutorialLessonId } from "./tutorial-checkpoints.js";
import type { AspectTryItId } from "./aspect-tryit-config.js";

export type TutorialResumeDecision =
  /** Not a guided save, or every lesson is already accounted for — open it as a plain game, no prompt. */
  | { readonly kind: "plain" }
  | { readonly kind: "tutorial"; readonly lessonId: TutorialLessonId; readonly title: string }
  | { readonly kind: "aspect"; readonly aspect: AspectTryItId };

/** The first tutorial lesson (in `TUTORIAL_LESSONS` order, `"how-to-win"` excluded) not in `lessonsDone` — the
 * lesson a resumed tutorial should fast-forward to. Null once every lesson is done. */
export function firstUnfinishedTutorialLesson(prefs: GuidePrefs): TutorialLessonId | null {
  for (const lesson of TUTORIAL_LESSONS) {
    if (lesson.id === "how-to-win") continue;
    if (!prefs.tutorial.lessonsDone.includes(lesson.id)) return lesson.id as TutorialLessonId;
  }
  return null;
}

/** What Title's Continue should do with `save`, given the player's current guide prefs (`guide/guide-store.ts`'s
 * `guidePrefs()`). See this file's own header for the rules. */
export function tutorialResumeDecisionFor(save: SaveMeta, prefs: GuidePrefs): TutorialResumeDecision {
  const guided = save.guided;
  if (!guided) return { kind: "plain" };
  if (guided.kind === "aspect") return { kind: "aspect", aspect: guided.aspect as AspectTryItId };
  if (prefs.tutorial.skipped || prefs.tutorial.finished) return { kind: "plain" };
  const lessonId = firstUnfinishedTutorialLesson(prefs);
  if (!lessonId) return { kind: "plain" };
  const title = TUTORIAL_LESSONS.find((lesson) => lesson.id === lessonId)?.title ?? lessonId;
  return { kind: "tutorial", lessonId, title };
}

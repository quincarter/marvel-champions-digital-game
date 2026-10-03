/**
 * The catalog of mechanic "Try it" lessons (guided mode §3.14: a hero-defining mechanic gets a short scripted
 * situation the player acts in), one row per lesson, in the order a box's page lists them. Each lesson has its own
 * stacked config (`guide/mechanic-tryit-config.ts`) and lesson data (`guide/mechanic-lessons.ts`); this file is only
 * what the "New in this box" pages need to show a row and to know where it belongs.
 *
 * A mechanic lesson is "done" the way an aspect lesson is: its id is added to `GuidePrefs.aspectLessonsDone` under
 * `mechanicLessonDoneKey`, so nothing about the saved prefs changes shape.
 */
import type { GlossaryBoxId } from "@mc/content";

/** Grows with each lesson built (guided mode §3.14); `mechanic-lessons.ts` and `mechanic-tryit-config.ts` are keyed by it. */
export type MechanicTryItId = "storm";

export interface MechanicTryIt {
  readonly id: MechanicTryItId;
  /** The box page this lesson is listed on. */
  readonly box: GlossaryBoxId;
  /** The row's title, e.g. "Storm: the Weather deck". */
  readonly title: string;
  /** One line under the title. */
  readonly tagline: string;
}

/** Every lesson built so far, in listing order. */
export const MECHANIC_TRYITS: readonly MechanicTryIt[] = [
  {
    id: "storm",
    box: "cycle6",
    title: "Storm: the Weather deck",
    tagline: "Swap the Weather in play, then use its Special.",
  },
];

/** The key a finished mechanic lesson is stored under in `GuidePrefs.aspectLessonsDone`. */
export const mechanicLessonDoneKey = (id: MechanicTryItId): string => `mechanic:${id}`;

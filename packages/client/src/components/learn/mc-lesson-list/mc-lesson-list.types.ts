import type { LessonRowModel } from "../mc-lesson-row/mc-lesson-row.types.js";

/** The properties of `mc-lesson-list`. */
export interface LessonListProps {
  /** THE BASICS, already translated. */
  readonly heading: string;
  readonly lessons: readonly LessonRowModel[];
}

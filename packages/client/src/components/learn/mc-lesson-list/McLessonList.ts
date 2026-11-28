import { html, nothing, type PropertyDeclarations } from "lit";
import { LearnElement } from "../shared/LearnElement.js";
import { McLessonListStyles } from "./mc-lesson-list.styles.js";
import type { LessonRowModel } from "../mc-lesson-row/mc-lesson-row.types.js";
import type { LessonListProps } from "./mc-lesson-list.types.js";

/**
 * # Lesson list
 * THE BASICS on the How to play hub: its label over the tutorial's five lessons (`mc-lesson-row`), one per line. A press on
 * a row is `{ type: "lesson", id }` as `mc-learn`.
 *
 * @element mc-lesson-list
 * @attr heading - THE BASICS, already translated.
 * @prop lessons - The rows (`LessonRowModel`).
 * @fires mc-learn - `{ type: "lesson", id }`.
 */
export class McLessonList extends LearnElement implements LessonListProps {
  static override styles = [McLessonListStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    lessons: { attribute: false },
  };

  declare heading: string;
  declare lessons: readonly LessonRowModel[];

  constructor() {
    super();
    this.heading = "";
    this.lessons = [];
  }

  override render() {
    if (this.lessons.length === 0) return nothing;
    return html`<div class="label">${this.heading}</div>
      <div class="rows">${this.lessons.map((lesson) => html`<mc-lesson-row .model=${lesson}></mc-lesson-row>`)}</div>`;
  }
}

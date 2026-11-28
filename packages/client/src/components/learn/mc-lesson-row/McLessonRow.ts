import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McLessonRowStyles } from "./mc-lesson-row.styles.js";
import type { LessonRowModel } from "./mc-lesson-row.types.js";

/**
 * # Lesson row
 * One of the tutorial's five lessons on the How to play hub: an index badge (a ✓ once it is done), the lesson's title,
 * and at the right a ✓ DONE, a yellow NEXT stamp on the one the guide steers to (its outline heavy and yellow too), or a
 * quiet "▸". Every lesson is always pressable, whatever its own state (`docs/guided-mode.md` §4 G6c: "a recommended order
 * the player can ignore"). The row is a focus stop `lesson:<id>`; a press raises `{ type: "lesson", id }` for the owner's
 * section to turn into `mc-learn`.
 *
 * @element mc-lesson-row
 * @prop model - The row (`LessonRowModel`).
 * @fires mc-pressed - `PressDetail` whose action is `{ type: "lesson", id }`.
 */
export class McLessonRow extends LitElement {
  static override styles = [McLessonRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LessonRowModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const lesson = this.model;
    if (!lesson) return nothing;
    return html`<mc-link-row
      heading=${lesson.title}
      ?emphasis=${lesson.recommended}
      .stop=${`lesson:${lesson.id}`}
      .action=${{ type: "lesson", id: lesson.id }}
    >
      <span slot="lead" class="badge" ?data-done=${lesson.done}>${lesson.done ? "✓" : String(lesson.index)}</span>
      ${
        lesson.done
          ? html`<span slot="trail" class="done">${lesson.doneLabel}</span>`
          : lesson.recommended
            ? html`<mc-stamp slot="trail" tone="caution" label=${lesson.nextLabel}></mc-stamp>`
            : nothing
      }
    </mc-link-row>`;
  }
}

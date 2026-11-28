import { McLessonRow } from "./McLessonRow.js";

if (!customElements.get("mc-lesson-row")) {
  customElements.define("mc-lesson-row", McLessonRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lesson-row": McLessonRow;
  }
}

export { McLessonRow };

import { McLessonList } from "./McLessonList.js";
import "../mc-lesson-row/mc-lesson-row.js";

if (!customElements.get("mc-lesson-list")) {
  customElements.define("mc-lesson-list", McLessonList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lesson-list": McLessonList;
  }
}

export { McLessonList };

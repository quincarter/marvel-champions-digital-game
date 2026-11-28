import { McWindowedList } from "./McWindowedList.js";

if (!customElements.get("mc-windowed-list")) {
  customElements.define("mc-windowed-list", McWindowedList);
}

export { McWindowedList };

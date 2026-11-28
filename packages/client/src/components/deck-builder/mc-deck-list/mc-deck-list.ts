import { McDeckList } from "./McDeckList.js";

if (!customElements.get("mc-deck-list")) {
  customElements.define("mc-deck-list", McDeckList);
}

export { McDeckList };

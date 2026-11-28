import { McDeckLine } from "./McDeckLine.js";

if (!customElements.get("mc-deck-line")) {
  customElements.define("mc-deck-line", McDeckLine);
}

export { McDeckLine };

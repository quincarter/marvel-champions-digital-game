import { McDeckName } from "./McDeckName.js";

if (!customElements.get("mc-deck-name")) {
  customElements.define("mc-deck-name", McDeckName);
}

export { McDeckName };

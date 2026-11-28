import { McDeckListPanel } from "./McDeckListPanel.js";

if (!customElements.get("mc-deck-list-panel")) {
  customElements.define("mc-deck-list-panel", McDeckListPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-list-panel": McDeckListPanel;
  }
}

export { McDeckListPanel };

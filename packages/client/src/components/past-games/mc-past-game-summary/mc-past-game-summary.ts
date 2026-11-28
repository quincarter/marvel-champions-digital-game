import { McPastGameSummary } from "./McPastGameSummary.js";

if (!customElements.get("mc-past-game-summary")) {
  customElements.define("mc-past-game-summary", McPastGameSummary);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-game-summary": McPastGameSummary;
  }
}

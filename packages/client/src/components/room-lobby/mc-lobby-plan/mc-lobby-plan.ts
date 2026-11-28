import { McLobbyPlan } from "./McLobbyPlan.js";

if (!customElements.get("mc-lobby-plan")) {
  customElements.define("mc-lobby-plan", McLobbyPlan);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lobby-plan": McLobbyPlan;
  }
}

import { McPastGameAspects } from "./McPastGameAspects.js";

if (!customElements.get("mc-past-game-aspects")) {
  customElements.define("mc-past-game-aspects", McPastGameAspects);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-game-aspects": McPastGameAspects;
  }
}

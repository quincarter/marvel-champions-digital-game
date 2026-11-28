import { McUnlocksPoints } from "./McUnlocksPoints.js";

if (!customElements.get("mc-unlocks-points")) {
  customElements.define("mc-unlocks-points", McUnlocksPoints);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-unlocks-points": McUnlocksPoints;
  }
}

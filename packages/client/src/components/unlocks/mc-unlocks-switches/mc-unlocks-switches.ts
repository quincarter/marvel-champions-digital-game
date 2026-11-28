import { McUnlocksSwitches } from "./McUnlocksSwitches.js";

if (!customElements.get("mc-unlocks-switches")) {
  customElements.define("mc-unlocks-switches", McUnlocksSwitches);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-unlocks-switches": McUnlocksSwitches;
  }
}

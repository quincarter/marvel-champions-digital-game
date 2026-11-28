import { McUnlocksList } from "./McUnlocksList.js";

if (!customElements.get("mc-unlocks-list")) {
  customElements.define("mc-unlocks-list", McUnlocksList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-unlocks-list": McUnlocksList;
  }
}

import { McSetupEncounter } from "./McSetupEncounter.js";

if (!customElements.get("mc-setup-encounter")) {
  customElements.define("mc-setup-encounter", McSetupEncounter);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-encounter": McSetupEncounter;
  }
}

export { McSetupEncounter };

import { McSwitchRow } from "./McSwitchRow.js";

if (!customElements.get("mc-switch-row")) {
  customElements.define("mc-switch-row", McSwitchRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-switch-row": McSwitchRow;
  }
}

export { McSwitchRow };

import { McSetupSummary } from "./McSetupSummary.js";

if (!customElements.get("mc-setup-summary")) {
  customElements.define("mc-setup-summary", McSetupSummary);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-summary": McSetupSummary;
  }
}

export { McSetupSummary };

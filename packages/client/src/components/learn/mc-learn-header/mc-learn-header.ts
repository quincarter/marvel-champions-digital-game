import { McLearnHeader } from "./McLearnHeader.js";

if (!customElements.get("mc-learn-header")) {
  customElements.define("mc-learn-header", McLearnHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-learn-header": McLearnHeader;
  }
}

export { McLearnHeader };

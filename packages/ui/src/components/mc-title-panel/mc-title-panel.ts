import { McTitlePanel } from "./McTitlePanel.js";

if (!customElements.get("mc-title-panel")) customElements.define("mc-title-panel", McTitlePanel);

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-panel": McTitlePanel;
  }
}

export { McTitlePanel };

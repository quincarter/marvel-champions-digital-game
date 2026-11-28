import { McHintButton } from "./McHintButton.js";

if (!customElements.get("mc-hint-button")) {
  customElements.define("mc-hint-button", McHintButton);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-hint-button": McHintButton;
  }
}

export { McHintButton };

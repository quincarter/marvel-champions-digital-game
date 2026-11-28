import { McSetupDifficulty } from "./McSetupDifficulty.js";

if (!customElements.get("mc-setup-difficulty")) {
  customElements.define("mc-setup-difficulty", McSetupDifficulty);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-difficulty": McSetupDifficulty;
  }
}

export { McSetupDifficulty };

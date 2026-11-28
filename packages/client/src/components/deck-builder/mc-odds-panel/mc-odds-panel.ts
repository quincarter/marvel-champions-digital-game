import { McOddsPanel } from "./McOddsPanel.js";

if (!customElements.get("mc-odds-panel")) {
  customElements.define("mc-odds-panel", McOddsPanel);
}

export { McOddsPanel };

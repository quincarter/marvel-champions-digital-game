import { McGamesPanel } from "./McGamesPanel.js";

if (!customElements.get("mc-games-panel")) {
  customElements.define("mc-games-panel", McGamesPanel);
}

export { McGamesPanel };

import { McScenarioPicked } from "./McScenarioPicked.js";

if (!customElements.get("mc-scenario-picked")) {
  customElements.define("mc-scenario-picked", McScenarioPicked);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-picked": McScenarioPicked;
  }
}

import { McScenarioShelves } from "./McScenarioShelves.js";

if (!customElements.get("mc-scenario-shelves")) {
  customElements.define("mc-scenario-shelves", McScenarioShelves);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-shelves": McScenarioShelves;
  }
}

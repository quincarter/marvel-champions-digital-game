import { McGamesSection } from "./McGamesSection.js";

if (!customElements.get("mc-games-section")) {
  customElements.define("mc-games-section", McGamesSection);
}

export { McGamesSection };

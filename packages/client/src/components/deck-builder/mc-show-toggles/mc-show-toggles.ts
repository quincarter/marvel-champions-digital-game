import { McShowToggles } from "./McShowToggles.js";

if (!customElements.get("mc-show-toggles")) {
  customElements.define("mc-show-toggles", McShowToggles);
}

export { McShowToggles };

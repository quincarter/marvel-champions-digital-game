import { McModFinders } from "./McModFinders.js";

if (!customElements.get("mc-mod-finders")) {
  customElements.define("mc-mod-finders", McModFinders);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-finders": McModFinders;
  }
}

export { McModFinders };

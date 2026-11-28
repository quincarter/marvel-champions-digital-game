import { McCivilLeaders } from "./McCivilLeaders.js";

if (!customElements.get("mc-civil-leaders")) {
  customElements.define("mc-civil-leaders", McCivilLeaders);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-leaders": McCivilLeaders;
  }
}

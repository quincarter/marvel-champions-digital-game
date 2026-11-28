import { McCivilFoot } from "./McCivilFoot.js";

if (!customElements.get("mc-civil-foot")) {
  customElements.define("mc-civil-foot", McCivilFoot);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-foot": McCivilFoot;
  }
}

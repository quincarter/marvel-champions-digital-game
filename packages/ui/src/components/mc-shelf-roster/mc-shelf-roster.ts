import { McShelfRoster, SHELF_CHEVRON, SHELF_HEADER_GAP } from "./McShelfRoster.js";

if (!customElements.get("mc-shelf-roster")) customElements.define("mc-shelf-roster", McShelfRoster);

declare global {
  interface HTMLElementTagNameMap {
    "mc-shelf-roster": McShelfRoster;
  }
}

export { McShelfRoster, SHELF_CHEVRON, SHELF_HEADER_GAP };

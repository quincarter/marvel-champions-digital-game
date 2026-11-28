import { McPackSort } from "./McPackSort.js";

if (!customElements.get("mc-pack-sort")) {
  customElements.define("mc-pack-sort", McPackSort);
}

export { McPackSort };

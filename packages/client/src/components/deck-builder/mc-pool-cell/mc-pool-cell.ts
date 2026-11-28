import { McPoolCell } from "./McPoolCell.js";

if (!customElements.get("mc-pool-cell")) {
  customElements.define("mc-pool-cell", McPoolCell);
}

export { McPoolCell };

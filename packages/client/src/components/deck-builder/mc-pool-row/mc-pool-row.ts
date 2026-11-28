import { McPoolRow } from "./McPoolRow.js";

if (!customElements.get("mc-pool-row")) {
  customElements.define("mc-pool-row", McPoolRow);
}

export { McPoolRow };

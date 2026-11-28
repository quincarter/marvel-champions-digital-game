import { McPoolList } from "./McPoolList.js";

if (!customElements.get("mc-pool-list")) {
  customElements.define("mc-pool-list", McPoolList);
}

export { McPoolList };

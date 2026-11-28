import { McPoolPick } from "./McPoolPick.js";

if (!customElements.get("mc-pool-pick")) {
  customElements.define("mc-pool-pick", McPoolPick);
}

export { McPoolPick };

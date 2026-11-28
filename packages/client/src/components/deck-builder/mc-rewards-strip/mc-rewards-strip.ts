import { McRewardsStrip } from "./McRewardsStrip.js";

if (!customElements.get("mc-rewards-strip")) {
  customElements.define("mc-rewards-strip", McRewardsStrip);
}

export { McRewardsStrip };

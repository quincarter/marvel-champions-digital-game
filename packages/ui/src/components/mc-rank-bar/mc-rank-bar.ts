import { McRankBar } from "./McRankBar.js";

if (!customElements.get("mc-rank-bar")) customElements.define("mc-rank-bar", McRankBar);

declare global {
  interface HTMLElementTagNameMap {
    "mc-rank-bar": McRankBar;
  }
}

export { McRankBar };

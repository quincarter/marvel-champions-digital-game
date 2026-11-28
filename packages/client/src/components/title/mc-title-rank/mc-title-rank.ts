import { McTitleRank } from "./McTitleRank.js";

if (!customElements.get("mc-title-rank")) {
  customElements.define("mc-title-rank", McTitleRank);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-rank": McTitleRank;
  }
}

export { McTitleRank };

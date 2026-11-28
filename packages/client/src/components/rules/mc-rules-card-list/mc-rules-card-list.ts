import { McRulesCardList } from "./McRulesCardList.js";

if (!customElements.get("mc-rules-card-list")) {
  customElements.define("mc-rules-card-list", McRulesCardList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-card-list": McRulesCardList;
  }
}

export { McRulesCardList };

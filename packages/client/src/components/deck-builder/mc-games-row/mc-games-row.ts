import { McGamesRow } from "./McGamesRow.js";

if (!customElements.get("mc-games-row")) {
  customElements.define("mc-games-row", McGamesRow);
}

export { McGamesRow };

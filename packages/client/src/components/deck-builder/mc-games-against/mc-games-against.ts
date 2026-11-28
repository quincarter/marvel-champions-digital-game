import { McGamesAgainst } from "./McGamesAgainst.js";

if (!customElements.get("mc-games-against")) {
  customElements.define("mc-games-against", McGamesAgainst);
}

export { McGamesAgainst };

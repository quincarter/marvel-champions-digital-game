import { McHeroRow } from "./McHeroRow.js";

if (!customElements.get("mc-hero-row")) {
  customElements.define("mc-hero-row", McHeroRow);
}

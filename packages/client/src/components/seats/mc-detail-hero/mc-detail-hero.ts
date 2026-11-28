import { McDetailHero } from "./McDetailHero.js";

if (!customElements.get("mc-detail-hero")) {
  customElements.define("mc-detail-hero", McDetailHero);
}

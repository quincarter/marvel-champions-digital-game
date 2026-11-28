import { McHeroTile } from "./McHeroTile.js";

if (!customElements.get("mc-hero-tile")) {
  customElements.define("mc-hero-tile", McHeroTile);
}

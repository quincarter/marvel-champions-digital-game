import { McHeroShelf } from "./McHeroShelf.js";

if (!customElements.get("mc-hero-shelf")) {
  customElements.define("mc-hero-shelf", McHeroShelf);
}

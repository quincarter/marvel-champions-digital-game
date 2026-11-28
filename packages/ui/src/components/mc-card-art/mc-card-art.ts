import { McCardArt } from "./McCardArt.js";

if (!customElements.get("mc-card-art")) {
  customElements.define("mc-card-art", McCardArt);
}

export { McCardArt };

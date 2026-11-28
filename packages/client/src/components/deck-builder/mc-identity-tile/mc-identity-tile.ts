import { McIdentityTile } from "./McIdentityTile.js";

if (!customElements.get("mc-identity-tile")) {
  customElements.define("mc-identity-tile", McIdentityTile);
}

export { McIdentityTile };

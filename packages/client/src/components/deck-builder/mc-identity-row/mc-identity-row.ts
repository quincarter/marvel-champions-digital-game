import { McIdentityRow } from "./McIdentityRow.js";

if (!customElements.get("mc-identity-row")) {
  customElements.define("mc-identity-row", McIdentityRow);
}

export { McIdentityRow };

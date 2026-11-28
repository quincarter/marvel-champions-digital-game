import { McIdentityPicker } from "./McIdentityPicker.js";

if (!customElements.get("mc-identity-picker")) {
  customElements.define("mc-identity-picker", McIdentityPicker);
}

export { McIdentityPicker };

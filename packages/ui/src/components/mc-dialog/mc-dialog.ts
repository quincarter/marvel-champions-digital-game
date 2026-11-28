import { McDialog } from "./McDialog.js";

if (!customElements.get("mc-dialog")) {
  customElements.define("mc-dialog", McDialog);
}

export { McDialog };

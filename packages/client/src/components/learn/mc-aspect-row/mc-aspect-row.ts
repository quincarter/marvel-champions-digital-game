import { McAspectRow } from "./McAspectRow.js";

if (!customElements.get("mc-aspect-row")) {
  customElements.define("mc-aspect-row", McAspectRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-aspect-row": McAspectRow;
  }
}

export { McAspectRow };

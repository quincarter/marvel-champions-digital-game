import { McPauseLinkRow } from "./McPauseLinkRow.js";

if (!customElements.get("mc-pause-link-row")) {
  customElements.define("mc-pause-link-row", McPauseLinkRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-link-row": McPauseLinkRow;
  }
}

export { McPauseLinkRow };

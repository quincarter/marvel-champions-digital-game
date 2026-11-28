import { McStatsCredited } from "./McStatsCredited.js";

if (!customElements.get("mc-stats-credited")) {
  customElements.define("mc-stats-credited", McStatsCredited);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-credited": McStatsCredited;
  }
}

export { McStatsCredited };

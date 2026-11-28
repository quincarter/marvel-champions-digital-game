import { McBriefingModular } from "./McBriefingModular.js";

if (!customElements.get("mc-briefing-modular")) {
  customElements.define("mc-briefing-modular", McBriefingModular);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-modular": McBriefingModular;
  }
}

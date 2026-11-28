import { McBriefingSeatPicker } from "./McBriefingSeatPicker.js";

if (!customElements.get("mc-briefing-seat-picker")) {
  customElements.define("mc-briefing-seat-picker", McBriefingSeatPicker);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-seat-picker": McBriefingSeatPicker;
  }
}

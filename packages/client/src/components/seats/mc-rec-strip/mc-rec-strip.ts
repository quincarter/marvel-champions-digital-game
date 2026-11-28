import { McRecStrip } from "./McRecStrip.js";

if (!customElements.get("mc-rec-strip")) {
  customElements.define("mc-rec-strip", McRecStrip);
}

import { McCivilSummary } from "./McCivilSummary.js";

if (!customElements.get("mc-civil-summary")) {
  customElements.define("mc-civil-summary", McCivilSummary);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-summary": McCivilSummary;
  }
}

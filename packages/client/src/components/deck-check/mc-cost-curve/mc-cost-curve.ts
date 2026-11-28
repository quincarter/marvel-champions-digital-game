import { McCostCurve } from "./McCostCurve.js";

if (!customElements.get("mc-cost-curve")) {
  customElements.define("mc-cost-curve", McCostCurve);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-cost-curve": McCostCurve;
  }
}

export { McCostCurve };

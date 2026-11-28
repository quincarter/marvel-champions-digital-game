import { McStepTicks } from "./McStepTicks.js";

if (!customElements.get("mc-step-ticks")) {
  customElements.define("mc-step-ticks", McStepTicks);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-step-ticks": McStepTicks;
  }
}

export { McStepTicks };

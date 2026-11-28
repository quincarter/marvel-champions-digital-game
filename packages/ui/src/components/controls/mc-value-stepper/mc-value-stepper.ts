import { McValueStepper } from "./McValueStepper.js";

if (!customElements.get("mc-value-stepper")) {
  customElements.define("mc-value-stepper", McValueStepper);
}

export { McValueStepper };

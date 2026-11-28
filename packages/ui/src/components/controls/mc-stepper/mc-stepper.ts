import { McStepper } from "./McStepper.js";

if (!customElements.get("mc-stepper")) {
  customElements.define("mc-stepper", McStepper);
}

export { McStepper };

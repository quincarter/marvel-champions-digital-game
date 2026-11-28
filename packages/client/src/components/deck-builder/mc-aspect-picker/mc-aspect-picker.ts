import { McAspectPicker } from "./McAspectPicker.js";

if (!customElements.get("mc-aspect-picker")) {
  customElements.define("mc-aspect-picker", McAspectPicker);
}

export { McAspectPicker };

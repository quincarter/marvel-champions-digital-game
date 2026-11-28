import { McCopyButtons } from "./McCopyButtons.js";

if (!customElements.get("mc-copy-buttons")) {
  customElements.define("mc-copy-buttons", McCopyButtons);
}

export { McCopyButtons };

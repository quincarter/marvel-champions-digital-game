import { McLegalityLines } from "./McLegalityLines.js";

if (!customElements.get("mc-legality-lines")) {
  customElements.define("mc-legality-lines", McLegalityLines);
}

export { McLegalityLines };

import { McLobbyResult } from "./McLobbyResult.js";

if (!customElements.get("mc-lobby-result")) {
  customElements.define("mc-lobby-result", McLobbyResult);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lobby-result": McLobbyResult;
  }
}

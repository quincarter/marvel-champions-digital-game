import { McLobbyButton } from "./McLobbyButton.js";

if (!customElements.get("mc-lobby-button")) {
  customElements.define("mc-lobby-button", McLobbyButton);
}

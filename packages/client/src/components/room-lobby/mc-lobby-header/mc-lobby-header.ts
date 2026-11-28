import { McLobbyHeader } from "./McLobbyHeader.js";

if (!customElements.get("mc-lobby-header")) {
  customElements.define("mc-lobby-header", McLobbyHeader);
}

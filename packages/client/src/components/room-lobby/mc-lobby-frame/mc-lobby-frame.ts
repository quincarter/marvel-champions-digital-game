import { McLobbyFrame } from "./McLobbyFrame.js";

if (!customElements.get("mc-lobby-frame")) {
  customElements.define("mc-lobby-frame", McLobbyFrame);
}

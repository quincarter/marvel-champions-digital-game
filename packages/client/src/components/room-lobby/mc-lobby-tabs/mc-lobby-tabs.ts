import { McLobbyTabs } from "./McLobbyTabs.js";

if (!customElements.get("mc-lobby-tabs")) {
  customElements.define("mc-lobby-tabs", McLobbyTabs);
}

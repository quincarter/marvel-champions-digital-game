import { McLobbyEpic } from "./McLobbyEpic.js";

if (!customElements.get("mc-lobby-epic")) {
  customElements.define("mc-lobby-epic", McLobbyEpic);
}

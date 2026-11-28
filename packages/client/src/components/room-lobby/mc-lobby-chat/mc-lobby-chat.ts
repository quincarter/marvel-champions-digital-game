import { McLobbyChat } from "./McLobbyChat";
if (!customElements.get("mc-lobby-chat")) {
  customElements.define("mc-lobby-chat", McLobbyChat);
}

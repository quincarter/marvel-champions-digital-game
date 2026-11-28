import { McLobbyCompetitive } from "./McLobbyCompetitive.js";

if (!customElements.get("mc-lobby-competitive")) {
  customElements.define("mc-lobby-competitive", McLobbyCompetitive);
}

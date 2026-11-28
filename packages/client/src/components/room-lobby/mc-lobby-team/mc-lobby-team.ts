import { McLobbyTeam } from "./McLobbyTeam.js";

if (!customElements.get("mc-lobby-team")) {
  customElements.define("mc-lobby-team", McLobbyTeam);
}

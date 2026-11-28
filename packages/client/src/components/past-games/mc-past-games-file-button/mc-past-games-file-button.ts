import { McPastGamesFileButton } from "./McPastGamesFileButton.js";

if (!customElements.get("mc-past-games-file-button")) {
  customElements.define("mc-past-games-file-button", McPastGamesFileButton);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-games-file-button": McPastGamesFileButton;
  }
}

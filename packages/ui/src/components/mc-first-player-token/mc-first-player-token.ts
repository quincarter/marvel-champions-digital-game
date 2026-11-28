import { McFirstPlayerToken } from "./McFirstPlayerToken.js";

if (!customElements.get("mc-first-player-token")) customElements.define("mc-first-player-token", McFirstPlayerToken);

declare global {
  interface HTMLElementTagNameMap {
    "mc-first-player-token": McFirstPlayerToken;
  }
}

export { McFirstPlayerToken };

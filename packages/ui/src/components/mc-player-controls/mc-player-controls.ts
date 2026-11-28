import { McPlayerControls } from "./McPlayerControls.js";

if (!customElements.get("mc-player-controls")) customElements.define("mc-player-controls", McPlayerControls);

declare global {
  interface HTMLElementTagNameMap {
    "mc-player-controls": McPlayerControls;
  }
}

export { McPlayerControls };

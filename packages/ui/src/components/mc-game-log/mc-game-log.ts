import { McGameLog } from "./McGameLog.js";

if (!customElements.get("mc-game-log")) customElements.define("mc-game-log", McGameLog);

declare global {
  interface HTMLElementTagNameMap {
    "mc-game-log": McGameLog;
  }
}

export { McGameLog };

import { McRoundStrip } from "./McRoundStrip.js";

if (!customElements.get("mc-round-strip")) {
  customElements.define("mc-round-strip", McRoundStrip);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-round-strip": McRoundStrip;
  }
}

export { McRoundStrip };

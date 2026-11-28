import { McChatLines } from "./McChatLines.js";

if (!customElements.get("mc-chat-lines")) {
  customElements.define("mc-chat-lines", McChatLines);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-chat-lines": McChatLines;
  }
}

export { McChatLines };

import { McChatCompose } from "./McChatCompose.js";

if (!customElements.get("mc-chat-compose")) {
  customElements.define("mc-chat-compose", McChatCompose);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-chat-compose": McChatCompose;
  }
}

export { McChatCompose };

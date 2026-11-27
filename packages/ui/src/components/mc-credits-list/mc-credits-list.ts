import { McCreditsList } from "./McCreditsList.js";

if (!customElements.get("mc-credits-list")) customElements.define("mc-credits-list", McCreditsList);

declare global {
  interface HTMLElementTagNameMap {
    "mc-credits-list": McCreditsList;
  }
}

export { McCreditsList };

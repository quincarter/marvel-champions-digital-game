import { McEmptyState } from "./McEmptyState.js";

if (!customElements.get("mc-empty-state")) customElements.define("mc-empty-state", McEmptyState);

declare global {
  interface HTMLElementTagNameMap {
    "mc-empty-state": McEmptyState;
  }
}

export { McEmptyState };

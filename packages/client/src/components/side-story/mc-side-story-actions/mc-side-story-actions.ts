import { McSideStoryActions } from "./McSideStoryActions.js";

if (!customElements.get("mc-side-story-actions")) {
  customElements.define("mc-side-story-actions", McSideStoryActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-side-story-actions": McSideStoryActions;
  }
}

export { McSideStoryActions };

import { McSideStoryHeader } from "./McSideStoryHeader.js";

if (!customElements.get("mc-side-story-header")) {
  customElements.define("mc-side-story-header", McSideStoryHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-side-story-header": McSideStoryHeader;
  }
}

export { McSideStoryHeader };

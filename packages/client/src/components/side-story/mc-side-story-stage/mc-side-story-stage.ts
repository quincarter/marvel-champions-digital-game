import { McSideStoryStage } from "./McSideStoryStage.js";

if (!customElements.get("mc-side-story-stage")) {
  customElements.define("mc-side-story-stage", McSideStoryStage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-side-story-stage": McSideStoryStage;
  }
}

export { McSideStoryStage };

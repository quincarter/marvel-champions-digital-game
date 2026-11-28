import { LitElement } from "lit";
import { sideStoryEvent, type SideStoryEventDetail } from "./side-story-events.types.js";

/** The base of the side-story elements: one typed way to speak to the scene (`mc-side-story`). */
export abstract class SideStoryElement extends LitElement {
  protected emit(detail: SideStoryEventDetail): void {
    this.dispatchEvent(sideStoryEvent(detail));
  }
}

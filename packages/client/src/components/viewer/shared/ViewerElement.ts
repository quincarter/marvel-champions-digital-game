import { LitElement } from "lit";
import { viewerEvent, type ViewerEventDetail } from "./viewer-events.types.js";

/** The base of the Extras viewer elements: one typed way to speak to the scene (`mc-viewer`). */
export abstract class ViewerElement extends LitElement {
  protected emit(detail: ViewerEventDetail): void {
    this.dispatchEvent(viewerEvent(detail));
  }
}

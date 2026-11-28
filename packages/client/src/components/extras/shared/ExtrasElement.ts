import { LitElement } from "lit";
import { extrasEvent, type ExtrasEventDetail } from "./extras-events.types.js";

/** The base of the Extras elements: one typed way to speak to the scene (`mc-extras`). */
export abstract class ExtrasElement extends LitElement {
  protected emit(detail: ExtrasEventDetail): void {
    this.dispatchEvent(extrasEvent(detail));
  }
}

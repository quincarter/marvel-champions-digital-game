import { LitElement } from "lit";
import { readerEvent, type ReaderEventDetail } from "./reader-events.types.js";

/**
 * The base of the Extras reader elements: one way to speak to the scene (`mc-reader`, typed). Presses go through
 * `mc-button` / the table of contents, which already answer the focus route's `click()` and ignore the lift that ends a
 * swipe.
 */
export abstract class ReaderElement extends LitElement {
  protected emit(detail: ReaderEventDetail): void {
    this.dispatchEvent(readerEvent(detail));
  }
}

import { LitElement } from "lit";
import { rulesEvent, type RulesEventDetail } from "./rules-events.types.js";

/** The base of the Rules reference elements: one typed way to speak to the scene (`mc-rules`). */
export abstract class RulesElement extends LitElement {
  protected emit(detail: RulesEventDetail): void {
    this.dispatchEvent(rulesEvent(detail));
  }
}

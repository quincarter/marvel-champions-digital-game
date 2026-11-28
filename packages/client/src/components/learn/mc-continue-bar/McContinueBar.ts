import { html, type PropertyDeclarations } from "lit";
import { LearnElement } from "../shared/LearnElement.js";
import { McContinueBarStyles } from "./mc-continue-bar.styles.js";
import type { ContinueBarProps } from "./mc-continue-bar.types.js";

/**
 * # Continue bar
 * The How to play hub's one red forward action, "Continue learning ▸" (or "Play it again ▸" once every lesson is done): it
 * starts the first lesson not yet done. It waits (dimmed, no press) while the tutorial game is being made and says so in
 * its words. The focus stop is `continue-learning`.
 *
 * @element mc-continue-bar
 * @attr label - The button's words, already translated.
 * @attr starting - The tutorial game is being made.
 * @fires mc-learn - `{ type: "continue" }`.
 */
export class McContinueBar extends LearnElement implements ContinueBarProps {
  static override styles = [McContinueBarStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    starting: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare starting: boolean;

  constructor() {
    super();
    this.label = "";
    this.starting = false;
  }

  override render() {
    return html`<mc-button
      kind="primary"
      display
      data-stop="continue-learning"
      .label=${this.label}
      ?disabled=${this.starting}
      @mc-press=${(event: Event) => {
        event.stopPropagation();
        this.emit({ type: "continue" });
      }}
    ></mc-button>`;
  }
}

import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import "../mc-rules-step/mc-rules-step.js";
import { McRulesVillainPhaseStyles } from "./mc-rules-villain-phase.styles.js";
import type { McRulesVillainPhaseProps } from "./mc-rules-villain-phase.types.js";
import type { RulesStepModel } from "../mc-rules-step/mc-rules-step.types.js";

/**
 * # Rules villain phase
 * The Villain phase tab: the six steps in order in a scrolling list, with the rules citation under it.
 *
 * @element mc-rules-villain-phase
 */
export class McRulesVillainPhase extends RulesElement implements McRulesVillainPhaseProps {
  static override styles = [ThemeStyles, McRulesVillainPhaseStyles];

  static override properties: PropertyDeclarations = {
    steps: { attribute: false },
    citation: { type: String },
  };

  declare steps: readonly RulesStepModel[];
  declare citation: string;

  constructor() {
    super();
    this.steps = [];
    this.citation = "";
  }

  /** The scrolling element. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  override render() {
    return html`<div class="scroller">
        ${this.steps.map((step) => html`<mc-rules-step .step=${step}></mc-rules-step>`)}
      </div>
      <div class="citation">${this.citation}</div>`;
  }
}

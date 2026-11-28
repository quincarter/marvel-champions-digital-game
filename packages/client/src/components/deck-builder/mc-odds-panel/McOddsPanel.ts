import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type StepperPressDetail } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import type { OddsPart } from "../shared/deck-builder-events.types.js";
import { McOddsPanelStyles } from "./mc-odds-panel.styles.js";
import type { OddsModel } from "./mc-odds-panel.types.js";

/**
 * # Odds panel
 * The draw odds: which group of cards (a stepper that wraps), how many are drawn (a stepper whose middle goes back to the
 * opening hand), and the chance of drawing 0, 1, 2 and 3+ of the group, and of at least one (`view/deck-odds.ts`).
 *
 * Focus stops: `odds:prev`, `odds:group`, `odds:next`, `odds:fewer`, `odds:draws`, `odds:more`.
 *
 * @element mc-odds-panel
 * @prop model - The odds (`OddsModel`).
 * @fires mc-deck-builder - `odds` `{ part }`.
 */
export class McOddsPanel extends BuilderElement {
  static override styles = [ThemeStyles, McOddsPanelStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: OddsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  #group = (event: CustomEvent<StepperPressDetail>): void => {
    event.stopPropagation();
    this.emit({ type: "odds", part: event.detail.part === "prev" ? "group-prev" : "group-next" });
  };

  #draws = (event: CustomEvent<StepperPressDetail>): void => {
    event.stopPropagation();
    const part: OddsPart = event.detail.part === "prev" ? "fewer" : event.detail.part === "next" ? "more" : "opening";
    this.emit({ type: "odds", part });
  };

  override render() {
    const model = this.model;
    if (!model) return nothing;
    if (model.empty !== null) return html`<div class="empty" data-key="odds-empty">${model.empty}</div>`;
    return html`<mc-stepper
        prev-stop="odds:prev"
        name-stop="odds:group"
        next-stop="odds:next"
        .label=${model.group}
        @mc-stepper-press=${this.#group}
      ></mc-stepper>
      <mc-stepper
        prev-stop="odds:fewer"
        name-stop="odds:draws"
        next-stop="odds:more"
        prev-label="−"
        next-label="+"
        .label=${model.draws}
        ?prev-disabled=${!model.canFewer}
        ?next-disabled=${!model.canMore}
        @mc-stepper-press=${this.#draws}
      ></mc-stepper>
      <div class="line" data-key="odds-line">${model.line}</div>
      <div class="line">${model.atLeast}</div>`;
  }
}

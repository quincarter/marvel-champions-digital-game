import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { BuilderStepView } from "../../../view/civil-war-builder-model.js";
import { CIVIL_WAR_EVENT, type CivilMode, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilRailStyles } from "./mc-civil-rail.styles.js";

/**
 * # Civil War step rail
 * The five steps (side, leader, main scheme, modular sets, review and play). Wide and tablet: a column of cards, each its
 * number and name, what is picked so far in one line and a "!" while it is incomplete. Phone: a bar of numbers (a "!" after an
 * incomplete one). The active step is the red-bordered card or the ink cell; every step is a focus stop keyed by its action.
 *
 * @element mc-civil-rail
 * @prop steps - `BuilderStepView[]`.
 * @attr mode - wide | tablet | phone.
 * @fires mc-civil-war - `{ type: "act", action }` for a step.
 */
export class McCivilRail extends LitElement {
  static override styles = [McCivilRailStyles];

  static override properties: PropertyDeclarations = {
    steps: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare steps: readonly BuilderStepView[];
  declare mode: CivilMode;

  constructor() {
    super();
    this.steps = [];
    this.mode = "wide";
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  override render() {
    if (this.mode === "phone") {
      return html`${this.steps.map(
        (step) =>
          html`<mc-press-card
            class="cell"
            .stop=${step.action}
            ?selected=${step.active}
            .action=${{ type: "act", action: step.action } satisfies CivilWarEventDetail}
            ><span class="mark"
              >${step.step}${step.complete ? nothing : html`<span class="bang" aria-label="incomplete">!</span>`}</span
            ></mc-press-card
          >`,
      )}`;
    }
    return html`${this.steps.map(
      (step) =>
        html`<mc-press-card
          .stop=${step.action}
          ?selected=${step.active}
          .action=${{ type: "act", action: step.action } satisfies CivilWarEventDetail}
        >
          <div class="head">
            <span class="name">${step.step}. ${step.title}</span>${
              step.complete ? nothing : html`<span class="bang" aria-label="incomplete">!</span>`
            }
          </div>
          <div class="line">${step.line}</div>
        </mc-press-card>`,
    )}`;
  }
}

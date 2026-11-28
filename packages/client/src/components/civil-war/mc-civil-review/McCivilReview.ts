import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../mc-civil-summary/mc-civil-summary.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { BuilderView } from "../../../view/civil-war-builder-model.js";
import { CIVIL_WAR_EVENT, type CivilPictures, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilReviewStyles } from "./mc-civil-review.styles.js";

const act = (action: string): CivilWarEventDetail => ({ type: "act", action });

/**
 * # Civil War review
 * Step 5: the scenario summary (here only where the review column is not beside it: tablet and phone), the Preconstructed
 * button, Standard or Expert, the three "keep" pins Random reads, and the game mode. Each is a press card, the chosen one
 * red-bordered; a mode that is not offered is faded, and its note says why.
 *
 * @element mc-civil-review
 * @prop view - `BuilderView`.
 * @prop pictures - `CivilPictures`.
 * @attr with-summary - Show the summary above (no review column beside the step).
 * @fires mc-civil-war - `{ type: "act", action }`.
 */
export class McCivilReview extends LitElement {
  static override styles = [McCivilReviewStyles];

  static override properties: PropertyDeclarations = {
    view: { attribute: false },
    pictures: { attribute: false },
    withSummary: { type: Boolean, attribute: "with-summary" },
  };

  declare view: BuilderView | null;
  declare pictures: CivilPictures | null;
  declare withSummary: boolean;

  constructor() {
    super();
    this.view = null;
    this.pictures = null;
    this.withSummary = false;
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  override render() {
    const view = this.view;
    if (!view) return nothing;
    return html`${this.withSummary ? html`<mc-civil-summary .view=${view} .pictures=${this.pictures}></mc-civil-summary>` : nothing}
      <mc-press-card
        class="pre"
        .stop=${"civil:preconstructed"}
        ?dim=${!view.preconstructedEnabled}
        .action=${act("civil:preconstructed")}
        >Preconstructed</mc-press-card
      >
      <div class="row">
        ${view.difficultyChoices.map(
          (choice) =>
            html`<mc-press-card .stop=${choice.action} ?selected=${choice.selected} .action=${act(choice.action)}>
              <div class="name">${choice.name}</div>
              <div class="note">${choice.description}</div>
            </mc-press-card>`,
        )}
      </div>
      <div class="row pins">
        ${view.randomPins.map(
          (pin) =>
            html`<mc-press-card .stop=${pin.action} ?selected=${pin.on} .action=${act(pin.action)}
              >${pin.label}</mc-press-card
            >`,
        )}
      </div>
      <div class="row">
        ${view.modeOptions.map(
          (mode) =>
            html`<mc-press-card
              .stop=${`civil:mode:${mode.id}`}
              ?selected=${mode.selected}
              ?dim=${!mode.enabled}
              .action=${act(`civil:mode:${mode.id}`)}
              >${mode.label} · ${mode.note}</mc-press-card
            >`,
        )}
      </div>`;
  }
}

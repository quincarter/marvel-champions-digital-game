import { html, nothing, type PropertyDeclarations } from "lit";
import { LearnElement } from "../shared/LearnElement.js";
import type { GuideOptionModel } from "../mc-guide-option/mc-guide-option.types.js";
import { McGuideOptionsStyles } from "./mc-guide-options.styles.js";
import type { GuideOptionsProps } from "./mc-guide-options.types.js";

/**
 * # Guide options
 * The chooser's column: its one-line subtitle over the three guide levels as radio cards (`mc-guide-option`). On the wide
 * screen the recommended card also holds the tutorial's five lessons as small chips, in their real order. A tap on a card
 * is `{ type: "option", value }` as `mc-learn`; the chosen level is the scene's, passed in each card's model.
 *
 * @element mc-guide-options
 * @attr subtitle - The line over the cards, already translated.
 * @prop options - The cards (`GuideOptionModel`).
 * @prop chips - The lesson chips shown in the recommended card (none on a narrow screen).
 * @fires mc-learn - `{ type: "option", value }`.
 */
export class McGuideOptions extends LearnElement implements GuideOptionsProps {
  static override styles = [McGuideOptionsStyles];

  static override properties: PropertyDeclarations = {
    subtitle: { type: String },
    options: { attribute: false },
    chips: { attribute: false },
  };

  declare subtitle: string;
  declare options: readonly GuideOptionModel[];
  declare chips: readonly string[];

  constructor() {
    super();
    this.subtitle = "";
    this.options = [];
    this.chips = [];
  }

  override render() {
    return html`<p class="subtitle">${this.subtitle}</p>
      <div class="list" role="radiogroup">
        ${this.options.map(
          (option) =>
            html`<mc-guide-option .model=${option}>
              ${
                option.recommended && this.chips.length > 0
                  ? html`<div class="chips">
                      ${this.chips.map((chip) => html`<mc-stamp label=${chip}></mc-stamp>`)}
                    </div>`
                  : nothing
              }
            </mc-guide-option>`,
        )}
      </div>`;
  }
}

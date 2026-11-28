import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-carry-in/mc-briefing-carry-in.js";
import "../mc-briefing-framed-row/mc-briefing-framed-row.js";
import "../mc-briefing-kicker/mc-briefing-kicker.js";
import "../mc-briefing-pick-card/mc-briefing-pick-card.js";
import { McBriefingSchemeStyles } from "./mc-briefing-scheme.styles.js";
import type { SchemeSectionModel } from "./mc-briefing-scheme.types.js";

/**
 * # Briefing side scheme
 * What the answered side-scheme choice leaves on the Briefing (NeXt Evolution, MC40 p. 7): the chosen row with its cards as
 * pictures (each opens Inspect and answers nothing), "Same as last time" when a retry repeats it, what carries in from the log
 * (`mc-briefing-carry-in`), and the encounter sets the issue fixes. The picker itself is a call (`mc-briefing-scheme-pick`).
 *
 * @element mc-briefing-scheme
 * @prop model - `SchemeSectionModel`.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`, from a picture or a chip.
 */
export class McBriefingScheme extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingSchemeStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: SchemeSectionModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-section-heading .label=${t("briefing.scheme.heading").toLocaleUpperCase()}></mc-section-heading>
      ${
        m.chosen
          ? html`<mc-briefing-framed-row class="chosen" stripe="heal">
              <div class="chosen-body">
                <span class="heading display">${m.chosen.heading}</span>
                ${m.chosen.repeated ? html`<mc-briefing-kicker tone="cost" .text=${t("briefing.scheme.same")}></mc-briefing-kicker>` : nothing}
                <div class="cards">
                  ${m.chosen.cards.map(
                    (card) =>
                      html`<mc-briefing-pick-card
                        .stop=${`scheme-chosen:${card.key}`}
                        .card=${card}
                        badge
                      ></mc-briefing-pick-card>`,
                  )}
                </div>
              </div>
            </mc-briefing-framed-row>`
          : nothing
      }
      ${m.carryIns.map((carry) => html`<mc-briefing-carry-in .carry=${carry}></mc-briefing-carry-in>`)}
      ${
        m.fixedSets
          ? html`<mc-briefing-framed-row class="fixed" fill="parchment">
              <div class="fixed-body">
                <mc-briefing-kicker .text=${t("briefing.scheme.fixed")}></mc-briefing-kicker>
                <span class="row-title sets">${m.fixedSets}</span>
              </div>
            </mc-briefing-framed-row>`
          : nothing
      }`;
  }
}

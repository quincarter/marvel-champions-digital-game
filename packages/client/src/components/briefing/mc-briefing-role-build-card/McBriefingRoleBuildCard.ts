import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-card-thumb/mc-briefing-card-thumb.js";
import { costLineOf } from "../mc-briefing-role-build-list/cost-line.js";
import { McBriefingRoleBuildCardStyles } from "./mc-briefing-role-build-card.styles.js";
import type { RoleBuildCardModel } from "./mc-briefing-role-build-card.types.js";

/**
 * # Briefing role-building confirm card
 * Role-building confirm step: "ADD DROP KICK TO COLOSSUS DECK?". The card picture beside its name, cost, why it is recommended
 * (when it is) and what taking it does. Only Confirm (the bar under it) records the card; Back returns to the same place in the
 * list; Inspect reads the card. The picture is the card, not a press: the bar has the Inspect button.
 *
 * @element mc-briefing-role-build-card
 * @prop model - `RoleBuildCardModel`.
 */
export class McBriefingRoleBuildCard extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingRoleBuildCardStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: RoleBuildCardModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const { card } = m;
    return html`<h3 class="title display ${m.phone ? "phone" : ""}">
        ${t("briefing.call.build.confirmTitle", { card: card.name, hero: m.heroName }).toLocaleUpperCase()}
      </h3>
      <div class="body-row ${m.phone ? "phone" : ""}">
        <mc-briefing-card-thumb .picture=${m.picture}></mc-briefing-card-thumb>
        <div class="text">
          <span class="name">${card.label}</span>
          <span class="name cost">${costLineOf(card)}</span>
          ${card.reason ? html`<span class="note">${t("briefing.call.build.recommendedReason", { reason: card.reason })}</span>` : nothing}
          <span class="note">${t(`briefing.call.build.confirmDetail_${m.noun}`)}</span>
        </div>
      </div>`;
  }
}

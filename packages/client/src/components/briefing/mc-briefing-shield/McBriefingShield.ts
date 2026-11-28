import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import { sectionTextIn } from "../shared/section-text.js";
import "../mc-briefing-kicker/mc-briefing-kicker.js";
import "../mc-briefing-shield-pictures/mc-briefing-shield-pictures.js";
import { McBriefingShieldStyles } from "./mc-briefing-shield.styles.js";
import type { ShieldSectionModel } from "./mc-briefing-shield.types.js";
import { boardHeadingIn, evidenceHeadingIn, membersLineIn, openLineIn } from "./shield-text.js";

/**
 * # Briefing case file
 * The Briefing case file (Agents of S.H.I.E.L.D., MC50 pp. 5, 6 and 24): the evidence the players hold as pictures, how many
 * combinations are still open, the Executive Board secrets and which members are attachments now, the numbers the next Setups read,
 * and in an expert campaign each seat hit points. Plain drawing over `ShieldBriefing` (`view/campaign-shield-model.ts`); it never
 * reads the sealed A.I.M. envelope.
 *
 * @element mc-briefing-shield
 * @prop model - `ShieldSectionModel`.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`, from a picture.
 */
export class McBriefingShield extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingShieldStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: ShieldSectionModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const { shield } = m;
    const text = sectionTextIn();
    return html`<mc-section-heading .label=${t("briefing.shield.heading").toLocaleUpperCase()}></mc-section-heading>
      <mc-briefing-kicker .text=${evidenceHeadingIn(m.evidence.length)}></mc-briefing-kicker>
      ${m.evidence.length > 0 ? html`<mc-briefing-shield-pictures key-base="shield-evidence" ?phone=${m.phone} .cards=${m.evidence}></mc-briefing-shield-pictures>` : nothing}
      <p class="note">${openLineIn(shield)}</p>
      <p class="note strong">${membersLineIn(shield.members)}</p>
      <mc-briefing-kicker class="gap" .text=${boardHeadingIn(shield.boardAfter)}></mc-briefing-kicker>
      ${m.board.length > 0 ? html`<mc-briefing-shield-pictures key-base="shield-board" ?phone=${m.phone} .cards=${m.board}></mc-briefing-shield-pictures>` : nothing}
      <p class="note strong">${text.flipNote(shield.flipNote)}</p>
      ${
        shield.numbers.length > 0
          ? html`<mc-briefing-kicker class="gap" .text=${t("briefing.shield.carried")}></mc-briefing-kicker>
              ${shield.numbers.map(
                (row) =>
                  html`<p class="note">
                    ${`${text.numberLabel(row.label)}: ${row.value}  (${text.numberUsedIn(row.usedIn)})`}
                  </p>`,
              )}`
          : nothing
      }
      ${
        shield.seats.length > 0
          ? html`<mc-briefing-kicker class="gap" .text=${t("briefing.shield.expert")}></mc-briefing-kicker>
              ${shield.seats.map(
                (seat) =>
                  html`<p class=${seat.sitsOut ? "note caution" : "note strong"}>
                    ${`${seat.heroName}: ${text.seatStatus(seat.status)}`}
                  </p>`,
              )}`
          : nothing
      }`;
  }
}

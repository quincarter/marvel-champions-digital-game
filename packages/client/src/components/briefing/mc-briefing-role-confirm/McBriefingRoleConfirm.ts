import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-confirm-bar/mc-briefing-confirm-bar.js";
import { McBriefingRoleConfirmStyles } from "./mc-briefing-role-confirm.styles.js";
import type { RoleConfirmModel } from "./mc-briefing-role-confirm.types.js";

/**
 * # Briefing role confirm
 * The role call confirm step ("COLOSSUS WILL BE THE BRAWLER"): the role aspect chips, its plain-words summary, how it sits against the
 * seat deck and what a role does, in one ink-framed box, with the Back / Confirm bar under it. Only Confirm records the role; Back
 * returns to the tiles. The steps go up to the call that owns them.
 *
 * @element mc-briefing-role-confirm
 * @prop model - `RoleConfirmModel`.
 * @fires mc-briefing-step - `{ type: "back" }` or `{ type: "confirm" }`, from the bar.
 */
export class McBriefingRoleConfirm extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingRoleConfirmStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: RoleConfirmModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="box ${m.phone ? "phone" : ""}">
        <h3 class="title display">${m.title}</h3>
        <span class="chips"
          >${m.chips.map((chip) => html`<mc-aspect-chip aspect=${chip.aspect} label=${chip.label}></mc-aspect-chip>`)}</span
        >
        <p class="summary">${m.summary}</p>
        <span class="label relation">${m.relation}</span>
        <p class="notes">${m.notes.map((line) => html`<span>${line}</span>`)}</p>
      </div>
      <mc-briefing-confirm-bar .model=${m.bar}></mc-briefing-confirm-bar>`;
  }
}

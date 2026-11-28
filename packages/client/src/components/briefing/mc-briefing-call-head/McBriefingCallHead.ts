import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import "../mc-briefing-seat-header/mc-briefing-seat-header.js";
import { McBriefingCallHeadStyles } from "./mc-briefing-call-head.styles.js";
import type { CallHeadModel } from "./mc-briefing-call-head.types.js";

/**
 * # Briefing call head
 * What every call opens with: the "YOUR CALL" heading, the red line saying why Open issue waits, and the seat header of a
 * per-seat call.
 *
 * @element mc-briefing-call-head
 * @prop model - `CallHeadModel`.
 */
export class McBriefingCallHead extends LitElement {
  static override styles = [ThemeStyles, McBriefingCallHeadStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: CallHeadModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-section-heading .label=${t("briefing.call.heading").toLocaleUpperCase()}></mc-section-heading>
      ${m.hint ? html`<p class="hint">${m.hint}</p>` : nothing}
      ${m.seat ? html`<mc-briefing-seat-header ?phone=${m.phone} .model=${m.seat}></mc-briefing-seat-header>` : nothing}`;
  }
}

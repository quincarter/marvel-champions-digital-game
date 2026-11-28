import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import "../mc-briefing-handled-row/mc-briefing-handled-row.js";
import { McBriefingHandledStyles } from "./mc-briefing-handled.styles.js";
import type { HandledModel } from "./mc-briefing-handled.types.js";

/**
 * # Briefing handled for you
 * "Handled for you": one framed list of what setup did automatically (`mc-briefing-handled-row`), under the section heading.
 * While the issue waits on a call, or is still composing, the list is a line saying so instead.
 *
 * @element mc-briefing-handled
 * @prop model - `HandledModel`.
 */
export class McBriefingHandled extends LitElement {
  static override styles = [ThemeStyles, McBriefingHandledStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: HandledModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-section-heading .label=${t("briefing.handled").toLocaleUpperCase()}></mc-section-heading>
      ${
        m.waiting !== null
          ? html`<p class="note">${m.waiting}</p>`
          : m.rows.length === 0
            ? html`<p class="none">${t("briefing.handled.none")}</p>`
            : html`<div class="list">
                ${m.rows.map((row) => html`<mc-briefing-handled-row .row=${row}></mc-briefing-handled-row>`)}
              </div>`
      }`;
  }
}

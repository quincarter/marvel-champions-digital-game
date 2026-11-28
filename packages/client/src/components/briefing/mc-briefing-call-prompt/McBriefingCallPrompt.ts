import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import { McBriefingCallPromptStyles } from "./mc-briefing-call-prompt.styles.js";
import type { CallPromptModel } from "./mc-briefing-call-prompt.types.js";

/**
 * # Briefing call prompt
 * What a plain pick (role tiles, accept / decline, a list of options) says about its question: who is deciding (a decision for the
 * whole table is labelled as that, never spoken as if "the team" were a character), the box plain words and the printed rule under
 * its own "The rule" label.
 *
 * @element mc-briefing-call-prompt
 * @prop model - `CallPromptModel`.
 */
export class McBriefingCallPrompt extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingCallPromptStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: CallPromptModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`${m.who ? html`<span class="label red">${m.who.toLocaleUpperCase()}</span>` : nothing}
      ${
        m.explain
          ? html`<p class="explain">${m.explain}</p>
              <span class="label quiet">${t("briefing.call.rule").toLocaleUpperCase()}</span>`
          : nothing
      }
      <p class="rule">${m.rule}</p>`;
  }
}

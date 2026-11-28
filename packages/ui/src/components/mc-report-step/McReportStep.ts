import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { findKey, popupButton } from "../../shared/popup-parts.js";
import { McReportStepStyles } from "./mc-report-step.styles.js";
import type { ReportStep } from "./mc-report-step.types.js";

/**
 * # Report step
 * One numbered step of "Report an issue": a heading, what to do in a sentence or two, and rows of buttons.
 *
 * @element mc-report-step
 * @attr phone - A phone's smaller type (reflected).
 * @fires mc-activate - `detail.key`: one of the step's buttons was pressed.
 */
export class McReportStep extends LitElement {
  static override styles = [ThemeStyles, McReportStepStyles];

  static override properties: PropertyDeclarations = {
    step: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare step: ReportStep | null;
  declare phone: boolean;

  constructor() {
    super();
    this.step = null;
    this.phone = false;
  }

  /** The step's button with this key, or null. */
  elementOf(key: string): HTMLElement | null {
    return findKey(this.renderRoot as ShadowRoot, key);
  }

  override render() {
    const step = this.step;
    if (!step) return nothing;
    return html`<h3>${step.title}</h3>
      <p>${step.body}</p>
      ${step.rows.map((row) => html`<div class="row">${row.map((button) => popupButton(this, button))}</div>`)}`;
  }
}

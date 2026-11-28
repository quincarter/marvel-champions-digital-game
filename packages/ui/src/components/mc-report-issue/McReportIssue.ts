import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { findKey, popupButton } from "../../shared/popup-parts.js";
import "../mc-report-step/mc-report-step.js";
import { McReportIssueStyles } from "./mc-report-issue.styles.js";
import type { ReportIssueModel } from "./mc-report-issue.types.js";

/**
 * # Report an issue
 * The dialog behind the Report button: take a screenshot, save the log, tell us about it. Each step is an
 * `mc-report-step`; a screen that is wide but short sets them in two columns. A scrim dims the screen under it.
 *
 * @element mc-report-issue
 * @attr columns - 1 or 2 (reflected from the model).
 * @attr phone - A phone layout (reflected).
 * @fires mc-activate - `detail.key`: a step's button or the close button.
 */
export class McReportIssue extends LitElement {
  static override styles = [ThemeStyles, McReportIssueStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    columns: { type: Number, reflect: true },
    phone: { type: Boolean, reflect: true },
  };

  declare model: ReportIssueModel | null;
  declare columns: number;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.columns = 1;
    this.phone = false;
  }

  override willUpdate(): void {
    this.columns = this.model?.columns ?? 1;
    this.phone = this.model?.phone ?? false;
    if (this.model) this.style.setProperty("--mc-scrim", String(this.model.scrim));
  }

  /** The element drawn for a control's key (a step's button, close), or null. */
  elementOf(key: string): HTMLElement | null {
    return findKey(this.renderRoot as ShadowRoot, key);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    // Two columns: the first two steps, then the third.
    const columns = m.columns === 2 ? [m.steps.slice(0, 2), m.steps.slice(2)] : [m.steps];
    return html`<div class="scrim"></div>
      <div class="box">
        <div class="head">
          <span class="title">${m.title}</span>
          <div class="close">${popupButton(this, m.close, m.glyphs?.[m.close.key])}</div>
        </div>
        <div class="steps">
          ${columns.map(
            (steps) =>
              html`<div class="col">
                ${steps.map((step) => html`<mc-report-step .step=${step} ?phone=${m.phone}></mc-report-step>`)}
              </div>`,
          )}
        </div>
        ${m.feedback === "" ? nothing : html`<p class="feedback" role="status">${m.feedback}</p>`}
      </div>`;
  }
}

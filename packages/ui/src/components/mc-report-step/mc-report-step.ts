import { McReportStep } from "./McReportStep.js";

if (!customElements.get("mc-report-step")) customElements.define("mc-report-step", McReportStep);

declare global {
  interface HTMLElementTagNameMap {
    "mc-report-step": McReportStep;
  }
}

export { McReportStep };

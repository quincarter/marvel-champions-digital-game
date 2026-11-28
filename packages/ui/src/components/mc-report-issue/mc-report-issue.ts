import { McReportIssue } from "./McReportIssue.js";

if (!customElements.get("mc-report-issue")) customElements.define("mc-report-issue", McReportIssue);

declare global {
  interface HTMLElementTagNameMap {
    "mc-report-issue": McReportIssue;
  }
}

export { McReportIssue };

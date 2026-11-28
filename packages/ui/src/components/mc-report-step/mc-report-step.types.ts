import type { PopupButton } from "../../shared/popup.types.js";

/** One step of "Report an issue": a heading, a paragraph and rows of buttons (each row's buttons share its width). */
export interface ReportStep {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly rows: readonly (readonly PopupButton[])[];
}

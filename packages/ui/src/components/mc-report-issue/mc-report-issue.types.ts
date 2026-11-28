import type { ControlGlyphs, PopupButton } from "../../shared/popup.types.js";
import type { ReportStep } from "../mc-report-step/mc-report-step.types.js";

/** The "Report an issue" dialog: its title, the three steps, the line the last action said, and the close button. */
export interface ReportIssueModel {
  readonly title: string;
  readonly close: PopupButton;
  readonly steps: readonly ReportStep[];
  /** What the last Copy or Download said ("Log copied"), or empty. */
  readonly feedback: string;
  /** Two columns on a screen that is wide but short (a phone on its side). */
  readonly columns: 1 | 2;
  readonly phone: boolean;
  /** The dim over the screen, 0 to 1. */
  readonly scrim: number;
  readonly glyphs?: ControlGlyphs;
}

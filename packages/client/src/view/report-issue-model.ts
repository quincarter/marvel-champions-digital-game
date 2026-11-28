/**
 * What the Report pop-up (`scenes/report-issue.ts`) hands its `mc-report-issue` element: the three steps worded in the
 * app's language, the close button, the line the last action said, and the layout flags. Pure.
 */
import type { ControlGlyphs, ReportIssueModel, ReportStep } from "@mc/ui";
import { t } from "../i18n/translate.js";
import { formFactorFor } from "./layout.js";

/** The focus order the dialog's controls take. */
export const REPORT_ORDER: readonly string[] = [
  "hide",
  "copy",
  "download",
  "github",
  "feature",
  "deck",
  "discord",
  "close",
];

/** The three steps; `tip` is this device's screenshot shortcut. */
export function reportStepsOf(tip: string): readonly ReportStep[] {
  return [
    {
      key: "screenshot",
      title: t("report.step1.title"),
      body: t("report.step1.body", { tip }),
      rows: [[{ key: "hide", label: t("report.hide"), kind: "secondary" }]],
    },
    {
      key: "log",
      title: t("report.step2.title"),
      body: t("report.step2.body"),
      rows: [
        [
          { key: "copy", label: t("report.copy"), kind: "secondary" },
          { key: "download", label: t("report.download"), kind: "secondary" },
        ],
      ],
    },
    {
      key: "tell",
      title: t("report.step3.title"),
      body: t("report.step3.body"),
      rows: [
        [{ key: "github", label: t("report.bug"), kind: "primary" }],
        [
          { key: "feature", label: t("report.feature"), kind: "secondary" },
          { key: "deck", label: t("report.deck"), kind: "secondary" },
        ],
        [{ key: "discord", label: t("report.discord"), kind: "secondary" }],
      ],
    },
  ];
}

export function reportIssueModelOf(
  screen: { readonly width: number; readonly height: number },
  tip: string,
  feedback: string,
  glyphs?: ControlGlyphs,
): ReportIssueModel {
  const form = formFactorFor(screen.width, screen.height);
  return {
    title: t("report.title"),
    close: { key: "close", label: "✕", kind: "quiet" },
    steps: reportStepsOf(tip),
    feedback,
    // Two columns when the screen is wide but short (a phone on its side): one column would run off the bottom.
    columns: screen.width >= 700 && screen.height < 600 ? 2 : 1,
    phone: form === "phone" || form === "phoneLandscape",
    scrim: 0.72,
    ...(glyphs ? { glyphs } : {}),
  };
}

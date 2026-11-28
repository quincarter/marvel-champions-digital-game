/**
 * The body of the "Report an issue" panel (`scenes/report-issue.ts`): the three steps laid out as `mc-sheet` parts, in
 * one column or two (a screen that is wide but short, a phone on its side). It holds no state; the scene hands it what
 * each button does and the line it last said, and reads the focus stops back.
 */
import { surface, hit, ink, typeRole, type TypeSpec } from "../tokens.js";
import type { SheetBuilder } from "../dom/sheet-builder.js";
import type { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import type { FocusStop } from "./focus-route.js";

const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };

export type ReportStopId = "close" | "hide" | "copy" | "download" | "github" | "feature" | "deck" | "discord";

/** The focus order the panel's controls take. */
export const REPORT_ORDER: readonly ReportStopId[] = [
  "hide",
  "copy",
  "download",
  "github",
  "feature",
  "deck",
  "discord",
  "close",
];

interface Button {
  readonly id: ReportStopId;
  readonly label: string;
  readonly look: "primary" | "secondary";
}

interface Step {
  readonly title: string;
  readonly body: string;
  readonly rows: readonly (readonly Button[])[];
}

/** The three steps, worded in the app's language; `tip` is this device's screenshot shortcut. */
export function reportSteps(tip: string): readonly Step[] {
  return [
    {
      title: t("report.step1.title"),
      body: t("report.step1.body", { tip }),
      rows: [[{ id: "hide", label: t("report.hide"), look: "secondary" }]],
    },
    {
      title: t("report.step2.title"),
      body: t("report.step2.body"),
      rows: [
        [
          { id: "copy", label: t("report.copy"), look: "secondary" },
          { id: "download", label: t("report.download"), look: "secondary" },
        ],
      ],
    },
    {
      title: t("report.step3.title"),
      body: t("report.step3.body"),
      rows: [
        [{ id: "github", label: t("report.bug"), look: "primary" }],
        [
          { id: "feature", label: t("report.feature"), look: "secondary" },
          { id: "deck", label: t("report.deck"), look: "secondary" },
        ],
        [{ id: "discord", label: t("report.discord"), look: "secondary" }],
      ],
    },
  ];
}

/**
 * Lays the panel into `b` (which `PopupSheet.begin` made, scrim laid) and returns the focus stops, each at its rect on
 * the screen. `run` answers a button; `close` is the back-out; `feedback` is the line under the steps ("Log copied").
 */
export function drawReportPanel(
  b: SheetBuilder,
  glyphs: SheetGlyphs,
  options: {
    readonly screen: { readonly width: number; readonly height: number };
    readonly steps: readonly Step[];
    readonly feedback: string;
  },
): Map<ReportStopId, FocusStop> {
  const { width, height } = options.screen;
  const formFactor = formFactorFor(width, height);
  const phone = formFactor === "phone" || formFactor === "phoneLandscape";
  // Two columns when the screen is wide but short (a phone on its side): one column would run off the bottom.
  const columns = width >= 700 && height < 600 ? 2 : 1;
  const pad = phone ? 16 : 24;
  const boxWidth = Math.min(columns === 2 ? 860 : 560, width - (phone ? 16 : 48));
  const columnGap = 24;
  const columnWidth = (boxWidth - pad * 2 - (columns - 1) * columnGap) / columns;
  const bodySize = phone ? 14 : 15;
  const closeSize = hit.target;
  const top = pad + closeSize + 8;
  const placed: { readonly button: Button; readonly rect: Rect }[] = [];
  const headings: { readonly x: number; readonly y: number; readonly text: string }[] = [];
  const bodies: { readonly x: number; readonly y: number; readonly text: string }[] = [];
  const bodyOptions = { size: bodySize, lineSpacing: 3, wrapWidth: columnWidth };
  const headingOptions = { size: phone ? 11 : 12, lineSpacing: 3, wrapWidth: columnWidth };

  /** Lays one column's steps top-down from `top`, at `x` (the box's own origin); returns where it ended. */
  const layColumn = (x: number, steps: readonly Step[]): number => {
    let y = top;
    steps.forEach((step, index) => {
      if (index > 0) y += 18;
      headings.push({ x, y, text: step.title });
      y += b.measure(step.title, typeRole.label, headingOptions).height + 6;
      bodies.push({ x, y, text: step.body });
      y += b.measure(step.body, typeRole.body, bodyOptions).height + 10;
      step.rows.forEach((row, rowIndex) => {
        if (rowIndex > 0) y += 10;
        const each = (columnWidth - 10 * (row.length - 1)) / row.length;
        row.forEach((button, at) => {
          placed.push({ button, rect: { x: x + at * (each + 10), y, width: each, height: hit.target } });
        });
        y += hit.target;
      });
    });
    return y;
  };

  const { steps } = options;
  const ends =
    columns === 2
      ? [layColumn(pad, steps.slice(0, 2)), layColumn(pad + columnWidth + columnGap, steps.slice(2))]
      : [layColumn(pad, steps)];
  let bottom = Math.max(...ends);
  const feedbackOptions = { size: bodySize, wrapWidth: boxWidth - pad * 2 };
  const feedbackAt = bottom + 12;
  if (options.feedback !== "")
    bottom = feedbackAt + b.measure(options.feedback, typeRole.emphasis, feedbackOptions).height;
  const boxHeight = bottom + pad;
  const box: Rect = {
    x: Math.round((width - boxWidth) / 2),
    y: Math.round(Math.max(8, (height - boxHeight) / 2)),
    width: boxWidth,
    height: boxHeight,
  };
  // The box is the first part after the scrim: the pop-up's slide and grab handle read it.
  b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
  const titleText = t("report.title");
  const titleHeight = b.measure(titleText, typeRole.barTitle).height;
  b.text(box.x + pad, box.y + pad + (closeSize - titleHeight) / 2, titleText, typeRole.barTitle, {
    color: surface.ink.hex,
  });
  b.box(
    { x: box.x + pad, y: box.y + top - 4, width: box.width - pad * 2, height: 2 },
    { fill: surface.ink.hex, fillAlpha: ink.meta },
  );
  for (const heading of headings) {
    b.text(box.x + heading.x, box.y + heading.y, heading.text, typeRole.label, {
      ...headingOptions,
      color: surface.ink.hex,
    });
  }
  for (const body of bodies) {
    b.text(box.x + body.x, box.y + body.y, body.text, typeRole.body, {
      ...bodyOptions,
      color: surface.ink.hex,
      alpha: 0.9,
    });
  }
  if (options.feedback !== "") {
    b.text(box.x + pad, box.y + feedbackAt, options.feedback, typeRole.emphasis, {
      ...feedbackOptions,
      color: surface.ink.hex,
    });
  }

  const stops = new Map<ReportStopId, FocusStop>();
  const close: Rect = {
    x: box.x + box.width - pad - closeSize + 8,
    y: box.y + pad - 8,
    width: closeSize,
    height: closeSize,
  };
  glyphs.button(b, {
    key: "close",
    rect: close,
    label: "✕",
    look: "quiet",
    type: BUTTON_TYPE,
    ids: ["cancel"],
    ground: "paper",
  });
  stops.set("close", { rect: close, activate: () => {} });
  for (const { button, rect } of placed) {
    const moved = { ...rect, x: rect.x + box.x, y: rect.y + box.y };
    b.button({ key: button.id, rect: moved, label: button.label, look: button.look, type: BUTTON_TYPE });
    stops.set(button.id, { rect: moved, activate: () => {} });
  }
  return stops;
}

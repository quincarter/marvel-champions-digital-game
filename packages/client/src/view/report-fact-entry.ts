/**
 * The number stepper for a `reportFact` choice whose answer is a whole number (docs/phase7-wave7.md §3.83, Deadpool's
 * Break Time: "how many minutes were you away?"). The engine lists no options for it (a number has no upper bound),
 * so the sheet shows a stepper and answers with the number in decimal digits (`reportedNumberOf` is the engine's own
 * check, used here to confirm every answer the stepper can build is one the engine accepts).
 *
 * A yes/no fact ("did you talk this phase?") has two options and is drawn as the ordinary option list, so it is not
 * handled here.
 *
 * The stepper's cap is a client bound, not the engine's (it accepts up to `Number.MAX_SAFE_INTEGER`): a person
 * counting minutes away does not mean more than a day, and a bound keeps the number legible at phone width.
 */

import { reportedNumberOf, type PendingChoice } from "@mc/engine";

/** Whole minutes in a day: the most the stepper offers. */
export const REPORT_NUMBER_MAX = 1440;

/** One control of the stepper, as a focus stop and a button. */
export type ReportControl = "minus" | "plus" | `set:${number}`;

export interface ReportNumberEntry {
  readonly min: number;
  readonly max: number;
  /** The word after the number ("min"). */
  readonly unit: string;
  /** Absolute values one press sets, smallest first. */
  readonly quickPicks: readonly number[];
  /** What the number starts at: nothing was measured, so 0. */
  readonly start: number;
}

/** The stepper for this choice, or null when it is not a whole-number report (the option list handles it). */
export function reportNumberEntryOf(choice: Pick<PendingChoice, "prompt">): ReportNumberEntry | null {
  const prompt = choice.prompt;
  if (prompt.kind !== "reportFact" || prompt.answer !== "wholeNumber") return null;
  return { min: 0, max: REPORT_NUMBER_MAX, unit: "min", quickPicks: [0, 5, 15, 30, 60], start: 0 };
}

/** The controls in the order focus walks them. */
export function reportControlsOf(entry: ReportNumberEntry): readonly ReportControl[] {
  return ["minus", "plus", ...entry.quickPicks.map((n): ReportControl => `set:${n}`)];
}

/** The value after pressing `control` on `value`, kept within the entry's bounds and whole. */
export function pressReportControl(entry: ReportNumberEntry, value: number, control: ReportControl): number {
  const next = control === "minus" ? value - 1 : control === "plus" ? value + 1 : Number(control.slice(4));
  return clampReport(entry, next);
}

export function clampReport(entry: ReportNumberEntry, value: number): number {
  if (!Number.isFinite(value)) return entry.min;
  return Math.min(entry.max, Math.max(entry.min, Math.trunc(value)));
}

/** Whether `control` would change anything (a disabled minus at the floor, plus at the cap). */
export function reportControlEnabled(entry: ReportNumberEntry, value: number, control: ReportControl): boolean {
  return pressReportControl(entry, value, control) !== value;
}

/** The engine answer for a value: its one selection, the number in decimal digits. */
export function reportAnswerOf(entry: ReportNumberEntry, value: number): readonly string[] {
  return [String(clampReport(entry, value))];
}

/** The value a selection holds, for redrawing the stepper from `#selected`; the start value when it holds none. */
export function reportValueOf(entry: ReportNumberEntry, selected: readonly string[]): number {
  const [text] = selected;
  const n = text === undefined ? null : reportedNumberOf(text);
  return n === null ? entry.start : clampReport(entry, n);
}

/** The label a control wears. */
export function reportControlLabel(control: ReportControl): string {
  return control === "minus" ? "-" : control === "plus" ? "+" : control.slice(4);
}

/** The big number's text: "7 min". */
export function reportValueText(entry: ReportNumberEntry, value: number): string {
  return `${value} ${entry.unit}`;
}

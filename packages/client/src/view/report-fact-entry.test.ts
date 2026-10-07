import { describe, expect, test } from "vitest";
import { reportedNumberOf, type PendingChoice } from "@mc/engine";
import {
  REPORT_NUMBER_MAX,
  pressReportControl,
  reportAnswerOf,
  reportControlEnabled,
  reportControlsOf,
  reportNumberEntryOf,
  reportValueOf,
  reportValueText,
} from "./report-fact-entry.js";

const choiceOf = (prompt: unknown): Pick<PendingChoice, "prompt"> => ({ prompt }) as Pick<PendingChoice, "prompt">;
const entry = reportNumberEntryOf(choiceOf({ kind: "reportFact", fact: "minutesAway", answer: "wholeNumber" }))!;

describe("reportNumberEntryOf", () => {
  test("a whole-number report gets a stepper from 0", () => {
    expect(entry.min).toBe(0);
    expect(entry.start).toBe(0);
    expect(entry.max).toBe(REPORT_NUMBER_MAX);
  });

  test("a yes/no report and other prompts get none (the option list handles them)", () => {
    expect(reportNumberEntryOf(choiceOf({ kind: "reportFact", fact: "talkedThisPhase", answer: "yesNo" }))).toBeNull();
    expect(reportNumberEntryOf(choiceOf({ kind: "chooseNumber", min: 0, max: 4 }))).toBeNull();
  });
});

describe("stepping", () => {
  test("minus stops at 0 and plus stops at the cap", () => {
    expect(pressReportControl(entry, 0, "minus")).toBe(0);
    expect(reportControlEnabled(entry, 0, "minus")).toBe(false);
    expect(pressReportControl(entry, 7, "minus")).toBe(6);
    expect(pressReportControl(entry, REPORT_NUMBER_MAX, "plus")).toBe(REPORT_NUMBER_MAX);
    expect(reportControlEnabled(entry, REPORT_NUMBER_MAX, "plus")).toBe(false);
    expect(reportControlEnabled(entry, 3, "plus")).toBe(true);
  });

  test("no cap at a day: plus keeps going past 1,440 (Q49)", () => {
    expect(pressReportControl(entry, 1440, "plus")).toBe(1441);
    expect(reportControlEnabled(entry, 100000, "plus")).toBe(true);
  });

  test("a quick pick sets the value outright", () => {
    expect(pressReportControl(entry, 2, "set:30")).toBe(30);
    expect(pressReportControl(entry, 44, "set:0")).toBe(0);
  });

  test("focus walks minus, plus, then the quick picks", () => {
    expect(reportControlsOf(entry)).toEqual(["minus", "plus", "set:0", "set:5", "set:15", "set:30", "set:60"]);
  });
});

describe("the answer", () => {
  test("is one selection of decimal digits the engine accepts", () => {
    for (const value of [0, 1, 9, 10, 59, 60, REPORT_NUMBER_MAX]) {
      const answer = reportAnswerOf(entry, value);
      expect(answer).toEqual([String(value)]);
      expect(reportedNumberOf(answer[0]!)).toBe(value);
    }
  });

  test("a stray value is whole and in bounds", () => {
    expect(reportAnswerOf(entry, -3)).toEqual(["0"]);
    expect(reportAnswerOf(entry, 2.9)).toEqual(["2"]);
    expect(reportAnswerOf(entry, 1e9)).toEqual(["1000000000"]);
    expect(reportAnswerOf(entry, 1e300)).toEqual([String(REPORT_NUMBER_MAX)]);
    expect(reportAnswerOf(entry, Number.NaN)).toEqual(["0"]);
  });

  test("the selection is read back, and starts at 0 when empty", () => {
    expect(reportValueOf(entry, ["12"])).toBe(12);
    expect(reportValueOf(entry, [])).toBe(0);
    expect(reportValueOf(entry, ["012"])).toBe(0);
    expect(reportValueText(entry, 12)).toBe("12 min");
  });
});

import { describe, expect, test } from "vitest";
import { reportedNumberOf } from "@mc/engine";
import {
  BREAK_START_KEY,
  breakAnswerAt,
  breakReadout,
  breakStartedAt,
  clearBreakStart,
  isBreakChoice,
} from "./break-timer.js";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

const id = { seed: 7, choiceId: "c12", playerId: "p1" };
const T0 = 1_700_000_000_000;

describe("breakReadout", () => {
  test("0:59 is 0 minutes and 1:00 is 1, rounded down", () => {
    expect(breakReadout(T0, T0 + 59_999).minutes).toBe(0);
    expect(breakReadout(T0, T0 + 59_000).clockText).toBe("0:59");
    expect(breakReadout(T0, T0 + 60_000).minutes).toBe(1);
    expect(breakReadout(T0, T0 + 200_000).clockText).toBe("3:20");
    expect(breakReadout(T0, T0 + 200_000).healText).toBe("Heal 3 from each identity");
  });

  test("hours show from the first hour, with no cap", () => {
    const r = breakReadout(T0, T0 + 35 * 60_000 + 9_000);
    expect(r.minutes).toBe(35);
    expect(breakReadout(T0, T0 + 3_909_000).clockText).toBe("1:05:09");
    expect(breakReadout(T0, T0 + 3 * 24 * 3_600_000).minutes).toBe(4320);
  });

  test("a clock that went backward never reads negative", () => {
    const r = breakReadout(T0, T0 - 90_000);
    expect(r.minutes).toBe(0);
    expect(r.clockText).toBe("0:00");
    expect(breakAnswerAt(T0, T0 - 5)).toEqual(["0"]);
  });

  test("the answer is the floored minutes in digits the engine accepts", () => {
    const answer = breakAnswerAt(T0, T0 + 200_000);
    expect(answer).toEqual(["3"]);
    expect(reportedNumberOf(answer[0]!)).toBe(3);
  });
});

describe("breakStartedAt", () => {
  test("the first call records now; later calls return the recorded start", () => {
    const storage = memory();
    expect(breakStartedAt(id, () => T0, storage)).toBe(T0);
    expect(breakStartedAt(id, () => T0 + 5000, storage)).toBe(T0);
  });

  test("after a resume three hours later the break shows the true elapsed time", () => {
    const storage = memory();
    breakStartedAt(id, () => T0, storage);
    const resumedAt = T0 + 3 * 3_600_000;
    const start = breakStartedAt(id, () => resumedAt, storage);
    expect(breakReadout(start, resumedAt).minutes).toBe(180);
  });

  test("a start in the future (the clock moved back) is rebased to now, so it counts up from there", () => {
    const storage = memory();
    breakStartedAt(id, () => T0, storage);
    const start = breakStartedAt(id, () => T0 - 600_000, storage);
    expect(start).toBe(T0 - 600_000);
    expect(breakReadout(start, T0 - 600_000 + 61_000).minutes).toBe(1);
    expect(breakStartedAt(id, () => T0 - 500_000, storage)).toBe(T0 - 600_000);
  });

  test("another game, choice or seat starts a fresh break", () => {
    const storage = memory();
    breakStartedAt(id, () => T0, storage);
    expect(breakStartedAt({ ...id, seed: 8 }, () => T0 + 1000, storage)).toBe(T0 + 1000);
    expect(breakStartedAt({ ...id, seed: 8, choiceId: "c13" }, () => T0 + 2000, storage)).toBe(T0 + 2000);
  });

  test("a cleared break starts fresh, and garbage or missing storage is survivable", () => {
    const storage = memory();
    breakStartedAt(id, () => T0, storage);
    clearBreakStart(storage);
    expect(storage.getItem(BREAK_START_KEY)).toBeNull();
    expect(breakStartedAt(id, () => T0 + 9, storage)).toBe(T0 + 9);
    storage.setItem(BREAK_START_KEY, "{nope");
    expect(breakStartedAt(id, () => T0 + 10, storage)).toBe(T0 + 10);
    expect(breakStartedAt(id, () => T0 + 11, null)).toBe(T0 + 11);
  });
});

describe("isBreakChoice", () => {
  const choice = (prompt: unknown) => ({ prompt }) as never;
  test("only the whole-number minutes report", () => {
    expect(isBreakChoice(choice({ kind: "reportFact", fact: "minutesAway", answer: "wholeNumber" }))).toBe(true);
    expect(isBreakChoice(choice({ kind: "reportFact", fact: "talkedThisPhase", answer: "yesNo" }))).toBe(false);
    expect(isBreakChoice(choice({ kind: "chooseNumber", min: 0, max: 4 }))).toBe(false);
  });
});

import { describe, expect, test } from "vitest";
import {
  GLOBAL_ASK_BODY,
  GLOBAL_ASK_BUTTONS,
  GLOBAL_ASK_GRACE_MS,
  askAnswerAllowed,
  shouldAskGlobal,
} from "./global-ask.js";

describe("shouldAskGlobal", () => {
  const due = { consent: "unset", finishedGames: 1, syncAskedThisVisit: false } as const;
  test("asks once a game is finished and nothing has been answered", () => {
    expect(shouldAskGlobal(due)).toBe(true);
  });
  test("never before a finished game", () => {
    expect(shouldAskGlobal({ ...due, finishedGames: 0 })).toBe(false);
  });
  test("never again after either answer", () => {
    expect(shouldAskGlobal({ ...due, consent: "on" })).toBe(false);
    expect(shouldAskGlobal({ ...due, consent: "off" })).toBe(false);
  });
  test("never in a visit that put the sync question", () => {
    expect(shouldAskGlobal({ ...due, syncAskedThisVisit: true })).toBe(false);
  });
});

describe("the ask's words and grace", () => {
  test("two buttons, named as asked", () => {
    expect(GLOBAL_ASK_BUTTONS).toEqual({ share: "Share", decline: "No thanks" });
    expect(GLOBAL_ASK_BODY).toContain("It sends no name, account or device");
    expect(GLOBAL_ASK_BODY).toContain("nothing from games you have already finished");
  });
  test("an answer in the first moments after it opens is ignored", () => {
    expect(askAnswerAllowed(1000, 1000 + GLOBAL_ASK_GRACE_MS - 1)).toBe(false);
    expect(askAnswerAllowed(1000, 1000 + GLOBAL_ASK_GRACE_MS)).toBe(true);
  });
});

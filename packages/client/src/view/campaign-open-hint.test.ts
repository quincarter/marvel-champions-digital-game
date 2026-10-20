import { describe, expect, test } from "vitest";
import { openIssueHintOf } from "./campaign-open-hint.js";

const base = { issueNumber: 1, pending: false, composing: false, starting: false, deckBlocked: false };

describe("openIssueHintOf", () => {
  test("a pending call says answering it opens the issue, in the bar and under the heading", () => {
    const hint = openIssueHintOf({ ...base, pending: true });
    expect(hint?.bar).toBe("Answer the question on this page to open Issue #1.");
    expect(hint?.call).toMatch(/Answer this to open Issue #1/);
  });
  test("composing says it is getting ready; nothing pending and nothing composing says nothing", () => {
    expect(openIssueHintOf({ ...base, composing: true })?.bar).toMatch(/Getting Issue #1 ready/);
    expect(openIssueHintOf(base)).toBeNull();
  });
  test("a blocked deck or an opening issue keeps its own wording", () => {
    expect(openIssueHintOf({ ...base, pending: true, deckBlocked: true })).toBeNull();
    expect(openIssueHintOf({ ...base, pending: true, starting: true })).toBeNull();
  });
});

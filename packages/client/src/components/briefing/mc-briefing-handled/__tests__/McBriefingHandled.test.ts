// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { findAll, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-handled.js";

afterEach(() => document.body.replaceChildren());

const row = (key: string) => ({ key, status: "done", title: key, detail: "" });

describe("mc-briefing-handled", () => {
  it("lists the rows under the heading", async () => {
    const el = await mount("mc-briefing-handled", { model: { rows: [row("one"), row("two")], waiting: null } });
    expect(findAll(el, "mc-briefing-handled-row")).toHaveLength(2);
    expect(wordsOf(el)).toContain("HANDLED FOR YOU");
  });

  it("says nothing is automatic when there are no rows, and the waiting line while a call is open", async () => {
    const none = await mount("mc-briefing-handled", { model: { rows: [], waiting: null } });
    expect(wordsOf(none)).toContain("Nothing automatic this issue.");
    const waiting = await mount("mc-briefing-handled", {
      model: { rows: [row("x")], waiting: "Answer the call first." },
    });
    expect(wordsOf(waiting)).toContain("Answer the call first.");
    expect(findAll(waiting, "mc-briefing-handled-row")).toHaveLength(0);
  });
});

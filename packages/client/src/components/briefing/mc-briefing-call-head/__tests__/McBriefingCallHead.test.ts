// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-call-head.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-call-head", () => {
  it("opens with YOUR CALL and the reason Open waits", async () => {
    const el = await mount("mc-briefing-call-head", {
      model: { hint: "Answer this to open issue #1.", seat: null, phone: false },
    });
    expect(wordsOf(el)).toContain("YOUR CALL");
    expect(find(el, ".hint")?.textContent).toBe("Answer this to open issue #1.");
    expect(find(el, "mc-briefing-seat-header")).toBeNull();
  });

  it("a per-seat call carries the seat header", async () => {
    const el = await mount("mc-briefing-call-head", {
      model: { hint: null, seat: { title: "SEAT 1 · COLOSSUS", picture: null, stamps: [] }, phone: true },
    });
    expect(find(el, "mc-briefing-seat-header")).not.toBeNull();
    expect(find(el, ".hint")).toBeNull();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-kicker.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-kicker", () => {
  it("says its words in capitals, in a span of its own", async () => {
    const el = await mount("mc-briefing-kicker", { text: "Evidence · 1 gained" });
    expect(wordsOf(el)).toBe("EVIDENCE · 1 GAINED");
    expect(find(el, "span")?.textContent).toBe("EVIDENCE · 1 GAINED");
  });

  it("reflects its tone so the stylesheet can colour it", async () => {
    const el = await mount("mc-briefing-kicker", { text: "x", tone: "cost" });
    expect(el.getAttribute("tone")).toBe("cost");
  });
});

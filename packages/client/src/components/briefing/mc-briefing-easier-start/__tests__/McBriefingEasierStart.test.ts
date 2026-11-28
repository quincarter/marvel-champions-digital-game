// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, wordsOf } from "../../test-support.js";
import "../mc-briefing-easier-start.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-easier-start", () => {
  it("is one focus stop that raises toggle-easier, and says its state in words", async () => {
    const el = await mount("mc-briefing-easier-start", { on: false });
    const seen = briefingEvents(el);
    const card = find(el, "mc-press-card")!;
    expect(card.getAttribute("data-stop")).toBe("easier-start");
    press(card);
    expect(seen).toEqual([{ type: "toggle-easier" }]);
    expect(wordsOf(el)).toContain("Off · begins at stage II");
    expect(card.hasAttribute("selected")).toBe(false);
  });

  it("while on it wears the red frame and says so", async () => {
    const el = await mount("mc-briefing-easier-start", { on: true });
    expect(find(el, "mc-press-card")!.hasAttribute("selected")).toBe(true);
    expect(wordsOf(el)).toContain("On · begins at stage I");
  });
});

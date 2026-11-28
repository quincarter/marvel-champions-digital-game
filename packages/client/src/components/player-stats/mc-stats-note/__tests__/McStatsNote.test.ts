// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stats-note";

afterEach(() => document.body.replaceChildren());

describe("mc-stats-note", () => {
  it("says its words in a span", async () => {
    const el = document.createElement("mc-stats-note");
    el.text = "Reading everyone's games…";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("span")!.textContent).toBe("Reading everyone's games…");
  });

  it("updates when its words change", async () => {
    const el = document.createElement("mc-stats-note");
    el.text = "a";
    document.body.append(el);
    await el.updateComplete;
    el.text = "b";
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("b");
  });
});

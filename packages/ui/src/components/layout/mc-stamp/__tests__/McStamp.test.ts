import { afterEach, describe, expect, it } from "vitest";
import "../mc-stamp";

afterEach(() => document.body.replaceChildren());

describe("mc-stamp", () => {
  it("says its word in a span and reflects its tone", async () => {
    const el = document.createElement("mc-stamp");
    el.label = "Recommended";
    el.tone = "red";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".word")!.textContent).toBe("Recommended");
    expect(el.getAttribute("tone")).toBe("red");
  });

  it("is a parchment stamp until told otherwise", async () => {
    const el = document.createElement("mc-stamp");
    document.body.append(el);
    await el.updateComplete;
    expect(el.tone).toBe("parchment");
  });
});

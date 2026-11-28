// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-title-logo.js";

afterEach(() => document.body.replaceChildren());

describe("mc-title-logo", () => {
  it("says the caption and the wordmark, and offers the top-end slot", async () => {
    const el = document.createElement("mc-title-logo");
    el.input = { eyebrow: "EDICIÓN DIGITAL" };
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".eyebrow")!.textContent).toBe("EDICIÓN DIGITAL");
    expect(root.querySelector(".mark")!.textContent).toBe("MARVELCHAMPIONS");
    expect(root.querySelector('slot[name="top-end"]')).not.toBeNull();
  });

  it("reflects its mode and draws nothing without an input", async () => {
    const el = document.createElement("mc-title-logo");
    el.mode = "phone";
    document.body.append(el);
    await el.updateComplete;
    expect(el.getAttribute("mode")).toBe("phone");
    expect(el.shadowRoot!.querySelector(".mark")).toBeNull();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount } from "../../test-support.js";
import "../mc-scenario-inspect-hint.js";

afterEach(() => document.body.replaceChildren());

describe("mc-scenario-inspect-hint", () => {
  it("draws nothing without a glyph", async () => {
    const el = await mount("mc-scenario-inspect-hint", { text: "Inspect" });
    expect(el.shadowRoot!.querySelector("mc-glyph")).toBeNull();
  });

  it("draws the glyph and the word with one", async () => {
    const glyph = { specs: [{ kind: "key", label: "I" }], height: 16, ground: "paper", expanded: true, still: true };
    const el = await mount("mc-scenario-inspect-hint", { text: "Inspect", glyph });
    expect(el.shadowRoot!.querySelector("mc-glyph")).not.toBeNull();
    expect(inner(el, ".text")!.textContent).toBe("Inspect");
  });
});

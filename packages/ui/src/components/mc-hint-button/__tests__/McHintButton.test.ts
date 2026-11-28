import { afterEach, describe, expect, it } from "vitest";
import "../mc-hint-button.js";
import type { McHintButton } from "../McHintButton.js";

afterEach(() => document.body.replaceChildren());

async function button(props: Partial<McHintButton> = {}): Promise<McHintButton> {
  const el = document.createElement("mc-hint-button");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const glyph = {
  specs: [{ kind: "key" as const, label: "Esc" }],
  height: 16,
  ground: "ink" as const,
  expanded: true,
  still: true,
};

describe("mc-hint-button", () => {
  it("is the plain button without a glyph", async () => {
    const el = await button({ label: "Back" });
    expect(el.shadowRoot!.querySelector("mc-glyph")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-button")!.label).toBe("Back");
  });

  it("draws the glyph beside the word and keeps the word clear of it", async () => {
    const el = await button({ label: "Back", glyph });
    expect(el.shadowRoot!.querySelector("mc-glyph")).not.toBeNull();
    expect(parseFloat(el.style.getPropertyValue("--mc-label-inset"))).toBeGreaterThan(0);
  });

  it("raises mc-press from a focus stop click (detail 0) but not from a pointer click, and not while disabled", async () => {
    const el = await button({ label: "Go" });
    let presses = 0;
    el.addEventListener("mc-press", () => presses++);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(presses).toBe(0);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(presses).toBe(1);
    el.disabled = true;
    await el.updateComplete;
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(presses).toBe(1);
  });
});

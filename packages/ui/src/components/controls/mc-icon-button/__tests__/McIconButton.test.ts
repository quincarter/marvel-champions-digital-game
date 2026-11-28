import { afterEach, describe, expect, it } from "vitest";
import "../mc-icon-button";
import type { PressDetail } from "../../../../shared/press/press.types";

afterEach(() => document.body.replaceChildren());

async function button(set: (el: HTMLElementTagNameMap["mc-icon-button"]) => void) {
  const el = document.createElement("mc-icon-button");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-icon-button", () => {
  it("draws its picture and words, and names itself for assistive tech", async () => {
    const el = await button((b) => {
      b.icon = "globe";
      b.label = "ES";
      b.name = "Idioma";
    });
    expect(el.shadowRoot!.querySelector("svg")).not.toBeNull();
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("ES");
    expect(el.getAttribute("aria-label")).toBe("Idioma");
    expect(el.getAttribute("role")).toBe("button");
  });

  it("draws no words when it has none, and the hung glyph only with one", async () => {
    const el = await button((b) => (b.icon = "bug"));
    expect(el.shadowRoot!.querySelector(".label")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-glyph")).toBeNull();
    el.glyph = { specs: [], height: 16, ground: "ink", openness: 1 };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-glyph")).not.toBeNull();
  });

  it("raises mc-pressed on click() as the focus route presses it", async () => {
    const el = await button((b) => (b.action = "theme"));
    const seen: PressDetail[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.click();
    expect(seen).toEqual([{ action: "theme", hold: false }]);
  });

  it("reflects lit, and does nothing while disabled", async () => {
    const el = await button((b) => {
      b.lit = true;
      b.disabled = true;
      b.action = "x";
    });
    expect(el.hasAttribute("lit")).toBe(true);
    const seen: PressDetail[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.press();
    expect(seen).toEqual([]);
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-menu-button.js";
import type { TitleMenuRow } from "../mc-title-menu-button.types.js";

afterEach(() => document.body.replaceChildren());

async function row(over: Partial<TitleMenuRow> = {}) {
  const el = document.createElement("mc-title-menu-button");
  el.row = { key: "decks", label: "Mazos y colección", kind: "secondary", width: "full", ...over };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-menu-button", () => {
  it("draws a button that is the focus stop for its key, with its words", async () => {
    const el = await row();
    const button = el.shadowRoot!.querySelector("mc-button")!;
    expect(button.getAttribute("data-stop")).toBe("decks");
    expect(button.label).toBe("Mazos y colección");
    expect(el.getAttribute("kind")).toBe("secondary");
  });

  it("wears a badge, a tag and a platform mark with its tooltip as pictures over the button", async () => {
    const el = await row({
      badge: "3",
      tag: "BETA",
      tall: true,
      icon: {
        grid: 24,
        ops: [{ k: "circle", cx: 12, cy: 12, r: 8, stroke: "currentColor", sw: 2 }],
        label: "Jugado en Windows",
      },
    });
    const root = el.shadowRoot!;
    expect(root.querySelector(".badge")!.textContent).toBe("3");
    expect(root.querySelector(".tag")!.textContent).toBe("BETA");
    expect(root.querySelector(".icon")!.getAttribute("aria-label")).toBe("Jugado en Windows");
    expect(root.querySelector(".tip")!.textContent).toBe("Jugado en Windows");
    expect(el.hasAttribute("tall")).toBe(true);
  });

  it("dims and reflects a disabled row, and hangs the glyph only when given one", async () => {
    const el = await row({ disabled: true, glyph: { specs: [], height: 16, ground: "ink", openness: 1 } });
    expect(el.hasAttribute("disabled")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-button")!.hasAttribute("disabled")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-glyph-hint")).not.toBeNull();
  });

  it("raises mc-press when the button is clicked as the route does", async () => {
    const el = await row();
    let pressed = 0;
    el.addEventListener("mc-press", () => pressed++);
    el.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    expect(pressed).toBe(1);
  });
});

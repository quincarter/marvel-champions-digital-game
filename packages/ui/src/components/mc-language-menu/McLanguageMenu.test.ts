import { afterEach, describe, expect, it } from "vitest";
import "../mc-button/mc-button.js";
import "./mc-language-menu.js";
import { activations, tap } from "../../shared/test-tap.js";
import type { LanguageMenuModel } from "./mc-language-menu.types.js";

afterEach(() => document.body.replaceChildren());

const list: LanguageMenuModel = {
  mode: "list",
  scrim: 0.25,
  box: { x: 100, y: 50, width: 160, height: 120 },
  rowHeight: 44,
  rows: [
    { key: "en", label: "English", kind: "onInk" },
    { key: "es", label: "✓ Español", kind: "onInk", selected: true },
  ],
  note: null,
  phone: false,
};

const note: LanguageMenuModel = {
  ...list,
  mode: "note",
  rows: [],
  phone: true,
  note: {
    title: "Otros idiomas",
    paragraphs: ["Uno.", "Dos."],
    links: [
      { key: "downloads", label: "Descargas ↗", kind: "primary" },
      { key: "web", label: "Jugar en el navegador ↗", kind: "secondary" },
    ],
    close: { key: "close", label: "✕", kind: "quiet" },
  },
};

async function mount(model: LanguageMenuModel) {
  const el = document.createElement("mc-language-menu");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-language-menu", () => {
  it("draws the list at its box, with the chosen row selected, and reports a row's press by its key", async () => {
    const el = await mount(list);
    const keys = activations(el);
    const box = el.shadowRoot!.querySelector<HTMLElement>(".list")!;
    expect(box.style.left).toBe("100px");
    expect(el.elementOf("es")!.hasAttribute("selected")).toBe(true);
    tap(el.elementOf("en")!);
    expect(keys).toEqual(["en"]);
  });

  it("reports a tap on the scrim as outside", async () => {
    const el = await mount(list);
    const keys = activations(el);
    tap(el.shadowRoot!.querySelector(".scrim")!);
    expect(keys).toEqual(["outside"]);
  });

  it("draws the note with its paragraphs, links and close button, reflecting the phone layout", async () => {
    const el = await mount(note);
    expect(el.hasAttribute("phone")).toBe(true);
    expect(el.shadowRoot!.querySelector(".title")!.textContent).toBe("Otros idiomas");
    expect(el.shadowRoot!.querySelectorAll("p")).toHaveLength(2);
    const keys = activations(el);
    tap(el.elementOf("web")!);
    tap(el.elementOf("close")!);
    expect(keys).toEqual(["web", "close"]);
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-icon-row.js";

afterEach(() => document.body.replaceChildren());

async function row() {
  const el = document.createElement("mc-title-icon-row");
  el.input = {
    buttons: [
      { key: "chrome:theme", icon: "moon", name: "Modo oscuro" },
      { key: "chrome:language", icon: "globe", name: "Idioma", label: "ES", lit: true },
      { key: "chrome:report", icon: "bug", name: "Informar" },
    ],
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-icon-row", () => {
  it("draws one button per entry, each a focus stop by its key", async () => {
    const el = await row();
    const buttons = [...el.shadowRoot!.querySelectorAll("mc-icon-button")];
    expect(buttons.map((b) => b.getAttribute("data-stop"))).toEqual([
      "chrome:theme",
      "chrome:language",
      "chrome:report",
    ]);
    expect(buttons[1]!.getAttribute("label")).toBe("ES");
    expect(buttons[1]!.hasAttribute("lit")).toBe(true);
    expect(buttons[0]!.getAttribute("name")).toBe("Modo oscuro");
  });

  it("reports the key of the button that was pressed", async () => {
    const el = await row();
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail.action));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="chrome:language"]')!.click();
    expect(seen).toEqual(["chrome:language"]);
  });

  it("draws nothing without an input", async () => {
    const el = document.createElement("mc-title-icon-row");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-icon-button")).toBeNull();
  });
});

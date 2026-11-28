// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-banner.js";

afterEach(() => document.body.replaceChildren());

async function banner() {
  const el = document.createElement("mc-title-banner");
  el.input = {
    heading: "ACTUALIZACIÓN DISPONIBLE",
    detail: "Versión 1.2.0",
    buttons: [
      { key: "update-notes", label: "Novedades ↗", kind: "secondary" },
      { key: "update-install", label: "Actualizar", kind: "primary" },
    ],
    dismiss: { key: "update-dismiss", label: "×", kind: "secondary" },
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-banner", () => {
  it("says its heading and detail and draws a keyed button for each action and the close button", async () => {
    const root = (await banner()).shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("ACTUALIZACIÓN DISPONIBLE");
    expect(root.querySelector(".detail")!.textContent).toBe("Versión 1.2.0");
    expect([...root.querySelectorAll("mc-button")].map((b) => b.getAttribute("data-stop"))).toEqual([
      "update-notes",
      "update-install",
      "update-dismiss",
    ]);
  });

  it("raises mc-press when a button is clicked as the route does", async () => {
    const el = await banner();
    let pressed = 0;
    el.addEventListener("mc-press", () => pressed++);
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="update-install"]')!.click();
    expect(pressed).toBe(1);
  });

  it("draws nothing without an input", async () => {
    const el = document.createElement("mc-title-banner");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".box")).toBeNull();
  });
});

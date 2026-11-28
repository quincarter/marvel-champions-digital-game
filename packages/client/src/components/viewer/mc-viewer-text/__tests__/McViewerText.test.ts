// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-viewer-text.js";

afterEach(() => document.body.replaceChildren());

describe("mc-viewer-text", () => {
  it("sets a quoted line in italics and prints the note about what is left to earn", async () => {
    const el = document.createElement("mc-viewer-text");
    el.subtitle = "Peter Parker";
    el.lines = [
      { text: "Friendly neighbourhood.", quote: false },
      { text: '"With great power"', quote: true },
    ];
    el.note = "1 more picture to earn: Beat Rhino";
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect([...root.querySelectorAll(".line")].map((line) => line.className)).toEqual(["line", "line quote"]);
    expect(root.querySelector(".alert")!.textContent).toBe("1 more picture to earn: Beat Rhino");
  });

  it("offers the promo toggle as a focus stop and says when promo art is off", async () => {
    const el = document.createElement("mc-viewer-text");
    el.promo = { label: "Use this art", off: "Promo card art is off." };
    document.body.append(el);
    await el.updateComplete;
    const heard = vi.fn();
    el.addEventListener("mc-viewer", (event) => heard(event.detail));
    el.shadowRoot!.querySelector('[data-stop="promo"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "promo" });
    expect(el.shadowRoot!.querySelector(".alert")!.textContent).toBe("Promo card art is off.");
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-title-status.js";

afterEach(() => document.body.replaceChildren());

describe("mc-title-status", () => {
  it("says its text in a span, and reflects its kind", async () => {
    const el = document.createElement("mc-title-status");
    el.input = { text: "No se pudo abrir ese juego", kind: "problem" };
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("span")!.textContent).toBe("No se pudo abrir ese juego");
    expect(el.getAttribute("kind")).toBe("problem");
  });

  it("draws nothing without an input", async () => {
    const el = document.createElement("mc-title-status");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("span")).toBeNull();
  });
});

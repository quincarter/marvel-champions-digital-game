import { afterEach, describe, expect, it } from "vitest";
import "../mc-popup-button.js";
import { activations, stop, tap } from "../../../shared/test-tap.js";
import type { ControlGlyph } from "../../../shared/popup.types.js";

afterEach(() => document.body.replaceChildren());

async function mount(glyph: ControlGlyph | null = null, disabled?: string) {
  const el = document.createElement("mc-popup-button");
  el.button = { key: "pause", label: "Pausa", kind: "secondary", ...(disabled ? { disabled } : {}) };
  el.glyph = glyph;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const glyph = { specs: [], height: 20, ground: "dark", openness: 1, width: 30 } as unknown as ControlGlyph;

describe("mc-popup-button", () => {
  it("draws nothing without a button", async () => {
    const el = document.createElement("mc-popup-button");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-button")).toBeNull();
  });

  it("carries its key as the focus stop and reports a press as mc-activate", async () => {
    const el = await mount();
    const keys = activations(el);
    tap(stop(el, "pause"));
    expect(keys).toEqual(["pause"]);
  });

  it("hangs the glyph and slides the word over for an inside one", async () => {
    const el = await mount(glyph);
    expect(el.shadowRoot!.querySelectorAll(".hang")).toHaveLength(1);
    expect(el.style.getPropertyValue("--mc-label-shift")).toBe("19px");
  });

  it("puts a left glyph outside and leaves the word where it is", async () => {
    const el = await mount({ ...glyph, place: "left" });
    expect(el.shadowRoot!.querySelector(".hang.left")).not.toBeNull();
    expect(el.style.getPropertyValue("--mc-label-shift")).toBe("0px");
  });

  it("is disabled with a reason", async () => {
    const el = await mount(null, "No hay canciones");
    expect(stop(el, "pause").hasAttribute("disabled")).toBe(true);
  });
});

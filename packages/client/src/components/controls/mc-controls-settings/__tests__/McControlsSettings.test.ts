// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-controls-settings.js";
import type { McControlsSettings } from "../McControlsSettings.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McControlsSettings> {
  const el = document.createElement("mc-controls-settings");
  el.rows = [
    { kind: "choice", id: "hand", heading: "Hand", detail: "d", dimmed: false, options: [{ value: "left", label: "Left", selected: true }, { value: "right", label: "Right", selected: false }] },
    { kind: "toggle", id: "hints", title: "Hints", detail: "d", state: "ON", on: true, locked: false },
    { kind: "slider", id: "hintSize", heading: "Hint size", detail: "d", value: 50, label: "100%", dimmed: false, preview: [{ spec: { kind: "key", label: "Space" }, height: 24 }] },
  ];
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-controls-settings", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-segments")).not.toBeNull();
    expect(root.querySelector("mc-switch-row")!.getAttribute("data-stop")).toBe("row:hints");
    const slider = root.querySelector("mc-volume-slider")!;
    expect(slider.getAttribute("data-stop")).toBe("row:hintSize");
    expect(slider.getAttribute("down-stop")).toBe("hint-size:down");
    expect(root.querySelectorAll("mc-glyph").length).toBe(1);
  });

  it("says choose, toggle and hint-step as one mc-controls event", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-controls", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-switch-row")!.dispatchEvent(new CustomEvent("mc-pressed", { detail: { action: { type: "toggle", row: "hints" }, hold: false }, bubbles: true, composed: true }));
    el.shadowRoot!.querySelector("mc-volume-slider")!.dispatchEvent(new CustomEvent("mc-step", { detail: { key: "volume", direction: 1 }, bubbles: true, composed: true }));
    expect(heard.mock.calls).toEqual([[{ type: "toggle", row: "hints" }], [{ type: "hint-step", direction: 1 }]]);
  });
});

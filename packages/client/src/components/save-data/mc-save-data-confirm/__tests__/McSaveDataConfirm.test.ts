// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-save-data-confirm.js";
import type { McSaveDataConfirm } from "../McSaveDataConfirm.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McSaveDataConfirm> {
  const el = document.createElement("mc-save-data-confirm");
  el.input = {
    title: "Replace?",
    body: "Overwrites.",
    cancelLabel: "Cancel",
    confirmLabel: "Replace",
    cancelGlyph: null,
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-save-data-confirm", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Replace?");
    expect(root.querySelector("[data-stop='cancel']")).not.toBeNull();
    expect(root.querySelector("[data-stop='replace']")!.getAttribute("kind")).toBe("primary");
  });

  it("says menu for Cancel and replace for Replace", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-save-data", (event) => heard((event as CustomEvent).detail));
    for (const stop of ["cancel", "replace"])
      el.shadowRoot!.querySelector(`[data-stop='${stop}']`)!.dispatchEvent(
        new CustomEvent("mc-press", { bubbles: true, composed: true }),
      );
    expect(heard.mock.calls).toEqual([[{ type: "menu" }], [{ type: "replace" }]]);
  });
});

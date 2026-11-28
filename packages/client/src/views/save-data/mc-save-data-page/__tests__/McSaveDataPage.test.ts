// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-save-data-page.js";
import type { McSaveDataPage } from "../McSaveDataPage.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McSaveDataPage> {
  const el = document.createElement("mc-save-data-page");
  el.model = {
    phone: false,
    bar: { title: "Save data", backLabel: "Back", backGlyph: null },
    step: {
      kind: "menu",
      actions: {
        disabled: false,
        rows: [{ id: "export", title: "Export", detail: "d", label: "Export", beta: false }],
      },
    },
    status: { text: "Exported", tone: "ok", exportLabel: null },
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-save-data-page", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-save-data-actions", "mc-save-data-status"])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(el.codeField).toBeNull();
  });

  it("swaps the step, and says back from the bar", async () => {
    const el = await mount();
    el.model = {
      ...el.model!,
      status: null,
      step: {
        kind: "confirm",
        confirm: { title: "T", body: "B", cancelLabel: "Cancel", confirmLabel: "Replace", cancelGlyph: null },
      },
    };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-save-data-confirm")).not.toBeNull();
    expect(el.shadowRoot!.querySelector("mc-save-data-actions")).toBeNull();
    const heard = vi.fn();
    el.addEventListener("mc-save-data", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "back" });
  });
});

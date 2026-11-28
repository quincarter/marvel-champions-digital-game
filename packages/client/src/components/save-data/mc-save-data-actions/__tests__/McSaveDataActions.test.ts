// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-save-data-actions.js";
import type { McSaveDataActions } from "../McSaveDataActions.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McSaveDataActions> {
  const el = document.createElement("mc-save-data-actions");
  el.input = {
    disabled: false,
    rows: [
      { id: "export", title: "Export", detail: "d", label: "Export", beta: false },
      { id: "sync", title: "Sync", detail: "d", label: "Sync", beta: true },
    ],
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-save-data-actions", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const buttons = [...root.querySelectorAll("mc-hint-button")];
    expect(buttons.map((b) => b.getAttribute("data-stop"))).toEqual(["row:export", "row:sync"]);
    expect(root.querySelectorAll("mc-stamp").length).toBe(1);
  });

  it("says which action was pressed, and dims every button while a file is in flight", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-save-data", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-hint-button")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "action", id: "export" });
    el.input = { ...el.input!, disabled: true };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-hint-button")!.hasAttribute("disabled")).toBe(true);
  });
});

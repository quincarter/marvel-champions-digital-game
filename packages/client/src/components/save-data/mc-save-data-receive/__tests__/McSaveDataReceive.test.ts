// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-save-data-receive.js";
import type { McSaveDataReceive } from "../McSaveDataReceive.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McSaveDataReceive> {
  const el = document.createElement("mc-save-data-receive");
  el.input = {
    title: "Receive",
    fetching: false,
    help: "Type the code.",
    value: "ABCD",
    placeholder: "ABCD-EFGH-JKMN",
    receiveLabel: "Receive",
    backLabel: "Back",
    backGlyph: null,
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-save-data-receive", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const field = el.field!;
    expect(field.getAttribute("data-stop")).toBe("code");
    expect(field.value).toBe("ABCD");
    expect(root.querySelector("[data-stop='receive']")).not.toBeNull();
  });

  it("asks for the save on Enter in the field, and shows only the title while fetching", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-save-data", (event) => heard((event as CustomEvent).detail));
    el.field!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "receive" });
    el.input = { ...el.input!, fetching: true };
    await el.updateComplete;
    expect(el.field).toBeNull();
  });
});

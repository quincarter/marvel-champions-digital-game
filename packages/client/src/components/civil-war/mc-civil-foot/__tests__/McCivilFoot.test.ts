// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-civil-foot.js";
import type { McCivilFoot } from "../McCivilFoot.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilFoot> {
  const el = document.createElement("mc-civil-foot");
  el.startLabel = "Continue";
  el.startReason = "Pick a leader";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-foot", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const buttons = [...root.querySelectorAll("mc-hint-button")];
    expect(buttons.map((b) => b.getAttribute("data-stop"))).toEqual([
      "civil:random",
      "civil:random-blind",
      "civil:start",
    ]);
    expect(buttons[2]!.hasAttribute("disabled")).toBe(true);
  });

  it("says act with the button's own action", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-civil-war", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("[data-stop='civil:random']")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "act", action: "civil:random" });
  });
});

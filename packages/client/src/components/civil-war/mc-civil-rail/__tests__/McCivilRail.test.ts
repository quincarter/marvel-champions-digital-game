// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-civil-rail.js";
import type { McCivilRail } from "../McCivilRail.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilRail> {
  const el = document.createElement("mc-civil-rail");
  el.steps = [
    { step: 1, action: "civil:step:1", title: "Side", line: "Registration", complete: true, active: true },
    { step: 2, action: "civil:step:2", title: "Leader", line: "", complete: false, active: false },
  ] as never;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-rail", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const cards = [...root.querySelectorAll("mc-press-card")];
    expect(cards.map((c) => c.getAttribute("data-stop"))).toEqual(["civil:step:1", "civil:step:2"]);
    expect(cards[0]!.hasAttribute("selected")).toBe(true);
    expect(root.querySelectorAll(".bang").length).toBe(1);
  });

  it("is a bar of numbers on a phone, and says act for a step", async () => {
    const el = await mount();
    el.mode = "phone";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".mark").length).toBe(2);
    const heard = vi.fn();
    el.addEventListener("mc-civil-war", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-press-card")!.dispatchEvent(
      new CustomEvent("mc-pressed", {
        detail: { action: { type: "act", action: "civil:step:1" }, hold: false },
        bubbles: true,
        composed: true,
      }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "act", action: "civil:step:1" });
  });
});

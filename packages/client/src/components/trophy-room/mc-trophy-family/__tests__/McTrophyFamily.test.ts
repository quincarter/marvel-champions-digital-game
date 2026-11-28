// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-trophy-family.js";
import type { McTrophyFamily } from "../McTrophyFamily.js";
import type { TrophyFamilyModel } from "../mc-trophy-family.types.js";

afterEach(() => document.body.replaceChildren());

const model: TrophyFamilyModel = {
  kind: "section",
  id: "wins",
  title: "Battles won",
  count: "3 of 7 · 43%",
  expanded: false,
};

async function mount(m: TrophyFamilyModel = model): Promise<McTrophyFamily> {
  const el = document.createElement("mc-trophy-family");
  el.model = m;
  el.stop = "sec:wins";
  el.action = { type: "family", id: "wins" };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-trophy-family", () => {
  it("says the family in capitals with its count and a chevron for folded or open", async () => {
    const el = await mount();
    const heading = el.shadowRoot!.querySelector<HTMLElement & { label: string; right: string }>("mc-section-heading")!;
    expect(heading.label).toBe("BATTLES WON");
    expect(heading.right).toBe("3 of 7 · 43%");
    expect(el.shadowRoot!.querySelector(".chev")!.textContent).toBe("▸");
    expect(el.getAttribute("aria-expanded")).toBe("false");
    el.model = { ...model, expanded: true };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".chev")!.textContent).toBe("▾");
    expect(el.getAttribute("aria-expanded")).toBe("true");
  });

  it("raises its action when pressed", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-pressed", (event) => heard((event as CustomEvent).detail));
    el.click();
    expect(heard).toHaveBeenCalledWith({ action: { type: "family", id: "wins" }, hold: false });
  });
});

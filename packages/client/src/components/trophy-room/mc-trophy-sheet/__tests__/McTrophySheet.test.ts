// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-trophy-sheet.js";
import type { McTrophySheet } from "../McTrophySheet.js";
import type { TrophySheetModel } from "../mc-trophy-sheet.types.js";

afterEach(() => document.body.replaceChildren());

const model: TrophySheetModel = {
  name: "Ten wins",
  facts: "LOCKED   +25 points   Progress 4 / 10",
  detail: "Win ten games, on any scenario.",
  closeLabel: "Close",
  closeGlyph: undefined,
};

async function mount(m: TrophySheetModel | null = model): Promise<McTrophySheet> {
  const el = document.createElement("mc-trophy-sheet");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-trophy-sheet", () => {
  it("spells out the whole achievement and has one stop, close", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Ten wins");
    expect(root.querySelector(".facts")!.textContent).toBe("LOCKED   +25 points   Progress 4 / 10");
    expect(root.querySelector(".detail")!.textContent).toBe("Win ten games, on any scenario.");
    expect([...root.querySelectorAll<HTMLElement>("[data-stop]")].map((node) => node.dataset.stop)).toEqual(["close"]);
  });

  it("closes from the button and from a tap on the scrim", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-trophy-room", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="close"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "close" });
    expect(el.shadowRoot!.querySelector(".scrim")!.getAttribute("data-action")).toBe("close");
  });

  it("draws nothing without an achievement", async () => {
    const el = await mount(null);
    expect(el.shadowRoot!.querySelector(".box")).toBeNull();
  });
});

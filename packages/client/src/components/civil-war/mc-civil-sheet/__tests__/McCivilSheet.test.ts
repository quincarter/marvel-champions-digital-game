// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-civil-sheet.js";
import type { McCivilSheet } from "../McCivilSheet.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilSheet> {
  const el = document.createElement("mc-civil-sheet");
  el.sheet = {
    setId: "bomb",
    name: "Bomb Scare",
    totalCards: 6,
    cards: [
      {
        copies: 2,
        typeWord: "Treachery",
        face: { cardId: "c", face: { kind: "front" }, landscape: false, name: "Bomb" },
      },
    ],
  } as never;
  el.setId = "bomb";
  el.enabled = true;
  el.pictures = { leader: () => ({ src: null }), face: () => ({ src: null }), back: { src: null } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-sheet", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(
      root.querySelector("mc-dialog")!.getAttribute("heading") ??
        (root.querySelector("mc-dialog") as unknown as { heading: string }).heading,
    ).toBe("Bomb Scare");
    expect(root.querySelector(".type")!.textContent).toBe("x2 · Treachery");
    expect(root.querySelector("[data-stop='civil:sheet:action']")!.getAttribute("label") ?? "").toBeDefined();
  });

  it("adds the set from the footer button and closes from Close", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-civil-war", (event) => heard((event as CustomEvent).detail));
    for (const stop of ["civil:sheet:action", "civil:sheet:close"])
      el.shadowRoot!.querySelector(`[data-stop='${stop}']`)!.dispatchEvent(
        new CustomEvent("mc-press", { bubbles: true, composed: true }),
      );
    expect(heard.mock.calls).toEqual([[{ type: "act", action: "civil:set:bomb" }], [{ type: "sheet", id: null }]]);
  });
});

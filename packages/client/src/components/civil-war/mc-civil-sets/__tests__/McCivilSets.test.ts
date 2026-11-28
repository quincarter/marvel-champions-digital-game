// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-civil-sets.js";
import type { McCivilSets } from "../McCivilSets.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilSets> {
  const el = document.createElement("mc-civil-sets");
  el.modular = {
    counterLine: "2 of 4 chosen",
    hint: null,
    chosen: 2,
    rangeLabel: "",
    hidden: false,
    sections: [
      {
        key: "side",
        label: "This side",
        tiles: [
          {
            id: "bomb",
            name: "Bomb Scare",
            cardCount: 6,
            descriptor: "Treachery",
            action: "civil:set:bomb",
            selected: true,
            recommended: true,
            enabled: true,
            faces: [],
          },
        ],
      },
    ],
  } as never;
  el.pictures = { leader: () => ({ src: null }), face: () => ({ src: null }), back: { src: null } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-sets", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".counter")!.textContent).toBe("2 of 4 chosen");
    const tile = root.querySelector("mc-setup-set-tile")!;
    expect(tile.getAttribute("stop-prefix")).toBe("civil:set:");
  });

  it("says act for the tile's action when it is toggled", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-civil-war", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-setup-set-tile")!.dispatchEvent(
      new CustomEvent("mc-setup", { detail: { type: "modular-toggle", id: "bomb" }, bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "act", action: "civil:set:bomb" });
  });
});

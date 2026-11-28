// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-game-row.js";
import type { McPastGameRow } from "../McPastGameRow.js";
import type { PastGameRowModel } from "../mc-past-game-row.types.js";

afterEach(() => document.body.replaceChildren());

const model: PastGameRowModel = {
  id: "g1",
  selected: false,
  label: "Won: Rhino · Spider-Man",
  pictures: [{ cardId: "rhino", picture: { src: null, missing: "Rhino" }, badges: [] }],
  summary: {
    result: "WON",
    tone: "won",
    reason: "Villain defeated",
    title: "Rhino · Spider-Man",
    when: "3 rounds",
    fates: null,
    campaign: null,
  },
};

async function mount(over: Partial<McPastGameRow> = {}): Promise<McPastGameRow> {
  const el = document.createElement("mc-past-game-row");
  el.model = model;
  el.stop = "game:g1";
  el.action = { type: "select", id: "g1" };
  Object.assign(el, over);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-game-row", () => {
  it("holds the pictures and the words, and speaks its name", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-past-game-pictures")).not.toBeNull();
    expect(root.querySelector("mc-past-game-summary")).not.toBeNull();
    expect(el.getAttribute("aria-label")).toBe("Won: Rhino · Spider-Man");
    expect(el.getAttribute("data-stop")).toBe("game:g1");
    expect(el.getAttribute("aria-pressed")).toBe("false");
  });

  it("raises its action when the route clicks it, and not while disabled", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-pressed", (event) => heard((event as CustomEvent).detail));
    el.click();
    expect(heard).toHaveBeenCalledWith({ action: { type: "select", id: "g1" }, hold: false });
    heard.mockClear();
    el.disabled = true;
    el.click();
    expect(heard).not.toHaveBeenCalled();
  });

  it("says it is the selected game", async () => {
    const el = await mount({ selected: true });
    expect(el.hasAttribute("selected")).toBe(true);
    expect(el.getAttribute("aria-pressed")).toBe("true");
  });
});

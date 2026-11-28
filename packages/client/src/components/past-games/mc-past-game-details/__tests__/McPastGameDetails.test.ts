// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-game-details.js";
import type { McPastGameDetails } from "../McPastGameDetails.js";
import type { PastGameDetailsModel } from "../mc-past-game-details.types.js";

afterEach(() => document.body.replaceChildren());

const model: PastGameDetailsModel = {
  id: "g1",
  pictures: [{ cardId: "rhino", picture: { src: null, missing: "Rhino" }, badges: [] }],
  summary: {
    result: "LOST",
    tone: "lost",
    reason: "Scheme completed",
    title: "Rhino · Spider-Man",
    when: "5 rounds",
    fates: null,
    campaign: null,
  },
  seats: [
    { heading: "Spider-Man · Fell", lines: ["10 damage · 2 thwart"] },
    { heading: "Ms. Marvel · Stood", lines: [] },
  ],
  actions: [
    { action: "watch", label: "Watch" },
    { action: "share", label: "Share link" },
    { action: "export", label: "Export" },
    { action: "log", label: "Log" },
  ],
  busy: false,
  closeLabel: "Close",
};

async function mount(over: Partial<McPastGameDetails> = {}): Promise<McPastGameDetails> {
  const el = document.createElement("mc-past-game-details");
  el.model = model;
  Object.assign(el, over);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-game-details", () => {
  it("shows the pictures, the summary, one block per seat and the four actions, with no close button beside the list", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-past-game-pictures")).not.toBeNull();
    expect(root.querySelectorAll("mc-past-game-seat")).toHaveLength(2);
    const actions = root.querySelector<HTMLElement & { actions: unknown[] }>("mc-past-game-actions")!;
    expect(actions.actions).toHaveLength(4);
    expect(root.querySelector('[data-stop="close"]')).toBeNull();
    expect(el.scroller).not.toBeNull();
  });

  it("as a popup has a close button that says close", async () => {
    const el = await mount({ popup: true });
    const heard = vi.fn();
    el.addEventListener("mc-past-games", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="close"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "close" });
    expect(el.hasAttribute("popup")).toBe(true);
  });

  it("starts the words from the top for another game, and keeps their place for the same one", async () => {
    const el = await mount();
    el.scroller!.scrollTop = 40;
    el.model = { ...model, busy: true };
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(40);
    el.model = { ...model, id: "g2" };
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(0);
  });

  it("draws nothing without a game", async () => {
    const el = await mount({ model: null });
    expect(el.shadowRoot!.querySelector(".panel")).toBeNull();
  });
});

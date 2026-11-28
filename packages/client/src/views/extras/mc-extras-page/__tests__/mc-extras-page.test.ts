// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-extras-page.js";
import type { ExtrasPageModel } from "../mc-extras-page.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<ExtrasPageModel> = {}): ExtrasPageModel => ({
  phone: false,
  stackDoors: false,
  bar: { backLabel: "◂ TITLE", title: "EXTRAS", right: "1 of 2 open", backGlyph: null, titleDrop: 0, titleMaxRight: 0 },
  doors: { trophies: "Trophy Room", credits: "Credits" },
  tabs: { tabs: [{ id: "stories", label: "Stories 1/2" }], selected: "stories", size: 0, hint: undefined },
  player: null,
  shelf: { shape: "landscape", tiles: [], empty: "Nothing here yet." },
  tracks: null,
  ...over,
});

async function page(m: ExtrasPageModel) {
  const el = document.createElement("mc-extras-page");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-extras-page", () => {
  it("composes the bar, the doors, the rail and the shelf", async () => {
    const el = await page(model());
    const root = el.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-extras-doors", "mc-extras-tabs", "mc-extras-shelf"]) {
      expect(root.querySelector(tag), tag).not.toBeNull();
    }
    expect(root.querySelector("mc-extras-player")).toBeNull();
    expect(root.querySelector("mc-extras-tracks")).toBeNull();
  });

  it("swaps the shelf for the player over the song rows on the Music tab", async () => {
    const el = await page(
      model({
        shelf: null,
        tracks: { tracks: [], empty: "Nothing here yet." },
        player: {
          status: "NOTHING PLAYING",
          title: null,
          detail: null,
          shuffleLabel: "Shuffle",
          nextLabel: "Next",
          pauseLabel: "Pause",
          shuffleOn: false,
          paused: false,
          reason: "",
          volume: null,
        },
      }),
    );
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-extras-shelf")).toBeNull();
    expect(root.querySelector("mc-extras-player")).not.toBeNull();
    expect(root.querySelector("mc-extras-tracks")).not.toBeNull();
  });

  it("marks the stacked layout the stylesheet answers, and turns Back into one typed event", async () => {
    const el = await page(model({ stackDoors: true }));
    expect(el.shadowRoot!.querySelector(".nav")!.hasAttribute("data-stacked")).toBe(true);
    const heard = vi.fn();
    el.addEventListener("mc-extras", (event) => heard(event.detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "back" });
  });
});

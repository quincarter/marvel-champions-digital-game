import { describe, expect, it } from "vitest";
import "./mc-title-panel.js";
import type { TitlePanelModel } from "./mc-title-panel.types.js";

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, button: 0 });
}

const model = (extra: Partial<TitlePanelModel> = {}): TitlePanelModel => ({
  ground: "paper",
  scroll: null,
  scrollHeight: 0,
  news: {
    rect: { x: 0, y: 0, width: 400, height: 40 },
    model: { tag: "NEW", message: "What's new in v1.0.0", link: "Read more ↗" },
  },
  banner: null,
  rank: {
    rect: { x: 12, y: 500, width: 300, height: 58 },
    model: {
      compact: false,
      up: false,
      label: "RANK 1",
      title: "Sidekick in Training",
      points: "0 pts",
      next: "100 to Neighborhood Watch",
      fraction: 0,
    },
  },
  menu: [
    { key: "new-game", label: "New game", kind: "primary", rect: { x: 40, y: 100, width: 300, height: 52 } },
    { key: "settings", label: "Settings", kind: "secondary", rect: { x: 40, y: 160, width: 300, height: 44 } },
  ],
  promo: null,
  footer: {
    rect: { x: 40, y: 600, width: 300, height: 44 },
    model: {
      note: "1 / 2 cards live",
      version: "v1.0.0",
      links: [{ key: "release-notes", label: "Release notes ↗" }],
      aside: null,
    },
  },
  status: null,
  problem: null,
  glyphs: [],
  ...extra,
});

async function panel(value: TitlePanelModel) {
  const element = document.createElement("mc-title-panel");
  element.model = value;
  document.body.append(element);
  await element.updateComplete;
  // The children render on their own cycle.
  for (const tag of [
    "mc-menu-grid",
    "mc-rank-bar",
    "mc-news-bar",
    "mc-footer-bar",
    "mc-alert-banner",
    "mc-promo-panel",
  ]) {
    for (const child of element.renderRoot.querySelectorAll(tag))
      await (child as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  }
  for (const grid of element.renderRoot.querySelectorAll("mc-menu-grid"))
    for (const button of grid.renderRoot.querySelectorAll("mc-menu-button"))
      await (button as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const activations: string[] = [];
  element.addEventListener("mc-activate", (event) =>
    activations.push((event as CustomEvent<{ key: string }>).detail.key),
  );
  return { element, activations };
}

describe("mc-title-panel", () => {
  it("finds the element of every focus stop the screen keeps", async () => {
    const { element } = await panel(model());
    for (const key of ["new-game", "settings", "rank-badge", "release-notice", "release-notes"])
      expect(element.elementOf(key), key).not.toBeNull();
    expect(element.elementOf("nowhere")).toBeNull();
    element.remove();
  });

  it("reports the rank plate and the news bar by their stop keys, on a tap", async () => {
    const { element, activations } = await panel(model());
    for (const key of ["rank-badge", "release-notice"]) {
      const target = element.elementOf(key)!;
      target.dispatchEvent(pointer("pointerdown", 4, 4));
      target.dispatchEvent(pointer("pointerup", 5, 5));
    }
    expect(activations).toEqual(["rank-badge", "release-notice"]);
    element.remove();
  });

  it("scrolls the menu inside its box when the window is too short for it, and shifts it under the rule", async () => {
    const { element } = await panel(model({ scroll: { x: 0, y: 120, width: 400, height: 200 }, scrollHeight: 520 }));
    const viewport = element.scroller!;
    expect(viewport.className).toContain("scrolls");
    expect(viewport.getAttribute("style")).toContain("top:120px");
    expect(viewport.querySelector(".sizer")?.getAttribute("style")).toContain("height:520px");
    expect(viewport.querySelector(".shift")?.getAttribute("style")).toContain("top:-120px");
    element.remove();
  });

  it("says why a replay did not open, and what stopped a resume", async () => {
    const { element } = await panel(
      model({
        problem: "That replay could not be opened.",
        status: { rect: { x: 40, y: 560, width: 300, height: 20 }, text: "no save" },
      }),
    );
    expect(element.renderRoot.querySelector(".problem")?.textContent).toBe("That replay could not be opened.");
    expect(element.renderRoot.querySelector(".status")?.textContent).toBe("no save");
    element.remove();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-civil-war-page.js";
import type { McCivilWarPage } from "../McCivilWarPage.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCivilWarPage> {
  const el = document.createElement("mc-civil-war-page");
  el.model = {
    mode: "wide",
    bar: { backLabel: "Back", backGlyph: null },
    status: "Pick a side",
    sheet: null,
    pictures: { leader: () => ({ src: null }), face: () => ({ src: null }), back: { src: null } },
    view: {
      title: "Build",
      step: 1,
      blind: false,
      seal: null,
      canStart: false,
      startProblem: "Pick a side",
      expertNote: null,
      steps: [{ step: 1, action: "civil:step:1", title: "Side", line: "", complete: false, active: true }],
      sideChoices: [],
      summary: [],
      summaryArt: {
        leader: { scenarioId: "s", cardId: "c", name: "x" },
        stages: [],
        setsHidden: false,
        sets: [],
        setCount: 0,
      },
    },
  } as never;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-civil-war-page", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-civil-rail", "mc-civil-sides", "mc-civil-summary", "mc-civil-foot"])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(root.querySelector("mc-civil-sheet")).toBeNull();
    expect(root.querySelector("mc-hint-button[data-stop='civil:blind:show']")).toBeNull();
  });

  it("says act civil:back from the bar", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-civil-war", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "act", action: "civil:back" });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import "./mc-rank-bar.js";
import type { RankBarModel } from "./mc-rank-bar.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<RankBarModel> = {}): RankBarModel => ({
  compact: false,
  up: false,
  label: "RANK 3",
  title: "Sidekick in Training",
  points: "1,250 pts",
  next: "300 to Street-Level Legend",
  fraction: 0.4,
  ...over,
});

async function mount(m: RankBarModel | null) {
  const el = document.createElement("mc-rank-bar");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-rank-bar", () => {
  it("draws the label, title, points, a bar filled to its fraction and the next-rank caption in words", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    expect(root.querySelector(".label")!.textContent).toBe("RANK 3");
    expect(root.querySelector(".title")!.textContent).toBe("Sidekick in Training");
    expect(root.querySelector(".points")!.textContent).toBe("1,250 pts");
    expect(root.querySelector(".fill")!.getAttribute("style")).toContain("* 0.4");
    expect(root.querySelector(".caption")!.textContent).toBe("300 to Street-Level Legend");
  });

  it("is one line when compact, with the bar tucked under it", async () => {
    const el = await mount(model({ compact: true }));
    expect(el.shadowRoot!.querySelector(".title")).toBeNull();
    expect(el.shadowRoot!.querySelector(".bar")!.getAttribute("style")).toContain("top:20px");
  });

  it("announces a rank-up in place of the bar, reflected as up, and an empty bar draws no fill width", async () => {
    const up = await mount(model({ up: true, label: "RANK UP", points: null, next: null }));
    expect(up.hasAttribute("up")).toBe(true);
    expect(up.shadowRoot!.querySelector(".bar")).toBeNull();
    expect(up.shadowRoot!.querySelector(".points")).toBeNull();
    const empty = await mount(model({ fraction: 0 }));
    expect(empty.shadowRoot!.querySelector(".fill")!.getAttribute("style")).toContain("width:0");
  });

  it("raises mc-press on a tap, and draws nothing without a model", async () => {
    const el = await mount(model());
    let pressed = 0;
    el.addEventListener("mc-press", () => pressed++);
    tap(el);
    expect(pressed).toBe(1);
    const none = await mount(null);
    expect(none.shadowRoot!.querySelector(".plate")).toBeNull();
  });
});

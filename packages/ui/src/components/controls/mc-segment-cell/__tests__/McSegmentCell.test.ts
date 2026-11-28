// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-segment-cell";

afterEach(() => document.body.replaceChildren());

describe("mc-segment-cell", () => {
  it("draws its label, and a tile's detail only in the tile look", async () => {
    const el = document.createElement("mc-segment-cell");
    el.label = "Full";
    el.detail = "Every step explained";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("Full");
    expect(el.shadowRoot!.querySelector(".detail")).toBeNull();
    el.look = "tile";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".detail")!.textContent).toBe("Every step explained");
  });

  it("raises its action when pressed", async () => {
    const el = document.createElement("mc-segment-cell");
    el.action = "full";
    document.body.append(el);
    await el.updateComplete;
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.click();
    expect(seen).toEqual([{ action: "full", hold: false }]);
  });
});

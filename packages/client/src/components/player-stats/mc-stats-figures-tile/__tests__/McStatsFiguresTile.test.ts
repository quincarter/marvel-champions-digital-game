// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stats-figures-tile";

afterEach(() => document.body.replaceChildren());

describe("mc-stats-figures-tile", () => {
  it("lists each figure as a label and its value under the caption", async () => {
    const el = document.createElement("mc-stats-figures-tile");
    el.stop = "tile:per-game";
    el.label = "Each game";
    el.lines = [
      { label: "Rounds", value: "7" },
      { label: "Damage", value: "1,065" },
    ];
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".caption")!.textContent).toBe("Each game");
    expect([...root.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Rounds", "Damage"]);
    expect([...root.querySelectorAll("dd")].map((d) => d.textContent)).toEqual(["7", "1,065"]);
    expect(el.getAttribute("data-stop")).toBe("tile:per-game");
  });
});

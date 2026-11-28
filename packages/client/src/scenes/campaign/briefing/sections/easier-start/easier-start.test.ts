// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { bangersMock, sectionHarness, textsOf } from "../sections.test-support.js";
import { EASIER_START_KEY, drawEasierStart } from "./easier-start.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("../../../../../ui/campaign-chrome.js", () => bangersMock);
vi.mock("../../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

const brief = (on: boolean) => ({ on, name: "x", meta: "y" });

describe("the easier-start toggle", () => {
  it("is one card that is the whole button, and a press only reports it", () => {
    const h = sectionHarness();
    const toggled = vi.fn();
    h.run((base) => drawEasierStart({ ...base, easier: brief(false) }, { toggle: toggled }));
    expect(h.stopKeys()).toEqual([EASIER_START_KEY]);
    h.press(EASIER_START_KEY);
    expect(toggled).toHaveBeenCalledOnce();
  });

  it("says the state in words, and frames it in red while on", () => {
    const off = sectionHarness().run((base) =>
      drawEasierStart({ ...base, easier: brief(false) }, { toggle: () => {} }),
    );
    expect(textsOf(off.b)).toEqual(
      expect.arrayContaining(["SETUP OPTION", "EASIER START: BEGIN AT APOCALYPSE (I)", "Off · begins at stage II"]),
    );
    const on = sectionHarness().run((base) => drawEasierStart({ ...base, easier: brief(true) }, { toggle: () => {} }));
    expect(textsOf(on.b)).toContain("On · begins at stage I");
    const frame = (b: typeof on.b): number | undefined =>
      b.nodes.flatMap((node) => (node.kind === "box" && node.stroke && node.strokeWidth ? [node.strokeWidth] : []))[0];
    expect(frame(on.b)).toBe(4);
    expect(frame(off.b)).toBe(2);
  });
});

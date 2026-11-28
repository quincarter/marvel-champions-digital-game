// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-deck-composition.js";

describe("mc-deck-composition", () => {
  it("draws a segment per aspect, marks the open tip, and finds a segment to anchor on", async () => {
    const el = document.createElement("mc-deck-composition");
    el.heading = "Aspect";
    el.segments = [
      { aspect: "justice", label: "Justice", chosen: true, tipLabel: "Justice" },
      { aspect: "pool", label: "'Pool", chosen: false, tipLabel: "'Pool" },
    ];
    el.openTip = "pool";
    document.body.append(el);
    await el.updateComplete;
    const segments = [...el.shadowRoot!.querySelectorAll<HTMLElement & { tipOpen: boolean }>("mc-aspect-segment")];
    expect(segments.map((s) => s.tipOpen)).toEqual([false, true]);
    expect(el.anchorOf("pool")).toBe(segments[1]);
    expect(el.anchorOf("nope")).toBeNull();
    el.remove();
  });
});

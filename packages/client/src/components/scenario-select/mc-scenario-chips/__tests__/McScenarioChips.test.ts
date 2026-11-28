// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, press, selectEvents } from "../../test-support.js";
import "../mc-scenario-chips.js";

afterEach(() => document.body.replaceChildren());

const chips = [
  { id: "product:core", label: "Core Set", selected: true },
  { id: "product:hood", label: "The Hood", selected: false },
];

describe("mc-scenario-chips", () => {
  it("draws one chip per pack, a chosen one marked by a check, each a focus stop", async () => {
    const el = await mount("mc-scenario-chips", { chips });
    const drawn = [...el.shadowRoot!.querySelectorAll<HTMLElement>("mc-filter-chip")];
    expect(drawn.map((chip) => chip.dataset.stop)).toEqual([
      "scenario-chip:product:core",
      "scenario-chip:product:hood",
    ]);
    expect((drawn[0] as unknown as { text: string }).text).toBe("\u2713 Core Set");
    expect((drawn[1] as unknown as { text: string }).text).toBe("The Hood");
  });

  it("raises a press of the chip's key from a tap, and from a focus stop's click", async () => {
    const el = await mount("mc-scenario-chips", { chips });
    const seen = selectEvents(el);
    const hood = inner<HTMLElement>(el, '[data-id="product:hood"]')!;
    press(hood);
    expect(seen).toEqual([{ type: "press", key: "scenario-chip:product:hood" }]);
  });

  it("is one sideways row with the rail attribute", async () => {
    const el = await mount("mc-scenario-chips", { chips, rail: true });
    expect(el.hasAttribute("rail")).toBe(true);
  });
});

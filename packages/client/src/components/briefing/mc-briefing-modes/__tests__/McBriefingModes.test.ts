// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, findAll, mount, press, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-modes.js";

afterEach(() => document.body.replaceChildren());

const rows = [
  {
    id: "expert",
    name: "Difficulty",
    meta: "Standard set only",
    chips: [
      { label: "Standard", action: "expert:off", selected: true, enabled: true },
      { label: "Expert", action: "expert:on", selected: false, enabled: true },
    ],
  },
  {
    id: "heroic",
    name: "Heroic level",
    meta: "Off",
    chips: [
      { label: "-", action: "heroic:down", selected: false, enabled: false },
      { label: "0", action: "", selected: true, enabled: false },
      { label: "+", action: "heroic:up", selected: false, enabled: true },
    ],
  },
];

describe("mc-briefing-modes", () => {
  it("one row per mode, each live chip a stop that raises set-mode with its action", async () => {
    const el = await mount("mc-briefing-modes", { rows });
    expect(wordsOf(el)).toContain("MODES FOR THIS ISSUE");
    expect(stopsOf(el)).toEqual(["mode:expert:off", "mode:expert:on", "mode:heroic:up"]);
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="mode:expert:on"]')!);
    expect(seen).toEqual([{ type: "set-mode", action: "expert:on" }]);
  });

  it("a chip the model disables is shown and takes no press, and a chosen chip is the selected one", async () => {
    const el = await mount("mc-briefing-modes", { rows });
    const chips = findAll(el, "mc-chip");
    const down = chips[2]!;
    expect(down.hasAttribute("disabled")).toBe(true);
    const seen = briefingEvents(el);
    press(down);
    expect(seen).toEqual([]);
    expect(chips[0]!.hasAttribute("selected")).toBe(true);
  });
});

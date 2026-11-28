// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, press, stepEvents, stopsOf } from "../../test-support.js";
import "../mc-briefing-confirm-bar.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-confirm-bar", () => {
  it("Back and Confirm are stops that raise their own steps", async () => {
    const el = await mount("mc-briefing-confirm-bar", {
      model: { stops: { back: "role-back", confirm: "role-confirm" }, glyph: null },
    });
    expect(stopsOf(el)).toEqual(["role-back", "role-confirm"]);
    const seen = stepEvents(el);
    press(find(el, '[data-stop="role-back"]')!);
    press(find(el, '[data-stop="role-confirm"]')!);
    expect(seen).toEqual([{ type: "back" }, { type: "confirm" }]);
  });

  it("an Inspect stop joins them when asked", async () => {
    const el = await mount("mc-briefing-confirm-bar", {
      model: { stops: { back: "rb-back", confirm: "rb-confirm", read: "rb-inspect" }, glyph: null },
    });
    expect(stopsOf(el)).toEqual(["rb-back", "rb-inspect", "rb-confirm"]);
    const seen = stepEvents(el);
    press(find(el, '[data-stop="rb-inspect"]')!);
    expect(seen).toEqual([{ type: "read" }]);
  });
});

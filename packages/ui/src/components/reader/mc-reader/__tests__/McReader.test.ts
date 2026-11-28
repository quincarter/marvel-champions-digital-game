import { afterEach, describe, expect, it } from "vitest";
import "../mc-reader";

afterEach(() => document.body.replaceChildren());

describe("mc-reader", () => {
  it("has a slot for each part of a reading screen", async () => {
    const el = document.createElement("mc-reader");
    document.body.append(el);
    await el.updateComplete;
    const slots = [...el.shadowRoot!.querySelectorAll("slot")].map((slot) => slot.name);
    expect(slots).toEqual(["bar", "toolbar", "side", "main", "foot"]);
  });

  it("reflects its layout choices as attributes the stylesheet answers", async () => {
    const el = document.createElement("mc-reader");
    el.wide = true;
    el.pane = "main";
    el.noSide = true;
    document.body.append(el);
    await el.updateComplete;
    expect(el.hasAttribute("wide")).toBe(true);
    expect(el.getAttribute("pane")).toBe("main");
    expect(el.hasAttribute("no-side")).toBe(true);
  });
});

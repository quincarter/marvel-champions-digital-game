// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount } from "../../test-support.js";
import "../mc-briefing-framed-row.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-framed-row", () => {
  it("holds its slotted content and reflects the stripe and fill for the stylesheet", async () => {
    const el = await mount("mc-briefing-framed-row", { stripe: "heal", fill: "parchment" });
    expect(el.getAttribute("stripe")).toBe("heal");
    expect(el.getAttribute("fill")).toBe("parchment");
    expect(find(el, "slot")).not.toBeNull();
  });

  it("has no stripe unless it is given one", async () => {
    const el = await mount("mc-briefing-framed-row");
    expect(el.getAttribute("stripe")).toBe("");
  });
});

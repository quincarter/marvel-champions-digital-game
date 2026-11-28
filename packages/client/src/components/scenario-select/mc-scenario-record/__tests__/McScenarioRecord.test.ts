// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount } from "../../test-support.js";
import "../mc-scenario-record.js";

afterEach(() => document.body.replaceChildren());

describe("mc-scenario-record", () => {
  it("prints the tally in words and wears the tone as an attribute", async () => {
    const el = await mount("mc-scenario-record", {
      label: "Record",
      tally: "2 wins",
      subline: "Best clear: round 6",
      tone: "beaten",
    });
    expect(inner(el, ".tally")!.textContent).toBe("2 wins");
    expect(inner(el, ".subline")!.textContent).toBe("Best clear: round 6");
    expect(el.getAttribute("tone")).toBe("beaten");
  });

  it("has no second line when there is none", async () => {
    const el = await mount("mc-scenario-record", { tally: "Not played yet" });
    expect(inner(el, ".subline")).toBeNull();
    expect(el.getAttribute("tone")).toBe("unplayed");
  });
});

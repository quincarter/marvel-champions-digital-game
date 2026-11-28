// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount } from "../../test-support.js";
import "../mc-scenario-stage.js";

afterEach(() => document.body.replaceChildren());

describe("mc-scenario-stage", () => {
  it("prints the stage and its stats, and says which stage is in play by an attribute (a frame, not color alone)", async () => {
    const el = await mount("mc-scenario-stage", { name: "I \u00b7 RHINO", stats: "SCH 1", current: true });
    expect(inner(el, ".title")!.textContent).toBe("I \u00b7 RHINO");
    expect(inner(el, ".stats")!.textContent).toBe("SCH 1");
    expect(el.hasAttribute("current")).toBe(true);
  });
});

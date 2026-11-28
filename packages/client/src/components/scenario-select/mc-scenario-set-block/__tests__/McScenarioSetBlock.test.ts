// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount } from "../../test-support.js";
import "../mc-scenario-set-block.js";

afterEach(() => document.body.replaceChildren());

describe("mc-scenario-set-block", () => {
  it("prints the label over the names", async () => {
    const el = await mount("mc-scenario-set-block", { heading: "Encounter sets", value: "Rhino" });
    expect(inner(el, ".heading")!.textContent).toBe("Encounter sets");
    expect(inner(el, ".value")!.textContent).toBe("Rhino");
  });
});

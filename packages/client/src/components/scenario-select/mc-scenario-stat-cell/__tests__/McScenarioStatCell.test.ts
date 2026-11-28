// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount } from "../../test-support.js";
import "../mc-scenario-stat-cell.js";

afterEach(() => document.body.replaceChildren());

describe("mc-scenario-stat-cell", () => {
  it("prints its label over its value", async () => {
    const el = await mount("mc-scenario-stat-cell", { label: "Main scheme", value: "The Break-In!" });
    expect(inner(el, ".label")!.textContent).toBe("Main scheme");
    expect(inner(el, ".value")!.textContent).toBe("The Break-In!");
  });
});

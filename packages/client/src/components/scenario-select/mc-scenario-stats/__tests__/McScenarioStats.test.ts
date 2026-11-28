// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mount } from "../../test-support.js";
import "../mc-scenario-stats.js";

afterEach(() => document.body.replaceChildren());

describe("mc-scenario-stats", () => {
  it("draws nothing without cells, and one cell per stat with them", async () => {
    const empty = await mount("mc-scenario-stats");
    expect(empty.shadowRoot!.querySelectorAll("mc-scenario-stat-cell")).toHaveLength(0);
    const cells = ["A", "B", "C", "D"].map((label) => ({ label, value: label.toLowerCase() }));
    const el = await mount("mc-scenario-stats", { cells, wide: true });
    expect(el.shadowRoot!.querySelectorAll("mc-scenario-stat-cell")).toHaveLength(4);
    expect(el.hasAttribute("wide")).toBe(true);
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-handled-row.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-handled-row", () => {
  it("a step that happens this issue gets a check, a held value an arrow", async () => {
    const done = await mount("mc-briefing-handled-row", {
      row: { key: "a", status: "done", title: "Villain set", detail: "Rhino", citation: "p. 5" },
    });
    expect(find(done, ".mark")?.textContent).toBe("✓");
    expect(wordsOf(done)).toBe("✓ Villain set Rhino p. 5");
    const later = await mount("mc-briefing-handled-row", {
      row: { key: "b", status: "later", title: "Held", detail: "" },
    });
    expect(find(later, ".mark")?.textContent).toBe("→");
    expect(find(later, ".detail")).toBeNull();
    expect(find(later, ".citation")).toBeNull();
  });
});

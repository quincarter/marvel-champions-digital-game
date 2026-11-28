import { describe, expect, it } from "vitest";
import { languageMenuModelOf } from "./language-menu-model.js";
import { REPORT_ORDER, reportIssueModelOf } from "./report-issue-model.js";

const anchor = { x: 300, y: 10, width: 58, height: 34 };

describe("languageMenuModelOf", () => {
  it("lists the languages with the current one marked, hung under the button", () => {
    const model = languageMenuModelOf("menu", anchor, { width: 412, height: 924 }, "es", ["en", "es"]);
    expect(model.mode).toBe("list");
    expect(model.rows.map((row) => row.key)).toEqual(["en", "es"]);
    expect(model.rows[1]!.selected).toBe(true);
    expect(model.rows[1]!.label).toContain("✓");
    expect(model.box.y).toBeGreaterThan(anchor.y);
    expect(model.phone).toBe(true);
  });

  it("is the Other languages note on a native install, with the two links and a close button", () => {
    const model = languageMenuModelOf("info", anchor, { width: 1440, height: 900 }, "en", ["en", "es"]);
    expect(model.mode).toBe("note");
    expect(model.note!.links.map((link) => link.key)).toEqual(["downloads", "web"]);
    expect(model.note!.close.key).toBe("close");
    expect(model.note!.paragraphs).toHaveLength(4);
  });
});

describe("reportIssueModelOf", () => {
  it("has the three steps, the focus order's buttons, and two columns only when wide but short", () => {
    const wide = reportIssueModelOf({ width: 844, height: 390 }, "tip", "");
    const keys = wide.steps.flatMap((step) => step.rows.flat().map((button) => button.key));
    expect(wide.steps).toHaveLength(3);
    expect(REPORT_ORDER.filter((key) => key !== "close")).toEqual(keys);
    expect(wide.columns).toBe(2);
    expect(reportIssueModelOf({ width: 412, height: 924 }, "tip", "").columns).toBe(1);
    expect(wide.steps[0]!.body).toContain("tip");
  });
});

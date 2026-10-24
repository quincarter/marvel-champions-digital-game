import { describe, expect, it } from "vitest";
import { controlsLayout, type ControlsLayoutInput } from "./controls-layout.js";
import { rectsOverlap, type Rect } from "./layout.js";

const input = (
  tab: "controller" | "keyboard",
  drawing: ControlsLayoutInput["drawing"] = "xbox",
): ControlsLayoutInput => ({
  tab,
  drawing,
  caption: "A confirms and B backs out. LB / RB page lists and jump between zones.",
  groupRows:
    tab === "controller"
      ? [
          { id: "labels", kind: "segmented", detail: "Auto follows the connected controller." },
          { id: "nintendo", kind: "toggle", detail: "On a Nintendo-style controller, buttons act by label." },
          { id: "hints", kind: "toggle", detail: "Draws the key or button beside a control." },
        ]
      : [{ id: "hints", kind: "toggle", detail: "Draws the key or button beside a control." }],
  sections:
    tab === "controller"
      ? [{ id: "buttons", title: "BUTTONS", notes: Array.from({ length: 13 }, () => "On the table") }]
      : [
          { id: "everywhere", title: "EVERYWHERE", notes: ["a", "b", "c"] },
          { id: "table", title: "ON THE TABLE", notes: ["a", "b"] },
        ],
  footerButtons: tab === "controller" ? 2 : 1,
});

const SIZES = [
  { width: 390, height: 844 },
  { width: 800, height: 600 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

describe("controlsLayout", () => {
  for (const size of SIZES) {
    for (const tab of ["controller", "keyboard"] as const) {
      it(`keeps the chrome apart and inside the panel at ${size.width}x${size.height} on ${tab}`, () => {
        const layout = controlsLayout({ x: 0, y: 0, ...size }, input(tab));
        const chrome: Rect[] = [layout.header, layout.tabs, layout.viewport];
        for (let i = 0; i < chrome.length; i++)
          for (let j = i + 1; j < chrome.length; j++) expect(rectsOverlap(chrome[i]!, chrome[j]!)).toBe(false);
        expect(rectsOverlap(layout.status, layout.tabs)).toBe(false);
        expect(rectsOverlap(layout.status, layout.viewport)).toBe(false);
        const { panel } = layout;
        for (const rect of [...chrome, layout.status, layout.close]) {
          expect(rect.x).toBeGreaterThanOrEqual(panel.x);
          expect(rect.x + rect.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
          expect(rect.y + rect.height).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
        }
      });
    }
  }

  it("puts the drawing beside the list on a wide screen and stacks it on a phone", () => {
    const wide = controlsLayout({ x: 0, y: 0, width: 1440, height: 900 }, input("controller")).content;
    expect(wide.twoColumns).toBe(true);
    expect(wide.diagram!.x + wide.diagram!.width).toBeLessThanOrEqual(wide.group.x);
    const phone = controlsLayout({ x: 0, y: 0, width: 390, height: 844 }, input("controller")).content;
    expect(phone.twoColumns).toBe(false);
    expect(phone.group.y).toBeGreaterThan(phone.caption!.y + phone.caption!.height);
  });

  it("never overlaps list rows, and the slot heights sum to the content height", () => {
    for (const size of SIZES) {
      const { content } = controlsLayout({ x: 0, y: 0, ...size }, input("controller"));
      const rows = content.sections.flatMap((s) => s.rows);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.y).toBeGreaterThanOrEqual(rows[i - 1]!.y + rows[i - 1]!.height);
      }
      expect(content.slotHeights.reduce((a, b) => a + b, 0)).toBeCloseTo(content.totalHeight, 5);
      expect(content.slotHeights.every((h) => h >= 0)).toBe(true);
    }
  });

  it("keeps group rows inside the group and the footer under the last row", () => {
    const { content } = controlsLayout({ x: 0, y: 0, width: 390, height: 844 }, input("controller"));
    for (const row of content.groupRows) {
      expect(row.row.y + row.row.height).toBeLessThanOrEqual(content.group.y + content.group.height);
      expect(row.control.x + row.control.width).toBeLessThanOrEqual(row.row.x + row.row.width);
    }
    const last = content.sections.at(-1)!.rows.at(-1)!;
    expect(content.footer[0]!.y).toBeGreaterThan(last.y + last.height);
    expect(content.footer).toHaveLength(2);
  });

  it("stacks a segmented control under its text when its column is narrow, never past its row", () => {
    for (const size of SIZES) {
      const { groupRows } = controlsLayout({ x: 0, y: 0, ...size }, input("controller")).content;
      const row = groupRows[0]!;
      expect(row.control.x + row.control.width).toBeLessThanOrEqual(row.row.x + row.row.width);
      expect(row.control.y + row.control.height).toBeLessThanOrEqual(row.row.y + row.row.height);
      if (row.stacked) expect(row.control.y).toBeGreaterThan(row.row.y + 20);
    }
    const phone = controlsLayout({ x: 0, y: 0, width: 390, height: 844 }, input("controller")).content;
    expect(phone.groupRows[0]!.stacked).toBe(true);
  });

  it("lays the keyboard tab in one column with its groups in order", () => {
    const { content } = controlsLayout({ x: 0, y: 0, width: 1440, height: 900 }, input("keyboard"));
    expect(content.twoColumns).toBe(false);
    expect(content.diagram).toBeNull();
    expect(content.sections.map((s) => s.id)).toEqual(["everywhere", "table"]);
    expect(content.footer).toHaveLength(1);
  });

  it("puts the status beside the tabs when there is room and under them otherwise", () => {
    const wide = controlsLayout({ x: 0, y: 0, width: 1440, height: 900 }, input("controller"));
    expect(wide.status.x).toBeGreaterThan(wide.tabs.x + wide.tabs.width);
    const phone = controlsLayout({ x: 0, y: 0, width: 390, height: 844 }, input("controller"));
    expect(phone.status.y).toBeGreaterThanOrEqual(phone.tabs.y + phone.tabs.height);
  });
});

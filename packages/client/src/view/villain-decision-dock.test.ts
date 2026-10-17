import { describe, expect, test } from "vitest";
import { hit } from "../tokens.js";
import {
  decisionOptionIsCard,
  dockableDecision,
  villainDecisionDockLayout,
  villainDecisionTuckLabel,
} from "./villain-decision-dock.js";
import type { Rect } from "./layout.js";

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("villainDecisionDockLayout: the docked phase's header over the choice sheet (#231)", () => {
  const cases: readonly [string, Rect, "rail" | "band" | "tab"][] = [
    ["the desktop rail", { x: 965, y: 44, width: 475, height: 936 }, "rail"],
    ["the tablet band", { x: 0, y: 44, width: 1024, height: 439 }, "band"],
    ["the phone tab", { x: 0, y: 44, width: 390, height: 530 }, "tab"],
  ];
  for (const [name, panel, kind] of cases) {
    test(`${name}: the header's controls and the sheet stay inside the panel and apart`, () => {
      const layout = villainDecisionDockLayout(panel, kind);
      for (const rect of [layout.title, layout.expand, layout.tuck, layout.sheet])
        expect(inside(rect, panel)).toBe(true);
      expect(overlaps(layout.expand, layout.tuck)).toBe(false);
      expect(overlaps(layout.expand, layout.sheet)).toBe(false);
      expect(overlaps(layout.tuck, layout.sheet)).toBe(false);
      expect(layout.expand.height).toBeGreaterThanOrEqual(hit.target);
      expect(layout.tuck.height).toBeGreaterThanOrEqual(hit.target);
    });
  }

  test("the sheet takes the panel's whole width and everything under the header", () => {
    const panel: Rect = { x: 965, y: 44, width: 475, height: 936 };
    const { sheet } = villainDecisionDockLayout(panel, "rail");
    expect(sheet.x).toBe(panel.x);
    expect(sheet.width).toBe(panel.width);
    expect(sheet.y + sheet.height).toBe(panel.y + panel.height);
  });

  test("a phone's controls sit in the thumb strip, clear of the top where the Now playing toast slides in", () => {
    const panel: Rect = { x: 0, y: 100, width: 390, height: 470 };
    const footer: Rect = { x: 0, y: 760, width: 390, height: 72 };
    const layout = villainDecisionDockLayout(panel, "tab", footer);
    expect(layout.sheet).toEqual(panel);
    for (const rect of [layout.tuck, layout.expand]) {
      expect(inside(rect, footer)).toBe(true);
      expect(rect.height).toBeGreaterThanOrEqual(hit.target);
      expect(overlaps(rect, panel)).toBe(false);
    }
    expect(overlaps(layout.tuck, layout.expand)).toBe(false);
    expect(layout.tuck.width, "PEEK AT TABLE is the wider of the two").toBeGreaterThan(layout.expand.width);
  });

  test("a phone's tab leaves the title too narrow to draw: the chrome already names the phase", () => {
    const { title } = villainDecisionDockLayout({ x: 0, y: 44, width: 390, height: 530 }, "tab");
    expect(title.width).toBeLessThan(160);
  });

  test("the rail and band hide beside the table; the phone's tab peeks at it", () => {
    expect(villainDecisionTuckLabel("rail")).toBe("Hide ▸");
    expect(villainDecisionTuckLabel("band")).toBe("Hide ▸");
    expect(villainDecisionTuckLabel("tab")).toBe("Peek at table ▾");
  });
});

describe("dockableDecision", () => {
  test("a revealed card's choice, a target and an order dock", () => {
    for (const kind of ["chooseOption", "chooseTarget", "orderCards", "chooseCards", "payForCard"])
      expect(dockableDecision(kind)).toBe(true);
  });

  test("a defend has its own panel; the accusation grid, the mulligan and a reported fact keep the full sheet", () => {
    for (const kind of ["declareDefender", "accuse", "mulligan", "reportFact"])
      expect(dockableDecision(kind)).toBe(false);
  });
});

describe("decisionOptionIsCard", () => {
  test("a card or an ability on a card widens the rail; anything else reads in the ordinary rail", () => {
    expect(decisionOptionIsCard("card")).toBe(true);
    expect(decisionOptionIsCard("ability")).toBe(true);
    expect(decisionOptionIsCard("option")).toBe(false);
    expect(decisionOptionIsCard("player")).toBe(false);
  });
});

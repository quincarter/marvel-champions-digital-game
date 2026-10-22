import { describe, expect, it } from "vitest";
import { VILLAIN_PANEL_MIN_HEIGHT, villainPanelPlan, villainPanelWidth } from "./villain-panel-layout.js";

const room = { x: 10, y: 10, width: 1126 };

describe("villainPanelPlan", () => {
  it("seats two villains as full panels side by side at the band's height on a wide table", () => {
    const plan = villainPanelPlan(room, 2, 188)!;
    expect(plan.tileHeight).toBe(188);
    expect(plan.slots).toHaveLength(2);
    expect(plan.slots[0]!.width).toBe(villainPanelWidth(188));
    expect(plan.slots[1]!.x).toBe(plan.slots[0]!.x + plan.tileWidth + 10);
    expect(plan.right).toBeLessThanOrEqual(room.x + room.width);
  });

  it("shrinks panels to fit, leaving the environment's room on the right", () => {
    const plan = villainPanelPlan(room, 3, 260, 180)!;
    expect(plan.right).toBeLessThanOrEqual(room.x + room.width - 180);
    expect(plan.tileHeight).toBeGreaterThanOrEqual(VILLAIN_PANEL_MIN_HEIGHT);
  });

  it("gives up (the compact tile row) when a panel would be shorter than the floor", () => {
    expect(villainPanelPlan({ ...room, width: 500 }, 3, 188)).toBeNull();
    expect(villainPanelPlan({ ...room, width: 370 }, 2, 188)).toBeNull();
  });

  it("is for two or three villains only", () => {
    expect(villainPanelPlan(room, 1, 188)).toBeNull();
    expect(villainPanelPlan(room, 4, 188)).toBeNull();
    expect(villainPanelPlan(room, 6, 188)).toBeNull();
  });
});

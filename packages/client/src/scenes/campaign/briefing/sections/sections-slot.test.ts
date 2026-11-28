// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BriefingPlan } from "../context.js";
import { bangersMock, sectionHarness } from "./sections.test-support.js";
import type { SectionData } from "./sections.types.js";
import { sectionsSlot } from "./sections-slot.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("../../../../ui/campaign-chrome.js", () => bangersMock);
vi.mock("../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

let data: SectionData;
vi.mock("./data.js", () => ({ sectionDataOf: () => data }));

const easier = { on: false, name: "x", meta: "y" };
const modes = [
  {
    id: "expert",
    name: "Difficulty",
    meta: "Standard set only",
    chips: [{ action: "expert:on", label: "Expert", selected: false, enabled: true }],
  },
];
const plan = (over: Partial<BriefingPlan>): BriefingPlan => ({
  phone: false,
  view: null,
  hasPool: false,
  seatCall: false,
  callOwnsScroll: false,
  ...over,
});

/** Draws `block` of the slot under `over`; returns the stop keys it registered. */
function stops(block: "main" | "aside", over: Partial<BriefingPlan>): string[] {
  const h = sectionHarness(() => {}, over.phone ?? false);
  h.ctx.plan = plan(over);
  h.run((base) => sectionsSlot[block](base.ctx, base.b, base.col, base.top));
  return h.stopKeys();
}

beforeEach(() => {
  data = { scheme: null, mission: null, shield: null, easier, modes };
});

describe("where the sections go", () => {
  it("puts a phone's easier start and modes in its one column, and nothing in the wide aside's main", () => {
    expect(stops("main", { phone: true })).toEqual(["easier-start", "mode:expert:on"]);
    expect(stops("main", { phone: false, hasPool: true })).toEqual(["easier-start"]);
  });

  it("puts the wide right pane's sections beside the decks, or only the modes when a pool fills the left", () => {
    expect(stops("aside", {})).toEqual(["easier-start", "mode:expert:on"]);
    expect(stops("aside", { hasPool: true })).toEqual(["mode:expert:on"]);
  });

  it("draws nothing under a per-seat call", () => {
    expect(stops("main", { phone: true, seatCall: true })).toEqual([]);
    expect(stops("aside", { seatCall: true })).toEqual([]);
  });

  it("leaves a game already on the table without modes", () => {
    data = { ...data, modes: [] };
    expect(stops("aside", {})).toEqual(["easier-start"]);
  });

  it("draws the pool only when the plan's view has one", () => {
    const h = sectionHarness();
    const bottom = h.run((base) => sectionsSlot.pool(base.ctx, base.b, base.col, base.top)).bottom;
    expect(bottom).toBe(100);
  });
});

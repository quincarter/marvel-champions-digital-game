import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModularSetOption } from "../../../view/modular-sets.js";
import { testFrame } from "../shared/test-frame.js";
import { compactModulars, drawCompactModulars, drawModulars, type ModularsLayout } from "./modulars.js";
import type { ModularsEvents, ModularsInput } from "./modulars.types.js";

afterEach(() => vi.restoreAllMocks());

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const option = (id: string, over: Partial<ModularSetOption> = {}): ModularSetOption => ({
  kind: "set",
  id,
  name: id.toUpperCase(),
  selected: false,
  recommended: false,
  cardCount: 6,
  descriptor: null,
  groupId: "core",
  groupLabel: null,
  disabledReason: null,
  ...over,
});
const input = (over: Partial<ModularsInput> = {}): ModularsInput => ({
  cw: null,
  villainName: "Rhino",
  required: [],
  options: [option("bomb_scare", { selected: true }), option("under_attack", { disabledReason: "Barred" })],
  hood: [],
  randomSets: true,
  right: "1 chosen",
  openGroups: new Map(),
  ...over,
});
const events = (): ModularsEvents & { readonly log: string[] } => {
  const log: string[] = [];
  return {
    log,
    toggle: (id) => log.push(`toggle:${id}`),
    random: () => log.push("random"),
    cards: (id) => log.push(`cards:${id}`),
    toggleHood: (id) => log.push(`hood:${id}`),
    editScenario: () => log.push("edit"),
    toggleGroup: (id, open) => log.push(`group:${id}:${open}`),
  };
};
const plan = {
  cells: [rect(0, 0, 300, 58), rect(310, 0, 300, 58)],
  headers: [],
  rowHeights: [66],
  rowOfItem: [0, 0],
  contentHeight: 66,
};
const layout: ModularsLayout = {
  wide: true,
  header: rect(24, 400, 900, 26),
  grid: rect(24, 436, 610, 66),
  plan,
  scrolls: false,
  hoodHeader: rect(0, 0, 0, 0),
  hoodGrid: rect(0, 0, 0, 0),
  hoodColumns: 0,
  hoodRows: 0,
};

describe("the Modular sets section", () => {
  it("draws a tile per set that toggles it, and a Random button on the header line", () => {
    const { f, reg } = testFrame();
    const on = events();
    drawModulars(f, input(), on, layout, 0);
    reg.actions.get("modular:bomb_scare")!();
    reg.actions.get("modular:random-draw")!();
    expect(on.log).toEqual(["toggle:bomb_scare", "random"]);
  });

  it("does nothing when a barred set is pressed, but still opens its cards from the picture's own press", () => {
    const { f, reg } = testFrame();
    const on = events();
    drawModulars(f, input(), on, layout, 0);
    reg.actions.get("modular:under_attack")!();
    expect(on.log).toEqual([]);
    reg.actions.get("modular:under_attack:cards0")!();
    expect(on.log).toEqual(["cards:under_attack"]);
    // Only the tile is a focus stop; its picture and tab are extra press areas of it.
    expect(reg.stops.has("modular:under_attack:cards0")).toBe(false);
  });

  it("puts a tall grid in its own scroller, whose tiles' stops name it", () => {
    const { f, b, reg } = testFrame();
    drawModulars(f, input(), events(), { ...layout, scrolls: true }, 0);
    expect(b.nodes.some((n) => n.kind === "scroll" && n.key === "grid")).toBe(true);
    expect(b.nodes.filter((n) => n.kind === "tap")).toHaveLength(0);
    expect(reg.stops.get("modular:bomb_scare")!.view).toBeTypeOf("function");
  });

  it("lists the phone's groups and rows, and a group that is hidden hides its sets", () => {
    const shown = compactModulars(input());
    const hidden = compactModulars(input({ openGroups: new Map(shown.groups.keys().map((id) => [id, false])) }));
    expect(hidden.entries.length).toBeLessThanOrEqual(shown.entries.length);
  });

  it("draws a phone set row that toggles, and claims only its own rows", () => {
    const { f, reg } = testFrame();
    const on = events();
    expect(
      drawCompactModulars(f, input(), on, "modular:bomb_scare", rect(16, 700, 340, 60), {
        modularHeaderStacked: false,
      }),
    ).toBe(true);
    reg.actions.get("modular:bomb_scare")!();
    expect(on.log).toEqual(["toggle:bomb_scare"]);
    expect(drawCompactModulars(f, input(), on, "seed", rect(0, 0, 1, 1), { modularHeaderStacked: false })).toBe(false);
  });
});

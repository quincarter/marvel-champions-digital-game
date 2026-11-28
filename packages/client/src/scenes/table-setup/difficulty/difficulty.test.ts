import { afterEach, describe, expect, it, vi } from "vitest";
import { testFrame, nodesOf, tapKeys } from "../shared/test-frame.js";
import { drawCompactDifficulty, drawDifficulty, type DifficultyLayout } from "./difficulty.js";
import type { DifficultyEvents, DifficultyInput } from "./difficulty.types.js";

afterEach(() => vi.restoreAllMocks());

const input = (over: Partial<DifficultyInput> = {}): DifficultyInput => ({
  cards: [
    { id: "standard", name: "Standard", description: "Standard encounter set only." },
    { id: "expert", name: "Expert", description: "Expert set added." },
  ],
  selected: "standard",
  setChoices: [],
  optionRows: [],
  towerDefense: { offered: false, on: false, perHero: 1 },
  ...over,
});

const events = (): DifficultyEvents & { readonly log: string[] } => {
  const log: string[] = [];
  return {
    log,
    pick: (id) => log.push(`pick:${id}`),
    option: (a) => log.push(`option:${a}`),
    setsSheet: () => log.push("sets"),
    toggleTowerDefense: () => log.push("td"),
  };
};

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const layout: DifficultyLayout = {
  wide: true,
  header: rect(24, 80, 600, 26),
  row: rect(24, 116, 600, 76),
  slots: 2,
  setsCard: rect(0, 0, 0, 0),
  setsInline: true,
  optionCards: [],
  towerDefenseRow: rect(24, 200, 600, 56),
};

describe("the Difficulty section", () => {
  it("draws a card per difficulty, each a press and a focus stop that raises pick", () => {
    const { f, b, reg } = testFrame();
    const on = events();
    drawDifficulty(f, input(), on, layout, 0);
    expect(tapKeys(b.nodes)).toEqual(["difficulty:standard", "difficulty:expert"]);
    reg.actions.get("difficulty:expert")!();
    expect(on.log).toEqual(["pick:expert"]);
    expect([...reg.stops.keys()]).toEqual(["difficulty:standard", "difficulty:expert"]);
  });

  it("marks the chosen card with the red border and no other", () => {
    const { f, b } = testFrame();
    drawDifficulty(f, input({ selected: "expert" }), events(), layout, 0);
    const red = nodesOf(b.nodes, "box").filter((n) => n.stroke?.includes("red") && n.strokeWidth === 4);
    expect(red).toHaveLength(1);
  });

  it("offers Tower Defense's toggle only where the layout gives it a row", () => {
    const withTd = testFrame();
    const on = events();
    drawDifficulty(withTd.f, input({ towerDefense: { offered: true, on: false, perHero: 2 } }), on, layout, 0);
    withTd.reg.actions.get("towerDefenseSetupDamage")!();
    expect(on.log).toEqual(["td"]);
    const without = testFrame();
    drawDifficulty(without.f, input(), events(), { ...layout, towerDefenseRow: rect(0, 0, 0, 0) }, 0);
    expect(without.reg.actions.has("towerDefenseSetupDamage")).toBe(false);
  });

  it("draws the phone's segment strip as one press per difficulty and ignores rows that are not its own", () => {
    const { f, reg } = testFrame();
    const on = events();
    expect(drawCompactDifficulty(f, input(), on, "difficulty", rect(16, 40, 340, 44))).toBe(true);
    reg.actions.get("difficulty:standard")!();
    expect(on.log).toEqual(["pick:standard"]);
    expect(drawCompactDifficulty(f, input(), on, "firstPlayer", rect(0, 0, 10, 10))).toBe(false);
    // A phone control sits in the scrolling page: its stop names the page, so the ring hides when it scrolls away.
    expect(reg.stops.get("difficulty:expert")!.view).toBeTypeOf("function");
  });
});

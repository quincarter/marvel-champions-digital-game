import { afterEach, describe, expect, it, vi } from "vitest";
import { testFrame, nodesOf } from "../shared/test-frame.js";
import { drawCompactEncounter, drawEncounter, type EncounterLayout } from "./encounter.js";
import type { EncounterInput } from "./encounter.types.js";

afterEach(() => vi.restoreAllMocks());

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const rows = (n: number, red = false) =>
  Array.from({ length: n }, (_, i) => ({ label: `Row ${i}`, count: i + 1, red }));
const input = (over: Partial<EncounterInput> = {}): EncounterInput => ({
  composition: [...rows(3), { label: "Obligations (shuffled in)", count: 2, red: true }],
  whatsInThere: rows(6),
  nemesis: { sentence: "Nemesis cards stay out.", totalCards: 10 } as never,
  deckSize: 30,
  ...over,
});
const layout: EncounterLayout = {
  header: rect(24, 600, 900, 26),
  composition: rect(24, 640, 290, 200),
  whatsInThere: rect(330, 640, 290, 200),
  nemesis: rect(636, 640, 290, 200),
  budgets: [4, 3, 4],
};
const texts = (b: ReturnType<typeof testFrame>["b"]): string[] => nodesOf(b.nodes, "text").map((n) => n.text);

describe("the encounter deck section", () => {
  it("lists the rows each panel has room for and says how many more there are", () => {
    const { f, b } = testFrame();
    drawEncounter(f, input(), layout, 0);
    expect(texts(b)).toContain("Row 2");
    expect(texts(b)).not.toContain("Row 3");
    expect(texts(b)).toContain("+3 more");
    expect(texts(b)).toContain("10 cards on standby");
  });

  it("draws the obligations row in red and everything else in ink", () => {
    const { f, b } = testFrame();
    drawEncounter(f, input(), layout, 0);
    const label = nodesOf(b.nodes, "text").find((n) => n.text === "Obligations (shuffled in)")!;
    const plain = nodesOf(b.nodes, "text").find((n) => n.text === "Row 0")!;
    expect(label.color).toContain("red");
    expect(plain.color).not.toContain("red");
  });

  it("says the nemesis panel is unused when no nemesis sets apply", () => {
    const { f, b } = testFrame();
    drawEncounter(f, input({ nemesis: null }), layout, 0);
    expect(texts(b)).toContain("Not used for this scenario.");
  });

  it("is read-only: it registers no press", () => {
    const { f, reg } = testFrame();
    drawEncounter(f, input(), layout, 0);
    drawCompactEncounter(f, input(), "encounterPanel", rect(16, 900, 340, 200));
    expect(reg.actions.size).toBe(0);
  });

  it("draws the phone's one panel and claims only its own rows", () => {
    const { f, b } = testFrame();
    expect(drawCompactEncounter(f, input(), "encounterPanel", rect(16, 900, 340, 260))).toBe(true);
    expect(texts(b)).toContain("Row 5");
    expect(drawCompactEncounter(f, input(), "seed", rect(0, 0, 1, 1))).toBe(false);
  });
});

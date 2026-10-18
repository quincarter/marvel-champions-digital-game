/**
 * Rules audit chunk 30 (FFG rulings post-RRG 1.6). Audit proofs only (it.fails flips when fixed).
 *
 * FFG Game Rules Specialist (Alex), September 5, 2024, "Rulings post-RRG 1.6" ruling 11: "A1 of Hela is her Stage 1,
 * and A2 of Hela is her stage 2. A villain's 'stage number' corresponds to the roman or arabic numeral in their top
 * right corner." Muster Courage's X is the villain's stage number (RRG 1.8 "Stage" / card text).
 * The card data gave both faces of each Hela card (21136a A1/A2, 21137a B1/B2) stageNumber 1.
 */
import { MTS_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";

describe("Hela stage numbers (Sep 5, 2024 ruling 11)", () => {
  const hela = MTS_CARDS.find((c) => (c.id as string) === "21136a") as unknown as {
    sides: { side: string; stages: { stageNumber: number; stageLabel?: string }[] }[];
  };
  it("A1 is stage 1", () => {
    expect(hela.sides[0]!.stages[0]!.stageNumber).toBe(1);
  });
  it("A2 is stage 2 (data says 1, so Muster Courage's X reads 1)", () => {
    expect(hela.sides[1]!.stages[0]!.stageNumber).toBe(2);
  });
});

// The ruling names A1/A2, but its rule (the numeral in the top right corner) reads the expert card the same way.
describe("Hela expert stage numbers (Sep 5, 2024 ruling 11)", () => {
  const hela = MTS_CARDS.find((c) => (c.id as string) === "21137a") as unknown as {
    sides: { side: string; stages: { stageNumber: number; stageLabel?: string }[] }[];
  };
  it("B1 is stage 1", () => {
    expect(hela.sides[0]!.stages[0]).toMatchObject({ stageLabel: "B1", stageNumber: 1 });
  });
  it("B2 is stage 2", () => {
    expect(hela.sides[1]!.stages[0]).toMatchObject({ stageLabel: "B2", stageNumber: 2 });
  });
});

import { describe, expect, test } from "vitest";
import { CW_CARDS } from "@mc/content";
import { footerLeftOf } from "./inspect-model.js";

const scheme = CW_CARDS.find((card) => (card.id as string) === "56141a" && card.type === "main_scheme")!;

describe("the Inspect footer of a main scheme that carries many stages", () => {
  test("names only the inspected stage's own pair", () => {
    expect(scheme.collectorNumber.split("/").length).toBe(16);
    expect(footerLeftOf(scheme, { kind: "mainSchemeStage", stageIndex: 0, side: "B" })).toBe("cw · 141A/141B");
    expect(footerLeftOf(scheme, { kind: "mainSchemeStage", stageIndex: 1, side: "B" })).toBe("cw · 142A/142B");
    expect(footerLeftOf(scheme, { kind: "mainSchemeStage", stageIndex: 7, side: "B" })).toBe("cw · 202A/202B");
  });
  test("a card that is not a stage keeps its own number", () => {
    const leader = CW_CARDS.find((card) => card.type === "villain")!;
    expect(footerLeftOf(leader, { kind: "front" })).toBe(`cw · ${leader.collectorNumber}`);
  });
});

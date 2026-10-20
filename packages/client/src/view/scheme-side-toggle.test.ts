import { describe, expect, it } from "vitest";
import { CORE_CARDS, type AnyCard, type MainSchemeCard } from "@mc/content";
import { schemeSideToggle } from "./scheme-side-toggle.js";

const scheme = CORE_CARDS.find((card): card is MainSchemeCard => card.type === "main_scheme")!;
const stageB = { kind: "mainSchemeStage", stageIndex: 0, side: "B" } as const;

describe("schemeSideToggle", () => {
  it("offers the A side on a scheme showing its B side, and names it", () => {
    const toggle = schemeSideToggle(scheme, stageB, false);
    expect(toggle?.label).toBe("Show A side");
    expect(toggle?.face).toEqual(stageB);
  });

  it("shows the A side once flipped, and offers the way back", () => {
    const toggle = schemeSideToggle(scheme, stageB, true);
    expect(toggle?.label).toBe("Show B side");
    expect(toggle?.face).toEqual({ kind: "mainSchemeStage", stageIndex: 0, side: "A" });
  });

  it("flips from an A side the sheet opened on", () => {
    const stageA = { kind: "mainSchemeStage", stageIndex: 0, side: "A" } as const;
    expect(schemeSideToggle(scheme, stageA, false)?.label).toBe("Show B side");
    expect(schemeSideToggle(scheme, stageA, true)?.face).toEqual(stageB);
  });

  it("keeps the stage it was opened on", () => {
    const toggle = schemeSideToggle(scheme, { kind: "mainSchemeStage", stageIndex: 1, side: "B" }, true);
    expect(toggle?.face).toEqual({ kind: "mainSchemeStage", stageIndex: 1, side: "A" });
  });

  it("offers nothing for a card that is not a main scheme stage", () => {
    const other = CORE_CARDS.find((card) => card.type !== "main_scheme")!;
    expect(schemeSideToggle(other, { kind: "front" }, false)).toBeNull();
    expect(schemeSideToggle(scheme, { kind: "front" }, false)).toBeNull();
    expect(schemeSideToggle(undefined, stageB, false)).toBeNull();
  });

  it("offers nothing for a stage whose other face is a separate card", () => {
    const linked = {
      ...scheme,
      stages: scheme.stages.map((stage) => ({ ...stage, otherFaceId: "other" })),
    } as unknown as AnyCard;
    expect(schemeSideToggle(linked, stageB, false)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { CORE_CARDS, type AnyCard, type HeroIdentityCard, type MainSchemeCard } from "@mc/content";
import { POOL_CARDS } from "../content/pool-cards.js";
import { cardSideToggle, printedIdentitySide } from "./card-side-toggle.js";

const scheme = CORE_CARDS.find((card): card is MainSchemeCard => card.type === "main_scheme")!;
const stageB = { kind: "mainSchemeStage", stageIndex: 0, side: "B" } as const;

describe("cardSideToggle on a main scheme", () => {
  it("offers the A side on a scheme showing its B side, and names it", () => {
    const toggle = cardSideToggle(scheme, stageB, 0);
    expect(toggle?.label).toBe("Show A side");
    expect(toggle?.face).toEqual(stageB);
  });

  it("shows the A side once flipped, and offers the way back", () => {
    const toggle = cardSideToggle(scheme, stageB, 1);
    expect(toggle?.label).toBe("Show B side");
    expect(toggle?.face).toEqual({ kind: "mainSchemeStage", stageIndex: 0, side: "A" });
  });

  it("flips from an A side the sheet opened on", () => {
    const stageA = { kind: "mainSchemeStage", stageIndex: 0, side: "A" } as const;
    expect(cardSideToggle(scheme, stageA, 0)?.label).toBe("Show B side");
    expect(cardSideToggle(scheme, stageA, 1)?.face).toEqual(stageB);
  });

  it("keeps the stage it was opened on", () => {
    const toggle = cardSideToggle(scheme, { kind: "mainSchemeStage", stageIndex: 1, side: "B" }, 1);
    expect(toggle?.face).toEqual({ kind: "mainSchemeStage", stageIndex: 1, side: "A" });
  });

  it("offers nothing for a card that is not a main scheme stage", () => {
    const other = CORE_CARDS.find((card) => card.type !== "main_scheme" && card.type !== "hero_identity")!;
    expect(cardSideToggle(other, { kind: "front" }, 0)).toBeNull();
    expect(cardSideToggle(scheme, { kind: "front" }, 0)).toBeNull();
    expect(cardSideToggle(undefined, stageB, 0)).toBeNull();
  });

  it("offers nothing for a stage whose other face is a separate card", () => {
    const linked = {
      ...scheme,
      stages: scheme.stages.map((stage) => ({ ...stage, otherFaceId: "other" })),
    } as unknown as AnyCard;
    expect(cardSideToggle(linked, stageB, 0)).toBeNull();
  });
});

const identity = (id: string): HeroIdentityCard =>
  POOL_CARDS.find((card): card is HeroIdentityCard => card.type === "hero_identity" && card.id === id)!;

/** The faces and labels `presses` presses of the toggle step through, from `face`. */
const walk = (card: AnyCard, face: Parameters<typeof cardSideToggle>[1], presses: number) =>
  Array.from({ length: presses }, (_, step) => cardSideToggle(card, face, step));

describe("cardSideToggle on a hero identity (issue #532)", () => {
  it("steps a two-sided identity between its hero and alter-ego sides", () => {
    const spiderMan = identity("01001a");
    expect(walk(spiderMan, { kind: "hero" }, 3)).toEqual([
      { face: { kind: "hero" }, label: "Show Alter-Ego" },
      { face: { kind: "alterEgo" }, label: "Show Hero" },
      { face: { kind: "hero" }, label: "Show Alter-Ego" },
    ]);
  });

  it("starts from the side the sheet opened on", () => {
    const spiderMan = identity("01001a");
    expect(cardSideToggle(spiderMan, { kind: "alterEgo" }, 0)).toEqual({
      face: { kind: "alterEgo" },
      label: "Show Hero",
    });
    expect(cardSideToggle(spiderMan, { kind: "alterEgo" }, 1)?.face).toEqual({ kind: "hero" });
  });

  it("steps through every extra hero form, naming each hero face", () => {
    const antMan = identity("12001a");
    expect(walk(antMan, { kind: "hero" }, 4)).toEqual([
      { face: { kind: "hero" }, label: "Show Alter-Ego" },
      { face: { kind: "alterEgo" }, label: "Show Giant Ant-Man" },
      { face: { kind: "heroForm", index: 1 }, label: "Show Tiny Ant-Man" },
      { face: { kind: "hero" }, label: "Show Alter-Ego" },
    ]);
  });

  it("starts an in-game identity in an extra form on that form", () => {
    const antMan = identity("12001a");
    expect(cardSideToggle(antMan, { kind: "heroForm", index: 1 }, 1)?.face).toEqual({ kind: "hero" });
  });
});

describe("printedIdentitySide (issue #532)", () => {
  const antMan = identity("12001a");

  it("reads another side as printed once the toggle leaves the side in play", () => {
    expect(printedIdentitySide(antMan, { kind: "hero" }, 1)).toEqual({ kind: "alterEgo" });
    expect(printedIdentitySide(antMan, { kind: "alterEgo" }, 2)).toEqual({ kind: "hero" });
  });

  it("keeps the live sheet on the side in play, including after a wrap", () => {
    expect(printedIdentitySide(antMan, { kind: "hero" }, 0)).toBeNull();
    expect(printedIdentitySide(antMan, { kind: "hero" }, 3)).toBeNull();
    expect(printedIdentitySide(antMan, { kind: "heroForm", index: 1 }, 3)).toBeNull();
  });

  it("keeps the live sheet for a scheme's other side", () => {
    expect(printedIdentitySide(scheme, stageB, 1)).toBeNull();
  });
});

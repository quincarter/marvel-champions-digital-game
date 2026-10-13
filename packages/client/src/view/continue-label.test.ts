import { describe, expect, test } from "vitest";
import { playableScenarioOffer } from "@mc/cards";
import type { SessionConfig } from "../engine/host.js";
import { continueLabelOf, type ContinueLabelNames } from "./continue-label.js";
import { buildSheetLines, blindSheetNamesOf } from "./pause-model.js";

const IRON = "registration-iron-man";
const offer = playableScenarioOffer(IRON);
const stages = offer.mainSchemeStages!;
const recommendedSets = offer.modularSets!.filter((s) => s.recommended).map((s) => s.id);
const stageName = (id: string): string =>
  stages.stages.flatMap((s) => s.options).find((o) => o.printedCardId === id)!.name;
const otherStage1 = stages.stages[0]!.options.find((o) => o.printedCardId !== stages.recommended[0])!;

const NAMES: ContinueLabelNames = {
  scenarioName: (id) => (id === "rhino" ? "Rhino" : undefined),
  identityName: () => undefined,
  starterDeckName: (id) => (id === "hulkling-protection" ? "Hulkling — Protection" : undefined),
};
const config = (extra: Partial<SessionConfig>): SessionConfig => ({
  scenarioId: IRON,
  difficulty: "standard",
  players: [{ starterDeckId: "hulkling-protection" }],
  seed: 1,
  ...extra,
});

describe("the Title's Continue row", () => {
  test("a ready-made leader reads plainly", () => {
    expect(continueLabelOf({ config: config({}), round: 2 }, NAMES)).toBe(
      "Continue — Civil War: Iron Man · Hulkling · round 2",
    );
  });

  test("a custom build says custom, names both stages and counts the sets", () => {
    const custom = config({
      mainSchemeStageIds: [otherStage1.printedCardId, stages.recommended[1]!],
      modularSetIds: recommendedSets.slice(0, 3),
    });
    expect(continueLabelOf({ config: custom, round: 2 }, NAMES)).toBe(
      `Continue — Custom Civil War: Iron Man, ${otherStage1.name} then ${stageName(stages.recommended[1]!)}, 3 sets · Hulkling · round 2`,
    );
  });

  test('a starter deck named "Hero / Aspect" shows the hero alone', () => {
    expect(
      continueLabelOf(
        { config: config({ players: [{ starterDeckId: "tigra-aggression" }] }), round: 1 },
        { ...NAMES, starterDeckName: () => "Tigra / Aggression" },
      ),
    ).toBe("Continue — Civil War: Iron Man · Tigra · round 1");
  });

  test("another scenario keeps its own name", () => {
    expect(continueLabelOf({ config: config({ scenarioId: "rhino" }), round: 4 }, NAMES)).toBe(
      "Continue — Rhino · Hulkling · round 4",
    );
  });
});

describe("Pause's list of a built game", () => {
  const names = blindSheetNamesOf(offer, new Map(offer.modularSets!.map((s) => [s.id, s.name])));
  test("a custom build lists heading, both stages and the sets by name", () => {
    const sets = recommendedSets.slice(0, 3);
    const lines = buildSheetLines(
      config({ mainSchemeStageIds: [otherStage1.printedCardId, stages.recommended[1]!], modularSetIds: sets }),
      names,
    );
    expect(lines).toEqual([
      "Custom Civil War",
      `Stage 1: ${otherStage1.name}`,
      `Stage 2: ${stageName(stages.recommended[1]!)}`,
      "Modular sets:",
      ...sets.map((id) => `· ${offer.modularSets!.find((s) => s.id === id)!.name}`),
    ]);
  });
  test("a leader as printed, a blind game and another scenario list nothing", () => {
    expect(buildSheetLines(config({}), names)).toEqual([]);
    expect(buildSheetLines(config({ blind: true, modularSetIds: recommendedSets.slice(0, 3) }), names)).toEqual([]);
    expect(buildSheetLines(config({ scenarioId: "rhino" }), names)).toEqual([]);
  });
});

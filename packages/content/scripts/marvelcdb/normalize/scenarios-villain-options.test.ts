import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateScenario, validateScenarioVillainOptions } from "../../../src/schema/index.ts";
import type { RawCard } from "../raw-types.ts";
import { FNE_CURATION } from "../curation/fne.ts";
import type { ScenarioCuration } from "../curation/types.ts";
import { normalizePack } from "../normalize.ts";
import { withLocalArt } from "./art.ts";

/**
 * `ScenarioCuration.villainOptionSetCodes` / `villainOptionDetails` normalized to `Scenario.villainOptions`
 * (docs/phase7-wave11-scenarios.md §S1.2), against the real `fne` raw pack and its transcribed encounter records. The
 * scenario is a fixture: the box's six records are a later data task. Every record gets a made-up local image, as in
 * `normalize.test.ts`, because the scans are gitignored.
 */

const rawPack = JSON.parse(readFileSync(new URL("../../../raw/marvelcdb/fne.json", import.meta.url), "utf8")) as {
  cards: RawCard[];
};
const added = FNE_CURATION.addedRecords ?? [];
const allCodes = new Set(
  [...rawPack.cards, ...added.map((a) => a.record)].flatMap((c) => [
    c.code,
    ...(c.linked_card ? [c.linked_card.code] : []),
  ]),
);

const HEIST: ScenarioCuration = {
  id: "art-museum-heist",
  name: "Art Museum Heist",
  villainSetCode: "hammerhead",
  mainSchemeSetCode: "art_museum_heist",
  additionalEncounterSetCodes: ["art_museum_heist"],
  recommendedModularSetCodes: ["cops", "the_owl"],
  standardSetCodes: ["standard"],
  expertSetCodes: ["expert"],
  villainStages: { standard: [1, 2], expert: [2, 3] },
  modularSetCount: 2,
  villainOptionSetCodes: ["hammerhead", "bullseye", "electro", "purple_man", "typhoid_mary"],
  villainOptionDetails: {
    typhoid_mary: { villainStages: { standard: [1, 1], expert: [2, 2] }, victory: "cardAbility" },
  },
  evidence: "fixture: MC60 pp. 5, 8, 17",
};

const normalize = (scenario: ScenarioCuration) =>
  normalizePack(withLocalArt(rawPack.cards, allCodes), {
    ...FNE_CURATION,
    addedRecords: added.map((a) => ({ ...a, record: withLocalArt([a.record], allCodes)[0]! })),
    scenarios: [scenario],
  });

describe("ScenarioCuration.villainOptionSetCodes", () => {
  it("resolves each set to its villain card, the record's stages and victory unless the details say otherwise", () => {
    const out = normalize(HEIST);
    const [s] = out.scenarios;
    expect(s!.villainCardId).toBe("60086");
    expect(s!.encounterSetIds).toEqual(["hammerhead", "art_museum_heist"]);
    expect(s!.villainOptions).toEqual({
      defaultSetId: "hammerhead",
      options: [
        { villainSetId: "hammerhead", villainCardId: "60086", villainStages: { standard: [1, 2], expert: [2, 3] } },
        { villainSetId: "bullseye", villainCardId: "60065", villainStages: { standard: [1, 2], expert: [2, 3] } },
        { villainSetId: "electro", villainCardId: "60076", villainStages: { standard: [1, 2], expert: [2, 3] } },
        { villainSetId: "purple_man", villainCardId: "60097", villainStages: { standard: [1, 2], expert: [2, 3] } },
        {
          villainSetId: "typhoid_mary",
          villainCardId: "60110b",
          villainStages: { standard: [1, 1], expert: [2, 2] },
          victory: "cardAbility",
        },
      ],
    });
    expect(validateScenario(s!).errors).toEqual([]);
    expect(validateScenarioVillainOptions(s!, out.cards, out.encounterSets).errors).toEqual([]);
  });

  it("refuses options that leave out the default, name an unknown set, or detail a set that is not an option", () => {
    const bad = {
      ...HEIST,
      villainOptionSetCodes: ["bullseye", "nobody"],
      villainOptionDetails: { electro: { victory: "cardAbility" as const } },
    };
    expect(() => normalize(bad)).toThrow(/villainOptionSetCodes must include villainSetCode hammerhead/);
    expect(() => normalize(bad)).toThrow(/villainOptionDetails names electro, not an option/);
    expect(() => normalize(bad)).toThrow(/unknown villain option set nobody/);
  });

  it("a record without the field emits none", () => {
    const { villainOptionSetCodes: _codes, villainOptionDetails: _details, ...plain } = HEIST;
    expect(normalize(plain).scenarios[0]!.villainOptions).toBeUndefined();
  });
});

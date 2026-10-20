import { describe, expect, it } from "vitest";
import { SHADOWLAND_CAMPAIGN } from "../../../src/data/shadowland/campaign.ts";
import { SHADOWLAND_CARDS } from "../../../src/data/shadowland/cards.ts";
import { SHADOWLAND_ENCOUNTER_SETS } from "../../../src/data/shadowland/encounterSets.ts";
import { SHADOWLAND_VILLAIN_CHOICE, SHADOWLAND_SCENARIO_RECORDS } from "./shadowland-scenarios.ts";

/**
 * The Shadowland scenario records (docs/phase7-shadowland.md D4) are authored but not yet emitted (no main scheme card is
 * transcribed), so these tests pin them to the data that does exist: every set code and card code they name must resolve.
 */
const setIds = new Set(SHADOWLAND_ENCOUNTER_SETS.map((s) => s.id as string));
const cardIds = new Set(SHADOWLAND_CARDS.map((c) => c.id as string));

describe("shadowland scenario records", () => {
  it("are the three scenarios in insert order", () => {
    expect(SHADOWLAND_SCENARIO_RECORDS.map((s) => s.id)).toEqual([
      "shadows-in-the-night",
      "shadow-labyrinth",
      "heart-of-shadow",
    ]);
  });

  it("name only encounter sets and villain cards that exist", () => {
    for (const s of SHADOWLAND_SCENARIO_RECORDS) {
      for (const code of [
        s.villainSetCode,
        s.mainSchemeSetCode ?? s.villainSetCode,
        ...(s.additionalEncounterSetCodes ?? []),
        ...s.recommendedModularSetCodes,
      ])
        expect(setIds.has(code), `${s.id}: set ${code}`).toBe(true);
      if (s.villainCardCode) expect(cardIds.has(s.villainCardCode), `${s.id}: ${s.villainCardCode}`).toBe(true);
    }
  });

  it("scenario #1 offers the six Dark Protege villains, each a villain of that set, linked cards resolving", () => {
    expect(SHADOWLAND_VILLAIN_CHOICE.map((v) => v.name)).toEqual([
      "Archpriestess",
      "Daredevil",
      "Elektra",
      "Gorgon",
      "Lady Bullseye",
      "White Tiger",
    ]);
    for (const v of SHADOWLAND_VILLAIN_CHOICE) {
      const card = SHADOWLAND_CARDS.find((c) => c.id === v.villainCardCode);
      expect(card?.type, v.name).toBe("villain");
      expect(card?.name, v.name).toBe(v.name);
      for (const code of v.linkedCardCodes) expect(cardIds.has(code), `${v.name}: ${code}`).toBe(true);
    }
    expect(SHADOWLAND_SCENARIO_RECORDS[0]?.villainCardCode).toBe(SHADOWLAND_VILLAIN_CHOICE[0]?.villainCardCode);
  });

  it("recommend no Black Flower inside the campaign's picks other than the standalone Heart of Shadow default", () => {
    const campaignPicks = SHADOWLAND_SCENARIO_RECORDS.slice(0, 2).flatMap((s) => s.recommendedModularSetCodes);
    expect(campaignPicks).not.toContain("black_flower");
  });
});

describe("shadowland campaign record", () => {
  it("runs the three scenarios in order and prohibits Black Flower (insert p. 5)", () => {
    expect(SHADOWLAND_CAMPAIGN.id).toBe("shadowland");
    expect(SHADOWLAND_CAMPAIGN.scenarioIds).toEqual(SHADOWLAND_SCENARIO_RECORDS.map((s) => s.id));
    expect(SHADOWLAND_CAMPAIGN.prohibited?.encounterSetIds).toEqual(["black_flower"]);
    expect(setIds.has("black_flower")).toBe(true);
    expect(SHADOWLAND_CAMPAIGN.packCode).toBe("shadowland");
  });
});

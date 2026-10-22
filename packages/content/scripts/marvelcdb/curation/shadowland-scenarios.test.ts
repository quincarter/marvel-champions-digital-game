import { describe, expect, it } from "vitest";
import { SHADOWLAND_CAMPAIGN } from "../../../src/data/shadowland/campaign.ts";
import { SHADOWLAND_CARDS } from "../../../src/data/shadowland/cards.ts";
import { SHADOWLAND_ENCOUNTER_SETS } from "../../../src/data/shadowland/encounterSets.ts";
import { SHADOWLAND_SCENARIOS } from "../../../src/data/shadowland/scenarios.ts";
import { validateScenario, validateScenarioVillainOptions } from "../../../src/schema/index.ts";
import { SHADOWLAND_VILLAIN_CHOICE, SHADOWLAND_SCENARIO_RECORDS } from "./shadowland-scenarios.ts";

/**
 * The Shadowland scenario records (docs/phase7-shadowland.md D4) and the emitted scenarios they normalize to: every set and
 * card code they name must resolve, the card-keyed Dark Protege choice must match the printed "Linked (...)" lines, and the
 * emitted scenarios must pass the schema validators.
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

  it("offer the six Dark Protege villains, each ONE double-sided villain card with sides A and B, linked cards resolving", () => {
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
      if (card?.type !== "villain") continue;
      expect(card.sides.map((side) => side.side)).toEqual(["A", "B"]);
      expect(card.sides.map((side) => side.stages.map((st) => st.stageNumber))).toEqual([[1], [1]]);
      expect(card.sides.map((side) => side.stages[0]?.hp.perPlayer)).toEqual([15, 18]);
      for (const code of v.linkedCardCodes) expect(cardIds.has(code), `${v.name}: ${code}`).toBe(true);
    }
  });

  it("list, per villain, exactly the cards whose printed Linked line names it (10 linked cards x 3 villains)", () => {
    const linked = SHADOWLAND_CARDS.flatMap((c) => {
      const text = "text" in c && typeof c.text === "object" ? c.text.printed : "";
      const m = /^Linked \(([^)]*)\)/.exec(text);
      return m ? [{ id: c.id as string, names: m[1]!.split(/,\s*(?:or\s+)?|\s+or\s+/) }] : [];
    });
    expect(linked).toHaveLength(10);
    for (const l of linked) expect(l.names, l.id).toHaveLength(3);
    for (const v of SHADOWLAND_VILLAIN_CHOICE)
      expect([...v.linkedCardCodes].sort(), v.name).toEqual(
        linked
          .filter((l) => l.names.includes(v.name))
          .map((l) => l.id)
          .sort(),
      );
  });

  it("scenario #1 puts the chosen Dark Protege villain in play and #2 keeps it set aside, both at random", () => {
    const [one, two, three] = SHADOWLAND_SCENARIOS;
    for (const [s, role] of [
      [one, "inPlay"],
      [two, "setAside"],
    ] as const) {
      expect(s?.villainOptions?.keyedBy, s?.id).toBe("card");
      expect(s?.villainOptions?.selection, s?.id).toBe("random");
      expect(s?.villainOptions?.chosenVillain, s?.id).toBe(role);
      expect(s?.villainOptions?.options.map((o) => o.villainCardId)).toEqual(
        SHADOWLAND_VILLAIN_CHOICE.map((v) => v.villainCardCode),
      );
      // The Dark Protege set is set aside whole: only the chosen villain's linked cards join the deck.
      expect(s?.encounterSetIds as readonly string[], s?.id).not.toContain("dark_protege");
    }
    expect(one?.villainCardId).toBe("65012a");
    expect(two?.villainCardId).toBe("65037");
    expect(three?.villainOptions).toBeUndefined();
  });

  it("encode the villain stages: Krahllak I-II (expert II-III), Shifting Corridors and the Dark Protege cards one stage", () => {
    const [one, two, three] = SHADOWLAND_SCENARIOS;
    expect(three?.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
    const krahllak = SHADOWLAND_CARDS.find((c) => c.id === three?.villainCardId);
    expect(krahllak?.type === "villain" && krahllak.sides[0]?.stages.map((st) => st.stageNumber)).toEqual([1, 2, 3]);
    expect(two?.villainStages).toEqual({ standard: [1, 1], expert: [1, 1] });
    expect(one?.villainStages).toEqual({ standard: [1, 1], expert: [1, 1] });
    const corridors = SHADOWLAND_CARDS.find((c) => c.id === two?.villainCardId);
    expect(corridors?.type === "villain" && corridors.sides).toHaveLength(1);
  });

  it("require the sets each main scheme 1A Contents names, and Ninja Swarm as the modular set", () => {
    const [one, two, three] = SHADOWLAND_SCENARIOS;
    expect(one?.encounterSetIds).toEqual(["shadows_in_the_night"]);
    expect(two?.encounterSetIds).toEqual(["shadow_labyrinth", "deadly_contraptions"]);
    expect(three?.encounterSetIds).toEqual(["heart_of_shadow", "black_flower"]);
    for (const s of SHADOWLAND_SCENARIOS) expect(s.recommendedModularSetIds).toEqual(["ninja_swarm"]);
  });

  it("pass the schema validators, the card-keyed options included", () => {
    for (const s of SHADOWLAND_SCENARIOS) {
      expect(validateScenario(s).errors, s.id).toEqual([]);
      expect(validateScenarioVillainOptions(s, SHADOWLAND_CARDS, SHADOWLAND_ENCOUNTER_SETS).errors, s.id).toEqual([]);
    }
  });

  it("refuse a card-keyed option whose linked card does not name its villain, or a missing default card", () => {
    const [one] = SHADOWLAND_SCENARIOS;
    const choice = one!.villainOptions!;
    const [first, ...rest] = choice.options;
    const wrong = {
      ...first!,
      linkedCardIds: [...first!.linkedCardIds!, first!.linkedCardIds![0] === "65019" ? "65018" : "65019"] as never,
    };
    const bad = { ...one!, villainOptions: { ...choice, options: [wrong, ...rest] } };
    expect(validateScenarioVillainOptions(bad, SHADOWLAND_CARDS, SHADOWLAND_ENCOUNTER_SETS).errors).toHaveLength(1);
    const noDefault = { ...one!, villainOptions: { ...choice, defaultCardId: undefined } };
    expect(validateScenario(noDefault as never).errors.join(" ")).toMatch(/defaultCardId/);
  });

  it("refuse a setAside choice whose scenario villain is the default option's, and a linked card with no Linked line", () => {
    const [, two] = SHADOWLAND_SCENARIOS;
    const choice = two!.villainOptions!;
    const same = { ...two!, villainCardId: choice.defaultCardId! };
    expect(validateScenario(same).errors.join(" ")).toMatch(/must not be the default option's/);
    // Every Dark Protege card is linked, so blank one card's printed text to get a linked card with no Linked line.
    const blanked = SHADOWLAND_CARDS.map((c) =>
      c.id === "65018" && "text" in c ? { ...c, text: { ...c.text, printed: "Attach to your identity." } } : c,
    );
    expect(validateScenarioVillainOptions(two!, blanked, SHADOWLAND_ENCOUNTER_SETS).errors.join(" ")).toMatch(
      /linked card 65018 prints no "Linked/,
    );
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

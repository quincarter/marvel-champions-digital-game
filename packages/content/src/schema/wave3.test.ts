import { describe, expect, it } from "vitest";
import {
  cardId,
  cycleId,
  encounterSetId,
  flat,
  perPlayerOnly,
  scenarioId,
  setCode,
  trait,
  unerrataedText,
  validateCard,
  validateScenario,
} from "./index.js";
import type { EnvironmentCard, KeywordInstance, Scenario, SideSchemeCard, VillainCard, VillainStage } from "./index.js";

/**
 * docs/phase7-wave3.md §1: the schema cycle 2 (The Galaxy's Most Wanted, Star-Lord, Gamora, Drax, Venom, the Kree
 * Fanatic modular set) needs. Fixtures copy the MarvelCDB records' codes and printed values, trimmed to what each rule
 * needs; they are not curated data.
 *
 * Sources: RRG 1.8 "Hit Points" (p. 22), "Villain Defeat" (p. 47), "Flip" (p. 20), "Amplify Icon" (p. 7), "Hinder X"
 * (p. 22), "Uses (X 'Type')" (p. 46), "Per Player Icon" (p. 32); The Galaxy's Most Wanted rulebook (MC16) p. 12 and
 * The Mad Titan's Shadow rulebook (MC21) p. 20, both "Infinite Hit Points".
 */

const CYCLE = cycleId("cycle3");
const text = unerrataedText;

const stage = (fields: Partial<VillainStage> & Pick<VillainStage, "hp" | "atk" | "sch">): VillainStage => ({
  stageNumber: 1,
  text: text(""),
  traits: [],
  keywords: [],
  abilities: [],
  ...fields,
});

/** One mode of a single-stage, double-sided villain: side A (front), side B (the ∞ "Wounded" back). */
const doubleSidedVillain = (
  id: string,
  pack: string,
  set: string,
  name: string,
  front: VillainStage,
  back: VillainStage,
): VillainCard => ({
  id: cardId(id),
  name,
  setCode: setCode(pack),
  cycleId: CYCLE,
  collectorNumber: id.slice(-3),
  quantityInSet: 1,
  unique: true,
  type: "villain",
  encounterSetIds: [encounterSetId(set)],
  sides: [
    { side: "A", name, stages: [front] },
    { side: "B", name, stages: [back] },
  ],
});

describe("§1.1 a villain face printed with infinite hit points (The Collector, Hela)", () => {
  // MarvelCDB 16080a/16080b (stage "A1"/"A2", standard) and 16081a/16081b ("B1"/"B2", expert). The letter is the mode
  // and the digit the face, so each mode is one single-stage VillainCard with two sides (docs/phase7-wave2.md §15.2).
  const collector = (id: string, mode: "A" | "B", frontHp: number, frontAtkSch: number, backAtkSch: number) =>
    doubleSidedVillain(
      id,
      "gmw",
      "escape_the_museum",
      "Collector",
      stage({
        stageLabel: `${mode}1`,
        hp: perPlayerOnly(frontHp),
        atk: frontAtkSch,
        sch: frontAtkSch,
        traits: [trait("ELDER")],
        text: text(
          "[star] Collector gets +X SCH and +X ATK, where X is equal to the main scheme's current stage number.\n" +
            "Forced Interrupt: When Collector would be defeated, remove 3[per_hero] threat from the main scheme and flip this card instead.",
        ),
      }),
      stage({
        stageLabel: `${mode}2`,
        hp: flat(0),
        infiniteHp: true,
        atk: backAtkSch,
        sch: backAtkSch,
        traits: [trait("ELDER"), trait("WOUNDED")],
        text: text(
          "Collector cannot be defeated.\nForced Interrupt: When the round ends, flip this card, then set Collector's hit point dial to his printed hit points.",
        ),
      }),
    );
  const standard = collector("16080", "A", 8, 1, 0);
  const expert = collector("16081", "B", 10, 2, 2);

  it("validates for both modes, with the ∞ face holding 0 hit points", () => {
    expect(validateCard(standard).errors).toEqual([]);
    expect(validateCard(expert).errors).toEqual([]);
  });

  it("refuses a number behind the ∞ flag, and a non-boolean flag", () => {
    const [front, back] = standard.sides;
    const withNumber: VillainCard = {
      ...standard,
      sides: [front, { ...back!, stages: [{ ...back!.stages[0], hp: perPlayerOnly(8) }] }],
    };
    expect(validateCard(withNumber).errors).toEqual([
      "villain side B stage A2 prints infinite hit points, so its hp must be { base: 0, perPlayer: 0 }",
    ]);
    const notBoolean = {
      ...standard,
      sides: [front, { ...back!, stages: [{ ...back!.stages[0], infiniteHp: "yes" }] }],
    } as unknown as VillainCard;
    expect(validateCard(notBoolean).valid).toBe(false);
  });

  it("fits Hela (mts 21136, 21137): Mystic front, ∞ Wounded back, flipped by card text rather than by defeat", () => {
    const hela = (id: string, mode: "A" | "B", frontHp: number, atkSch: number, backAtkSch: number) =>
      doubleSidedVillain(
        id,
        "mts",
        "hela",
        "Hela",
        stage({
          stageLabel: `${mode}1`,
          hp: perPlayerOnly(frontHp),
          atk: atkSch,
          sch: atkSch,
          traits: [trait("ASGARD"), trait("MYSTIC")],
        }),
        stage({
          stageLabel: `${mode}2`,
          hp: flat(0),
          infiniteHp: true,
          atk: backAtkSch,
          sch: backAtkSch,
          traits: [trait("ASGARD"), trait("WOUNDED")],
          text: text(
            "Hela cannot be defeated.\nForced Response: After a side scheme is defeated, flip Hela to her [[Mystic]] side.",
          ),
        }),
      );
    expect(validateCard(hela("21136", "A", 8, 1, 0)).errors).toEqual([]);
    expect(validateCard(hela("21137", "B", 9, 2, 1)).errors).toEqual([]);
  });

  it("an ∞ front face is representable too: the RRG entry is about characters, not back faces", () => {
    const [front, back] = standard.sides;
    const infiniteFront: VillainCard = {
      ...standard,
      sides: [{ ...front, stages: [{ ...back!.stages[0], stageLabel: "A1" }] }, back!],
    };
    expect(validateCard(infiniteFront).errors).toEqual([]);
  });

  it("Escape the Museum names one card per mode, as The Once and Future Kang does", () => {
    // MC16 p. 12: "Villain Deck: Collector (A1). Remove Collector (A1) and add Collector (B1) for expert mode."
    const escape: Scenario = {
      id: scenarioId("escape-the-museum"),
      name: "Escape the Museum",
      packCode: setCode("gmw"),
      villainCardId: cardId("16080"),
      mainSchemeCardId: cardId("16082"),
      encounterSetIds: ["escape_the_museum", "galactic_artifacts", "ship_command"].map(encounterSetId),
      recommendedModularSetIds: [encounterSetId("menagerie_medley")],
      standardEncounterSetIds: [encounterSetId("standard")],
      expertEncounterSetIds: [encounterSetId("expert")],
      villainStages: { standard: [1, 1], expert: [1, 1] },
      expertVillains: { villainCardId: cardId("16081"), setAsideVillainCardIds: [] },
    };
    expect(validateScenario(escape).errors).toEqual([]);
  });
});

describe("§1.2 amplify icons on any card type", () => {
  // Vendetta (16054), Rocket Raccoon's nemesis side scheme: MarvelCDB `scheme_amplify: 1` and no text.
  const vendetta: SideSchemeCard = {
    id: cardId("16054"),
    type: "side_scheme",
    name: "Vendetta",
    setCode: setCode("gmw"),
    cycleId: CYCLE,
    collectorNumber: "54",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("rocket_nemesis")],
    startingThreat: flat(2),
    icons: [],
    boostIcons: 2,
    traits: [],
    keywords: [],
    text: text(""),
    abilities: [],
    amplifyIcons: 1,
  };

  it("validates a positive count and refuses zero, fractions and negatives", () => {
    expect(validateCard(vendetta).errors).toEqual([]);
    for (const bad of [0, 1.5, -1]) {
      expect(validateCard({ ...vendetta, amplifyIcons: bad }).errors).toContain(
        "amplifyIcons must be a positive whole number when present",
      );
    }
  });

  it("a double-sided card carries each face's own count on `CardFlipSide.amplifyIcons`", () => {
    // Side schemes have no flip side in the schema: The Galaxy's Most Wanted's Campaign Challenge faces (16178a/b–16182a/b,
    // "Standard Mode Only" / "Expert Mode Only") are emitted one card per face (docs/phase7-wave3.md §1.2). An
    // environment, which can flip, carries the per-face count.
    const back = { name: "Museum Ship", traits: [], keywords: [], text: text("Vehicle."), abilities: [] };
    const twoFaced: EnvironmentCard = {
      id: cardId("16085"),
      type: "environment",
      name: "Library Labyrinth",
      setCode: setCode("gmw"),
      cycleId: CYCLE,
      collectorNumber: "85",
      quantityInSet: 1,
      unique: false,
      encounterSetIds: [encounterSetId("escape_the_museum")],
      boostIcons: 0,
      traits: [],
      keywords: [],
      text: text("Location."),
      abilities: [],
      flipSide: { ...back, amplifyIcons: 1 },
    };
    expect(validateCard(twoFaced).errors).toEqual([]);
    const errors = validateCard({ ...twoFaced, flipSide: { ...back, amplifyIcons: 0 } }).errors;
    expect(
      errors.some((error) => error.endsWith("flip side amplifyIcons must be a positive whole number when present")),
    ).toBe(true);
  });
});

describe("§1.3 Hinder X and Uses printed with the per player icon", () => {
  const scheme = (keywords: readonly KeywordInstance[]): SideSchemeCard => ({
    id: cardId("16066"),
    type: "side_scheme",
    name: "Blockade",
    setCode: setCode("gmw"),
    cycleId: CYCLE,
    collectorNumber: "66",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("brotherhood_of_badoon")],
    startingThreat: flat(2),
    icons: [],
    boostIcons: 1,
    traits: [],
    keywords,
    text: text("Hinder 2[per_hero]. (When revealed, place 2[per_hero] threat here.)"),
    abilities: [],
  });

  it("`Hinder 2[per_hero].` is { value: 0, perPlayer: 2 }; `Hinder 4.` stays flat", () => {
    expect(validateCard(scheme([{ name: "hinder", value: 0, perPlayer: 2 }])).errors).toEqual([]);
    expect(validateCard(scheme([{ name: "hinder", value: 4 }])).errors).toEqual([]);
    expect(validateCard(scheme([{ name: "hinder", value: 0, perPlayer: 0 }])).valid).toBe(false);
    expect(validateCard(scheme([{ name: "hinder", value: 0, perPlayer: 1.5 }])).valid).toBe(false);
  });

  it("`Uses (2[per_hero] ammo counters).` may print no flat part; a plain Uses still needs one", () => {
    const uses = (keyword: KeywordInstance) => scheme([keyword]);
    // Crossbones' Machine Gun (04064) and Fanaticism (16110).
    expect(validateCard(uses({ name: "uses", count: 0, countPerPlayer: 2, counterType: "ammo" })).errors).toEqual([]);
    expect(validateCard(uses({ name: "uses", count: 1, countPerPlayer: 1, counterType: "fury" })).errors).toEqual([]);
    expect(validateCard(uses({ name: "uses", count: 3, counterType: "charge" })).errors).toEqual([]);
    expect(validateCard(uses({ name: "uses", count: 0, counterType: "charge" })).valid).toBe(false);
    expect(validateCard(uses({ name: "uses", count: 0, countPerPlayer: 0, counterType: "ammo" })).valid).toBe(false);
  });
});

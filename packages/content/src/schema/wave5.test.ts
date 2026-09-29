import { describe, expect, it } from "vitest";
import {
  cardId,
  cycleId,
  encounterSetId,
  flat,
  scenarioId,
  setCode,
  trait,
  unerrataedText,
  validateCard,
  validateScenario,
} from "./index.js";
import type {
  AttachmentCard,
  EnvironmentCard,
  HeroIdentityCard,
  MainSchemeCard,
  MainSchemeStage,
  Scenario,
  SideSchemeCard,
} from "./index.js";

/**
 * docs/phase7-wave5.md §1: the schema cycle 4 (Sinister Motives, Nova, Ironheart, Spider-Ham, SP//dr) needs. Fixtures
 * copy the MarvelCDB records' codes and printed values, trimmed to what each rule needs; they are not curated data.
 *
 * Sources: RRG 1.8 "Hazard Icon" (p. 21), "Victory X" (p. 46), the p. 67 erratum to MC27 p. 17 and the FAQ (p. 62);
 * the Sinister Motives rulebook (MC27) pp. 15, 17; the Ironheart insert ("New Rules: Progressing Identity Cards");
 * ruling Aug 3, 2026 (4) #2.
 */

const CYCLE = cycleId("cycle5");
const text = unerrataedText;

describe("§1.1 Venom Goblin: lettered main scheme stages whose other face is an environment", () => {
  const manhattan = (stageNumber: number, stageLetter: string, name: string, env: string): MainSchemeStage => ({
    stageNumber,
    stageLetter,
    name,
    startingThreat: flat(1),
    targetThreat: flat(11),
    acceleration: flat(1),
    icons: [],
    text: text("Special: Place 1 threat on each scheme."),
    traits: [],
    keywords: [],
    abilities: [],
    aSide: { text: text(""), abilities: [] },
    otherFaceId: cardId(env),
    onCompletion: "flipToOtherFace",
  });
  const skies: MainSchemeCard = {
    id: cardId("27116a"),
    type: "main_scheme",
    name: "Skies Over New York",
    setCode: setCode("sm"),
    cycleId: CYCLE,
    collectorNumber: "116A",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("venom_goblin")],
    stages: [
      {
        stageNumber: 1,
        stageLetter: "A",
        startingThreat: flat(0),
        targetThreat: flat(0),
        acceleration: flat(0),
        dashedValues: ["startingThreat", "targetThreat", "acceleration"],
        icons: [],
        text: text(""),
        traits: [],
        keywords: [],
        abilities: [],
        aSide: {
          text: text(
            "Setup: Put the Lower Manhattan, Midtown Manhattan, and Upper Manhattan main schemes into play. Place the glider counter on Midtown Manhattan. Flip this card and set it aside.",
          ),
          abilities: [],
        },
        otherFaceId: cardId("27116b"),
      },
      manhattan(2, "B", "Lower Manhattan", "27117b"),
      manhattan(3, "C", "Midtown Manhattan", "27118b"),
      manhattan(4, "D", "Upper Manhattan", "27119b"),
    ],
  };
  const lowerManhattanEnvironment: EnvironmentCard = {
    id: cardId("27117b"),
    type: "environment",
    name: "Lower Manhattan",
    setCode: setCode("sm"),
    cycleId: CYCLE,
    collectorNumber: "117B",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("venom_goblin")],
    boostIcons: 0,
    traits: [trait("LOCATION"), trait("SYMBIOTE")],
    keywords: [],
    text: text("When Revealed: Move the glider counter and each acceleration token from here to the main scheme."),
    abilities: [],
    otherFaceId: cardId("27116a"),
  };

  it("one main scheme card with stages A–D, each naming its environment face", () => {
    expect(validateCard(skies).errors).toEqual([]);
    expect(validateCard(lowerManhattanEnvironment).errors).toEqual([]);
  });

  it("flipping on completion needs a face to flip to, and cannot also lose", () => {
    const [a, b] = skies.stages;
    const { otherFaceId: _dropped, ...noFace } = b!;
    const lost = { ...skies, stages: [a, noFace] } as MainSchemeCard;
    expect(validateCard(lost).errors).toContain("main scheme stage 2B onCompletion flips to an otherFaceId it lacks");
    const both = { ...skies, stages: [a, { ...b!, completionLoses: true }] } as MainSchemeCard;
    expect(validateCard(both).errors).toContain("main scheme stage 2B cannot both flip and lose on completion");
    const odd = { ...skies, stages: [a, { ...b!, onCompletion: "advance" as never }] } as MainSchemeCard;
    expect(validateCard(odd).errors).toContain(
      "main scheme stage 2B onCompletion must be 'flipToOtherFace' when present",
    );
  });
});

describe("§1.2 negative victory points", () => {
  const snitches: AttachmentCard = {
    id: cardId("27181"),
    type: "attachment",
    name: "Snitches Get Stitches",
    setCode: setCode("sm"),
    cycleId: CYCLE,
    collectorNumber: "181",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("snitches_get_stitches")],
    boostIcons: 3,
    traits: [],
    keywords: [{ name: "victory", value: -1 }],
    attachesTo: { kind: "namedCard", name: "Venom" },
    text: text("Victory -1.\nAttach to Venom (Eddie Brock). If you cannot this card gains surge."),
    abilities: [],
  };

  it("'Victory -1.' validates", () => {
    expect(validateCard(snitches).errors).toEqual([]);
  });

  it("a fractional victory value is refused; other numeric keywords stay non-negative", () => {
    const half = { ...snitches, keywords: [{ name: "victory" as const, value: 0.5 }] };
    expect(validateCard(half).errors.some((e) => e.includes("keyword victory needs a whole-number value"))).toBe(true);
    const retaliate = { ...snitches, keywords: [{ name: "retaliate" as const, value: -1 }] };
    expect(validateCard(retaliate).errors.some((e) => e.includes("keyword retaliate needs a numeric value"))).toBe(
      true,
    );
  });
});

describe("§1.3 scheme icons printed on cards that are not schemes", () => {
  const publicOutcry: EnvironmentCard = {
    id: cardId("27174a"),
    type: "environment",
    name: "Public Outcry",
    setCode: setCode("sm"),
    cycleId: CYCLE,
    collectorNumber: "174A",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("bad_publicity")],
    boostIcons: 0,
    traits: [],
    keywords: [{ name: "victory", value: 1 }],
    text: text("Victory 1. Uses (2[per_hero] notoriety counters)."),
    abilities: [],
    modeOnly: "standard",
    schemeIcons: ["acceleration"],
    flipSide: {
      name: "Public Outcry",
      traits: [],
      keywords: [{ name: "victory", value: 1 }],
      text: text("Victory 1. Uses (3 notoriety counters)."),
      abilities: [],
      modeOnly: "expert",
      schemeIcons: ["hazard"],
    },
  };

  it("each face carries its own icons", () => {
    expect(validateCard(publicOutcry).errors).toEqual([]);
  });

  it("unknown icons and empty lists are refused, and a scheme keeps its icons in `icons`", () => {
    const odd = { ...publicOutcry, schemeIcons: ["amplify" as never] };
    expect(validateCard(odd).errors).toContain("schemeIcons may only hold crisis, hazard or acceleration");
    const empty = { ...publicOutcry, schemeIcons: [] };
    expect(validateCard(empty).errors).toContain("schemeIcons is omitted rather than empty");
    const backOdd = { ...publicOutcry, flipSide: { ...publicOutcry.flipSide!, schemeIcons: ["boost" as never] } };
    expect(validateCard(backOdd).errors.some((e) => e.includes("flip side schemeIcons may only hold"))).toBe(true);
    const scheme: SideSchemeCard = {
      id: cardId("27140"),
      type: "side_scheme",
      name: "Limitless Supply",
      setCode: setCode("sm"),
      cycleId: CYCLE,
      collectorNumber: "140",
      quantityInSet: 1,
      unique: false,
      encounterSetIds: [encounterSetId("goblin_gear")],
      startingThreat: flat(5),
      icons: ["hazard"],
      boostIcons: 3,
      traits: [],
      keywords: [],
      text: text("Each Tech attachment gains surge."),
      abilities: [],
      schemeIcons: ["hazard"],
    };
    expect(validateCard(scheme).errors).toContain("a scheme's printed icons are its icons, not schemeIcons");
  });
});

describe("§1.4 progressing identities (Ironheart)", () => {
  const VERSIONS = [cardId("29001a"), cardId("29002a"), cardId("29003a")] as const;
  const ironheart = (id: string, version: number): HeroIdentityCard => ({
    id: cardId(id),
    type: "hero_identity",
    name: "Ironheart",
    setCode: setCode("ironheart"),
    cycleId: CYCLE,
    collectorNumber: `${version}A/${version}B`,
    quantityInSet: 1,
    unique: true,
    hp: 10,
    hero: {
      faceName: "Ironheart",
      atk: 2,
      thw: version,
      def: 3,
      handSize: 3 + version,
      keywords: [],
      traits: [trait("CHAMPION"), trait(`VERSION ${version}`)],
      text: text("Level Up! — Action: Remove 6 progress counters from Ironheart."),
      abilities: [],
    },
    alterEgo: {
      faceName: "Riri Williams",
      rec: 3,
      handSize: 6,
      keywords: [],
      traits: [trait("GENIUS")],
      text: text("Child Prodigy — Action: Spend 1 resource of any type → place 1 progress counter on Riri Williams."),
      abilities: [],
    },
    obligationCardId: cardId("29028"),
    nemesisEncounterSetId: encounterSetId("ironheart_nemesis"),
    progressingIdentity: { versions: VERSIONS },
  });

  it("every version names all versions, weakest first", () => {
    expect(validateCard(ironheart("29001a", 1)).errors).toEqual([]);
    expect(validateCard(ironheart("29003a", 3)).errors).toEqual([]);
  });

  it("the card must be among its versions, listed once, and at least two versions exist", () => {
    const stranger = ironheart("29099a", 1);
    expect(validateCard(stranger).errors).toContain(
      "identity progressingIdentity.versions must include the card itself",
    );
    const repeated = {
      ...ironheart("29001a", 1),
      progressingIdentity: { versions: [VERSIONS[0], VERSIONS[0]] as const },
    };
    expect(validateCard(repeated).errors).toContain("identity progressingIdentity.versions repeats a card");
    const lone = { ...ironheart("29001a", 1), progressingIdentity: { versions: [VERSIONS[0]] as never } };
    expect(validateCard(lone).errors).toContain(
      "identity progressingIdentity.versions must list at least two card ids",
    );
  });
});

describe("§1.5 The Sinister Six: villains that start set aside, and a win by card ability", () => {
  const SIX = ["27094", "27095", "27096", "27097", "27098", "27099"].map((id) => ({
    villainCardId: cardId(id),
    encounterSetIds: [],
  }));
  const sinisterSix: Scenario = {
    id: scenarioId("the-sinister-six"),
    name: "The Sinister Six",
    packCode: setCode("sm"),
    villainCardId: cardId("27094"),
    mainSchemeCardId: cardId("27100a"),
    encounterSetIds: [encounterSetId("sinister_six")],
    recommendedModularSetIds: [encounterSetId("guerrilla_tactics")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    multipleVillains: {
      villains: [SIX[0]!, SIX[1]!, ...SIX.slice(2)],
      encounterDecks: "shared",
      activation: "activeVillainOnly",
      winCondition: "cardAbility",
      atSetup: "setAside",
    },
  };

  it("six villains, all set aside, won only by a card ability", () => {
    expect(validateScenario(sinisterSix).errors).toEqual([]);
  });

  it("an unknown setup placement or win condition is refused", () => {
    const multi = sinisterSix.multipleVillains!;
    const odd = { ...sinisterSix, multipleVillains: { ...multi, atSetup: "inPlay" as never } };
    expect(validateScenario(odd).errors).toContain("scenario multipleVillains.atSetup must be 'setAside' when present");
    const win = { ...sinisterSix, multipleVillains: { ...multi, winCondition: "escape" as never } };
    expect(validateScenario(win).errors).toContain(
      "scenario multipleVillains.winCondition must be 'allVillainsDefeated' or 'cardAbility'",
    );
  });
});

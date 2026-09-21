import { describe, expect, it } from "vitest";
import {
  abilityId,
  cardId,
  cycleId,
  encounterSetId,
  flat,
  heroAspect,
  perPlayerOnly,
  scenarioId,
  setCode,
  trait,
  unerrataedText,
  validateAttachmentHost,
  validateCard,
  validateScenario,
} from "./index.js";
import type {
  AllyCard,
  AttachmentCard,
  AttachmentHost,
  EventCard,
  HeroIdentityCard,
  MainSchemeCard,
  MainSchemeStage,
  Scenario,
  UpgradeCard,
  VillainCard,
} from "./index.js";

/**
 * Phase 7 wave 2 (cycle 1) schema (docs/phase7-wave2.md §1). Fixtures copy the shape of real cycle 1 records
 * (MarvelCDB codes and printed values), trimmed to what each rule needs; they are not the curated data.
 */

const CYCLE = cycleId("wave-2-fixture");
const text = unerrataedText;
const base = (id: string, pack: string, name: string, n: string) => ({
  id: cardId(id),
  name,
  setCode: setCode(pack),
  cycleId: CYCLE,
  collectorNumber: n,
  quantityInSet: 1,
  unique: false,
});

describe("three-sided identities (Ant-Man insert, 'Foldable Cards'; RRG 1.8 'Flip', p. 20)", () => {
  const antMan: HeroIdentityCard = {
    ...base("12001a", "ant", "Ant-Man", "1"),
    type: "hero_identity",
    unique: true,
    hp: 12,
    hero: {
      faceName: "Ant-Man",
      atk: 2,
      thw: 2,
      def: 2,
      handSize: 5,
      keywords: [],
      traits: [trait("Avenger"), trait("Tiny")],
      text: text("Puny Pest — Response: After you change to this form, remove 1 threat from a scheme."),
      abilities: [{ id: abilityId("12001a.puny-pest"), label: "Puny Pest" }],
    },
    alterEgo: {
      faceName: "Scott Lang",
      rec: 3,
      handSize: 6,
      keywords: [],
      traits: [trait("Civilian")],
      text: text("Time to Unwind — Response: After you change to this form, heal 1 damage from Scott Lang."),
      abilities: [{ id: abilityId("12001b.time-to-unwind"), label: "Time to Unwind" }],
    },
    additionalHeroForms: [
      {
        faceName: "Ant-Man",
        atk: 3,
        thw: 1,
        def: 3,
        handSize: 4,
        keywords: [],
        traits: [trait("Avenger"), trait("Giant")],
        text: text("Giant Nuisance — Response: After you change to this form, deal 1 damage to an enemy."),
        abilities: [{ id: abilityId("12001c.giant-nuisance"), label: "Giant Nuisance" }],
      },
    ],
    obligationCardId: cardId("12025"),
    nemesisEncounterSetId: encounterSetId("ant_nemesis"),
  };

  it("validates with a Giant form beside the Tiny hero face and Scott Lang", () => {
    expect(validateCard(antMan).errors).toEqual([]);
  });

  it("rejects an empty list, a malformed form, and an ability id repeated across faces", () => {
    expect(validateCard({ ...antMan, additionalHeroForms: [] }).valid).toBe(false);
    const [giant] = antMan.additionalHeroForms ?? [];
    if (!giant) throw new Error("fixture");
    expect(validateCard({ ...antMan, additionalHeroForms: [{ ...giant, handSize: 0 }] }).valid).toBe(false);
    const clash = { ...giant, abilities: [{ id: abilityId("12001a.puny-pest") }] };
    expect(validateCard({ ...antMan, additionalHeroForms: [clash] }).errors).toContain(
      "identity ability 12001a.puny-pest appears on more than one face; ability ids are unique per card",
    );
  });
});

describe("Spider-Woman's aspect-coloured signature cards (FAQ 'Jessica Drew (#31B)', p. 60)", () => {
  const venomBlast: EventCard = {
    ...base("04035", "trors", "Venom Blast", "35"),
    type: "event",
    quantityInSet: 2,
    aspect: heroAspect(cardId("04031a")),
    printedAspect: "aggression",
    traits: [trait("Attack"), trait("Superpower")],
    keywords: [],
    text: text("Hero Action (attack): Deal 5 damage to an enemy."),
    abilities: [{ id: abilityId("04035.action") }],
    deckLimit: 2,
    cost: 2,
    resourceIcons: { energy: 1 },
  };

  it("an identity-set card may also print an aspect", () => {
    expect(validateCard(venomBlast).errors).toEqual([]);
  });

  it("printedAspect must be a choosable aspect, and only on an identity-specific card", () => {
    expect(validateCard({ ...venomBlast, printedAspect: "basic" }).valid).toBe(false);
    expect(validateCard({ ...venomBlast, aspect: "aggression" }).valid).toBe(false);
  });
});

describe("costs printed as X or a dash (RRG 1.8 'Non-Numerical Variable', p. 30; 'Dash (Value)', p. 15)", () => {
  const speedCyclone: EventCard = {
    ...base("14006", "qsv", "Speed Cyclone", "6"),
    type: "event",
    aspect: heroAspect(cardId("14001a")),
    traits: [trait("Superpower")],
    keywords: [],
    text: text("Hero Action: Stun X Enemies."),
    abilities: [{ id: abilityId("14006.action") }],
    deckLimit: 1,
    cost: 0,
    specialCost: "X",
    resourceIcons: {},
  };

  it("X is held at 0", () => {
    expect(validateCard(speedCyclone).errors).toEqual([]);
    expect(validateCard({ ...speedCyclone, cost: 1 }).valid).toBe(false);
  });
});

describe("allies printed with 0 hit points (Ant-Man 12011, Wasp 13012)", () => {
  const antManAlly: AllyCard = {
    ...base("12011", "ant", "Ant-Man", "11"),
    type: "ally",
    unique: true,
    aspect: "leadership",
    traits: [trait("Avenger")],
    keywords: [],
    text: text("Ant-Man gets +1 hit point for each pym counter on him."),
    abilities: [{ id: abilityId("12011.constant") }, { id: abilityId("12011.interrupt") }],
    deckLimit: 1,
    cost: 0,
    resourceIcons: { energy: 1 },
    atk: 2,
    thw: 2,
    hp: 0,
    consequentialDamage: { attack: 1, thwart: 1 },
  };

  it("validates, and a negative or fractional value does not", () => {
    expect(validateCard(antManAlly).errors).toEqual([]);
    expect(validateCard({ ...antManAlly, hp: -1 }).valid).toBe(false);
    expect(validateCard({ ...antManAlly, hp: 1.5 }).valid).toBe(false);
  });
});

describe("scenario- and campaign-specific player cards (RRG 1.8 'Classifications', p. 12)", () => {
  const moonKnight: AllyCard = {
    ...base("04097", "trors", "Moon Knight", "97"),
    type: "ally",
    unique: true,
    aspect: "none",
    specificTo: { kind: "scenario", encounterSetId: encounterSetId("taskmaster") },
    traits: [trait("Captive"), trait("Hero for Hire")],
    keywords: [],
    text: text("Response: After you play Moon Knight from your hand, spend a [wild] resource → draw 2 cards."),
    abilities: [{ id: abilityId("04097.response") }],
    deckLimit: 1,
    cost: 0,
    resourceIcons: { wild: 1 },
    atk: 2,
    thw: 1,
    hp: 3,
    consequentialDamage: { attack: 1, thwart: 1 },
  };

  it("a Captive ally has no aspect but names its scenario set", () => {
    expect(validateCard(moonKnight).errors).toEqual([]);
    const { specificTo: _dropped, ...unset } = moonKnight;
    expect(validateCard(unset).valid).toBe(false);
  });

  const basicThwart: UpgradeCard = {
    ...base("04159a", "trors", "Basic Thwart Upgrade", "159"),
    type: "upgrade",
    aspect: "basic",
    specificTo: { kind: "campaign", encounterSetId: encounterSetId("hydra_camp") },
    traits: [trait("Condition")],
    keywords: [{ name: "permanent" }, { name: "setup" }],
    text: text("Permanent. Setup. You get +2 hit points. Your hero gets +1 THW."),
    abilities: [{ id: abilityId("04159a.constant") }],
    deckLimit: 1,
    cost: 0,
    specialCost: "dash",
    resourceIcons: {},
    flipSide: {
      name: "Improved Thwart Upgrade",
      traits: [trait("Condition")],
      keywords: [{ name: "permanent" }, { name: "setup" }],
      text: text(
        "Permanent. Setup. You get +2 hit points. Your hero gets +1 THW. Response: After you defeat a side scheme, exhaust this card → draw 1 card.",
      ),
      abilities: [{ id: abilityId("04159b.constant") }, { id: abilityId("04159b.response") }],
    },
  };

  it("a campaign upgrade is Basic, campaign-specific, dash-cost and double-sided", () => {
    expect(validateCard(basicThwart).errors).toEqual([]);
  });

  it("a flip side may not reuse a front ability id; specificTo needs a kind and a set", () => {
    const flip = basicThwart.flipSide;
    if (!flip) throw new Error("fixture");
    expect(
      validateCard({ ...basicThwart, flipSide: { ...flip, abilities: [{ id: abilityId("04159a.constant") }] } }).valid,
    ).toBe(false);
    expect(
      validateCard({ ...basicThwart, specificTo: { kind: "campaign", encounterSetId: encounterSetId("") } }).valid,
    ).toBe(false);
    expect(
      validateCard({
        ...basicThwart,
        specificTo: { kind: "modular" as "campaign", encounterSetId: encounterSetId("x") },
      }).valid,
    ).toBe(false);
  });

  it("'Max 1 per phase.' is a play restriction (Maximum Velocity)", () => {
    const maxVelocity: EventCard = {
      ...base("14005", "qsv", "Maximum Velocity", "5"),
      type: "event",
      aspect: heroAspect(cardId("14001a")),
      traits: [trait("Superpower")],
      keywords: [],
      text: text("Max 1 per phase. Hero Action: You get +2 THW, +2 ATK, and +2 DEF until the end of the round."),
      abilities: [{ id: abilityId("14005.action") }],
      deckLimit: 2,
      cost: 2,
      resourceIcons: { physical: 1 },
      playRestrictions: { maxPerPhase: 1 },
    };
    expect(validateCard(maxVelocity).errors).toEqual([]);
    expect(validateCard({ ...maxVelocity, playRestrictions: { maxPerPhase: 0 } }).valid).toBe(false);
  });
});

describe("'Attach to X, if able. If you cannot, attach to the villain.' (Size Increase, Crossfire's Rifle)", () => {
  const host: AttachmentHost = {
    kind: "ifAble",
    preferred: { kind: "namedCard", name: "Yellowjacket" },
    otherwise: { kind: "villain" },
  };

  it("validates, and checks both halves", () => {
    expect(validateAttachmentHost(host, "attachment")).toEqual([]);
    expect(validateAttachmentHost({ ...host, preferred: { kind: "namedCard", name: "" } }, "attachment")).not.toEqual(
      [],
    );
    expect(validateAttachmentHost({ ...host, otherwise: host }, "attachment")).toContain(
      "attachment ifAble otherwise host cannot itself be ifAble",
    );
  });

  it("on a card", () => {
    const sizeIncrease: AttachmentCard = {
      ...base("12028", "ant", "Size Increase", "28"),
      type: "attachment",
      quantityInSet: 2,
      encounterSetIds: [encounterSetId("ant_nemesis")],
      boostIcons: 0,
      traits: [],
      keywords: [{ name: "uses", count: 3, counterType: "size" }],
      text: text("Attach to Yellowjacket, if able. If you cannot, attach to the villain. Uses (3 size counters)."),
      abilities: [{ id: abilityId("12028.forced-response") }],
      attachesTo: host,
      statModifiers: { atk: 2, sch: 2 },
    };
    expect(validateCard(sizeIncrease).errors).toEqual([]);
  });
});

describe("The Once and Future Kang", () => {
  const kangStage = (id: string, name: string, stageNumber: number, hp: number, perPlayer: boolean): VillainCard => ({
    ...base(id, "toafk", name, id.slice(2)),
    type: "villain",
    unique: true,
    encounterSetIds: [encounterSetId("kang")],
    sides: [
      {
        side: "A",
        name,
        stages: [
          {
            stageNumber,
            hp: perPlayer ? perPlayerOnly(hp) : flat(hp),
            atk: 2,
            sch: 1,
            text: text("Toughness."),
            traits: [trait("Temporal")],
            keywords: [{ name: "toughness" }],
            abilities: [{ id: abilityId(`${id}.when-defeated`) }],
          },
        ],
      },
    ],
  });

  it("each Kang card is its own one-stage villain, the four stage II cards with different titles", () => {
    for (const card of [
      kangStage("11001", "Kang (The Conqueror)", 1, 12, true),
      kangStage("11002", "Kang (Immortus)", 2, 18, false),
      kangStage("11006", "Kang (The Conqueror)", 3, 20, true),
    ]) {
      expect(validateCard(card).errors).toEqual([]);
    }
  });

  const mainStage = (stageNumber: number, extra: Partial<MainSchemeStage> = {}): MainSchemeStage => ({
    stageNumber,
    startingThreat: flat(0),
    targetThreat: perPlayerOnly(9),
    acceleration: flat(1),
    icons: [],
    text: text("Fixture text."),
    traits: [],
    keywords: [],
    abilities: [],
    aSide: { text: text("When Revealed: fixture."), abilities: [] },
    ...extra,
  });
  const kangsArrival: MainSchemeCard = {
    ...base("11007", "toafk", "Kang's Arrival", "7"),
    type: "main_scheme",
    encounterSetIds: [encounterSetId("kang")],
    stages: [
      mainStage(1, { targetThreat: perPlayerOnly(7) }),
      mainStage(2, {
        name: "The Master of Time",
        startingThreat: flat(0),
        targetThreat: flat(0),
        acceleration: flat(0),
        dashedValues: ["startingThreat", "targetThreat", "acceleration"],
      }),
      mainStage(3, { name: "The Chronopolis" }),
      mainStage(3, { name: "Inexorable Fate", startingThreat: flat(1) }),
      mainStage(3, { name: "The Realm of Rama-Tut", startingThreat: flat(1) }),
      mainStage(3, { name: "The Present Future War", startingThreat: flat(2) }),
      mainStage(4, { name: "Kang's Wrath", targetThreat: perPlayerOnly(10) }),
    ],
  };

  it("a main scheme deck with dashed stage 2 values and four alternative stage 3 cards", () => {
    expect(validateCard(kangsArrival).errors).toEqual([]);
  });

  it("alternatives must be told apart, and a dashed value is 0 and not also X", () => {
    const [one, two, three] = kangsArrival.stages;
    if (!one || !two || !three) throw new Error("fixture");
    expect(validateCard({ ...kangsArrival, stages: [one, two, three, three] }).valid).toBe(false);
    expect(validateCard({ ...kangsArrival, stages: [one, { ...two, targetThreat: flat(3) }] }).valid).toBe(false);
    expect(validateCard({ ...kangsArrival, stages: [one, { ...two, printedX: ["acceleration"] }] }).valid).toBe(false);
    expect(
      validateCard({ ...kangsArrival, stages: [one, { ...two, dashedValues: ["boost" as "acceleration"] }] }).valid,
    ).toBe(false);
  });

  const kang: Scenario = {
    id: scenarioId("kang"),
    name: "The Once and Future Kang",
    packCode: setCode("toafk"),
    villainCardId: cardId("11001"),
    mainSchemeCardId: cardId("11007"),
    encounterSetIds: [encounterSetId("kang")],
    recommendedModularSetIds: [encounterSetId("temporal")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    setAsideVillainCardIds: ["11002", "11003", "11004", "11005", "11006"].map(cardId),
    expertVillains: {
      villainCardId: cardId("11034"),
      setAsideVillainCardIds: ["11035", "11036", "11037", "11038", "11039"].map(cardId),
    },
    victory: "cardAbility",
    separateGameAreas: {
      isolation: "areasCannotAffectEachOther",
      centralStageNumber: 2,
      encounterDeck: "shared",
      environments: "inEveryArea",
      eachPlayer: "sameArea",
      uniqueness: "perArea",
      joining: "sideSchemesAndEngagedMinionsMove",
    },
  };

  it("set-aside villains, expert villains, a card-ability victory and separate game areas", () => {
    expect(validateScenario(kang).errors).toEqual([]);
  });

  it("rejects unknown rule values and the starting villain among the set-aside ones", () => {
    const areas = kang.separateGameAreas;
    if (!areas) throw new Error("fixture");
    expect(validateScenario({ ...kang, victory: "allKangs" as "cardAbility" }).valid).toBe(false);
    expect(
      validateScenario({ ...kang, separateGameAreas: { ...areas, eachPlayer: "everyone" as "sameArea" } }).valid,
    ).toBe(false);
    expect(validateScenario({ ...kang, setAsideVillainCardIds: [cardId("11001")] }).valid).toBe(false);
  });
});

describe("scenario separate decks (Red Skull rulebook pp. 5 and 15)", () => {
  const redSkull: Scenario = {
    id: scenarioId("red-skull"),
    name: "Red Skull",
    packCode: setCode("trors"),
    villainCardId: cardId("04125"),
    mainSchemeCardId: cardId("04128"),
    encounterSetIds: [encounterSetId("red_skull")],
    recommendedModularSetIds: [encounterSetId("hydra_assault"), encounterSetId("hydra_patrol")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
    separateDecks: [
      {
        name: "side-scheme",
        contents: { cardType: "side_scheme" },
        discardPile: "own",
        whenEmpty: "reshuffleDiscardWithoutPenalty",
      },
    ],
  };

  it("the side-scheme deck (its own discard, reshuffled without penalty)", () => {
    expect(validateScenario(redSkull).errors).toEqual([]);
  });

  it("the Experimental Weapons deck (encounter discard, stays empty)", () => {
    const crossbones: Scenario = {
      ...redSkull,
      id: scenarioId("crossbones"),
      separateDecks: [
        {
          name: "Experimental Weapons",
          contents: { encounterSetIds: [encounterSetId("exper_weapon")] },
          discardPile: "encounter",
          whenEmpty: "remainsEmpty",
        },
      ],
    };
    expect(validateScenario(crossbones).errors).toEqual([]);
  });

  it("rejects empty contents, a duplicate name, and reshuffling a discard pile it does not own", () => {
    const [deck] = redSkull.separateDecks ?? [];
    if (!deck) throw new Error("fixture");
    expect(validateScenario({ ...redSkull, separateDecks: [{ ...deck, contents: {} }] }).valid).toBe(false);
    expect(validateScenario({ ...redSkull, separateDecks: [deck, deck] }).valid).toBe(false);
    expect(validateScenario({ ...redSkull, separateDecks: [{ ...deck, discardPile: "encounter" }] }).valid).toBe(false);
  });
});

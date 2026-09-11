import { describe, expect, it } from "vitest";
import {
  abilityId,
  artRef,
  cardId,
  cycleId,
  encounterSetId,
  flat,
  heroAspect,
  perPlayerOnly,
  scaling,
  scenarioId,
  setCode,
  starterDeckId,
  trait,
  unerrataedText,
  validateAllyCard,
  validateAttachmentCard,
  validateCard,
  validateScenario,
  validateStarterDeck,
  validateHeroIdentityCard,
  validateMainSchemeCard,
  validateMinionCard,
  validateSideSchemeCard,
  validateTreacheryCard,
  validateUpgradeCard,
  validateVillainCard,
} from "./index.js";
import type {
  AllyCard,
  AttachmentCard,
  EnvironmentCard,
  EventCard,
  HeroIdentityCard,
  MainSchemeCard,
  MinionCard,
  ObligationCard,
  PlayerSideSchemeCard,
  ResourceCard,
  Scenario,
  SideSchemeCard,
  StarterDeck,
  SupportCard,
  TreacheryCard,
  UpgradeCard,
  VillainCard,
} from "./index.js";

const CORE = setCode("core-set");
const CORE_CYCLE = cycleId("core");
const NEXT_EVO = setCode("next-evolution");
const NEXT_EVO_CYCLE = cycleId("next-evolution");
const RED_SKULL = setCode("rise-of-red-skull");
const RED_SKULL_CYCLE = cycleId("rise-of-red-skull");

const spiderManId = cardId("core-01-spider-man");
const RHINO_SET = encounterSetId("rhino");

const spiderMan: HeroIdentityCard = {
  id: spiderManId,
  type: "hero_identity",
  name: "Spider-Man",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "1",
  quantityInSet: 1,
  unique: true,
  hp: 10,
  obligationCardId: cardId("core-14-eviction-notice"),
  nemesisEncounterSetId: encounterSetId("spider-man-nemesis"),
  hero: {
    faceName: "Spider-Man",
    keywords: [],
    traits: [trait("Avenger")],
    atk: 2,
    thw: 1,
    def: 3,
    handSize: 5,
    text: unerrataedText("Spider-Sense — Interrupt: When the villain initiates an attack against you, draw 1 card."),
    abilities: [{ id: abilityId("spider-man-spider-sense") }],
    art: artRef("core/01a-spider-man"),
  },
  alterEgo: {
    faceName: "Peter Parker",
    keywords: [],
    traits: [trait("Genius")],
    rec: 3,
    handSize: 6,
    text: unerrataedText("Scientist — Resource: Generate a [mental] resource. (Limit once per round.)"),
    abilities: [{ id: abilityId("peter-parker-scientist") }],
    art: artRef("core/01b-peter-parker"),
  },
};

const blackCat: AllyCard = {
  id: cardId("core-02-black-cat"),
  type: "ally",
  name: "Black Cat",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "2",
  quantityInSet: 1,
  unique: true,
  aspect: heroAspect(spiderManId),
  deckLimit: 3,
  traits: [trait("Hero for Hire")],
  keywords: [],
  cost: 2,
  resourceIcons: { physical: 1 },
  atk: 1,
  thw: 1,
  hp: 2,
  consequentialDamage: { attack: 1, thwart: 1 },
  text: unerrataedText("Response: After Black Cat enters play, draw 1 card."),
  abilities: [{ id: abilityId("black-cat-response") }],
};

const backflip: EventCard = {
  id: cardId("core-03-backflip"),
  type: "event",
  name: "Backflip",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "3",
  quantityInSet: 3,
  unique: false,
  aspect: heroAspect(spiderManId),
  deckLimit: 3,
  traits: [trait("Defense")],
  keywords: [],
  cost: 0,
  resourceIcons: { energy: 1 },
  text: unerrataedText("Interrupt: When Spider-Man is attacked, prevent all damage from that attack."),
  abilities: [{ id: abilityId("backflip-interrupt") }],
};

const webShooters: UpgradeCard = {
  id: cardId("core-04-web-shooters"),
  type: "upgrade",
  name: "Web-Shooters",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "4",
  quantityInSet: 1,
  unique: false,
  aspect: heroAspect(spiderManId),
  deckLimit: 3,
  traits: [trait("Item"), trait("Tech")],
  keywords: [{ name: "uses", count: 4, counterType: "web" }],
  cost: 1,
  resourceIcons: { energy: 1 },
  text: unerrataedText(
    "Uses (4 web counters). Action: Exhaust Web-Shooters and remove 1 web counter from it → give a hero +1 THW or +1 ATK until the end of the phase.",
  ),
  abilities: [{ id: abilityId("web-shooters-action") }],
};

const helicarrier: SupportCard = {
  id: cardId("core-05-helicarrier"),
  type: "support",
  name: "Helicarrier",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "5",
  quantityInSet: 1,
  unique: false,
  aspect: "basic",
  deckLimit: 3,
  traits: [trait("Location"), trait("S.H.I.E.L.D.")],
  keywords: [],
  cost: 3,
  resourceIcons: { mental: 1 },
  text: unerrataedText("Action: Exhaust Helicarrier → reduce the cost of the next card you play this phase by 1."),
  abilities: [{ id: abilityId("helicarrier-action") }],
};

const strength: ResourceCard = {
  id: cardId("core-06-strength"),
  type: "resource",
  name: "Strength",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "6",
  quantityInSet: 1,
  unique: false,
  aspect: "basic",
  deckLimit: 3,
  traits: [],
  keywords: [],
  producesIcons: { physical: 2 },
  text: unerrataedText("Resource: Generate [physical][physical]."),
  abilities: [],
};

const mutantEducation: PlayerSideSchemeCard = {
  id: cardId("next-evo-07-mutant-education"),
  type: "player_side_scheme",
  name: "Mutant Education",
  setCode: NEXT_EVO,
  cycleId: NEXT_EVO_CYCLE,
  collectorNumber: "7",
  quantityInSet: 1,
  unique: true,
  aspect: "justice",
  deckLimit: 3,
  traits: [trait("X-Men")],
  keywords: [],
  cost: 2,
  resourceIcons: { mental: 1 },
  startingThreat: perPlayerOnly(2),
  text: unerrataedText("When Defeated: Each player draws 1 card."),
  abilities: [{ id: abilityId("mutant-education-when-defeated") }],
};

const rhino: VillainCard = {
  id: cardId("core-08-rhino"),
  type: "villain",
  name: "Rhino",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "8",
  quantityInSet: 1,
  unique: true,
  encounterSetIds: [RHINO_SET],
  sides: [
    {
      side: "A",
      name: "Rhino",
      stages: [
        {
          stageNumber: 1,
          hp: perPlayerOnly(14),
          atk: 2,
          sch: 1,
          text: unerrataedText("Rhino gets +1 ATK while Charge is attached to him."),
          traits: [trait("Brute"), trait("Criminal")],
          keywords: [],
          abilities: [{ id: abilityId("rhino-i-charge-bonus") }],
        },
        {
          stageNumber: 2,
          hp: perPlayerOnly(15),
          atk: 3,
          sch: 1,
          text: unerrataedText("Rhino gets +1 ATK while Charge is attached to him."),
          traits: [trait("Brute"), trait("Criminal")],
          keywords: [],
          abilities: [{ id: abilityId("rhino-ii-charge-bonus") }],
        },
      ],
    },
  ],
};

const theBreakIn: MainSchemeCard = {
  id: cardId("core-09-the-break-in"),
  type: "main_scheme",
  name: "The Break-In!",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "9",
  quantityInSet: 1,
  unique: true,
  encounterSetIds: [RHINO_SET],
  stages: [
    {
      stageNumber: 1,
      startingThreat: flat(0),
      targetThreat: perPlayerOnly(7),
      acceleration: perPlayerOnly(1),
      icons: [],
      text: unerrataedText("Setup: Attach Charge to Rhino. When Completed: Advance to 2A."),
      traits: [],
      keywords: [],
      abilities: [],
      aSide: {
        text: unerrataedText("Setup: Advance to stage 1B."),
        abilities: [{ id: abilityId("01097a.setup"), label: "Setup" }],
      },
    },
    {
      stageNumber: 2,
      stageLetter: "a",
      startingThreat: flat(0),
      targetThreat: perPlayerOnly(7),
      acceleration: perPlayerOnly(1),
      icons: [],
      text: unerrataedText("Forced Response: When this stage completes, the players lose."),
      traits: [],
      keywords: [],
      abilities: [{ id: abilityId("break-in-2a-complete") }],
      aSide: {
        text: unerrataedText("When Revealed: Advance to stage 2B."),
        abilities: [],
      },
    },
  ],
};

const underSiege: TreacheryCard = {
  id: cardId("core-10-under-siege"),
  type: "treachery",
  name: "Under Siege",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "10",
  quantityInSet: 2,
  unique: false,
  encounterSetIds: [RHINO_SET],
  boostIcons: 1,
  traits: [],
  keywords: [{ name: "surge" }],
  text: unerrataedText("Surge. When Revealed: Place 1 threat on each side scheme in play."),
  abilities: [{ id: abilityId("under-siege-when-revealed") }],
};

const hydraMercenary: MinionCard = {
  id: cardId("core-11-hydra-mercenary"),
  type: "minion",
  name: "Hydra Mercenary",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "11",
  quantityInSet: 2,
  unique: false,
  encounterSetIds: [RHINO_SET],
  boostIcons: 2,
  traits: [trait("Hydra"), trait("Mercenary")],
  keywords: [{ name: "guard" }],
  atk: 2,
  sch: 1,
  hp: 3,
  text: unerrataedText("Guard."),
  abilities: [],
};

const breakinAndTakin: SideSchemeCard = {
  id: cardId("core-12-breakin-and-takin"),
  type: "side_scheme",
  name: "Breakin' & Takin'",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "12",
  quantityInSet: 1,
  unique: false,
  encounterSetIds: [RHINO_SET],
  startingThreat: { base: 2, perPlayer: 1 },
  icons: ["crisis"],
  boostIcons: 1,
  traits: [trait("Crime")],
  keywords: [],
  text: unerrataedText("Crisis. When Revealed: Each player must discard 1 card."),
  abilities: [{ id: abilityId("breakin-takin-when-revealed") }],
};

const charge: AttachmentCard = {
  id: cardId("core-13-charge"),
  type: "attachment",
  name: "Charge",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "13",
  quantityInSet: 1,
  unique: false,
  encounterSetIds: [RHINO_SET],
  boostIcons: 0,
  attachesTo: { kind: "villain" },
  statModifiers: { atk: 3 },
  traits: [],
  keywords: [],
  text: unerrataedText("Attach to Rhino. Forced Response: After Rhino attacks, discard Charge."),
  abilities: [{ id: abilityId("charge-forced-response") }],
};

const evictionNotice: ObligationCard = {
  id: cardId("core-14-eviction-notice"),
  type: "obligation",
  name: "Eviction Notice",
  setCode: RED_SKULL,
  cycleId: RED_SKULL_CYCLE,
  collectorNumber: "14",
  quantityInSet: 1,
  unique: false,
  encounterSetIds: [encounterSetId("spider-man-nemesis")],
  boostIcons: 1,
  traits: [],
  keywords: [],
  text: unerrataedText("When Revealed: Spider-Man's player must either flip to alter-ego or discard 2 cards."),
  abilities: [{ id: abilityId("eviction-notice-when-revealed") }],
};

const shieldedBunker: EnvironmentCard = {
  id: cardId("core-15-shielded-bunker"),
  type: "environment",
  name: "Shielded Bunker",
  setCode: CORE,
  cycleId: CORE_CYCLE,
  collectorNumber: "15",
  quantityInSet: 1,
  unique: true,
  encounterSetIds: [RHINO_SET],
  boostIcons: 2,
  traits: [trait("Location")],
  keywords: [],
  text: unerrataedText("Villain minions get +1 HP. Boost: Deal 1 damage to the defending hero."),
  abilities: [
    { id: abilityId("shielded-bunker-passive") },
    { id: abilityId("shielded-bunker-boost") },
  ],
};

describe("schema fixtures: valid cards are accepted", () => {
  it.each([
    ["hero identity (Spider-Man/Peter Parker)", spiderMan],
    ["ally (Black Cat)", blackCat],
    ["event (Backflip)", backflip],
    ["upgrade with Uses (Web-Shooters)", webShooters],
    ["support (Helicarrier)", helicarrier],
    ["resource (Strength)", strength],
    ["player side scheme (Mutant Education)", mutantEducation],
    ["villain (Rhino)", rhino],
    ["main scheme (The Break-In!)", theBreakIn],
    ["treachery with Surge (Under Siege)", underSiege],
    ["minion with Guard (Hydra Mercenary)", hydraMercenary],
    ["side scheme with Crisis (Breakin' & Takin')", breakinAndTakin],
    ["attachment (Charge)", charge],
    ["obligation (Eviction Notice)", evictionNotice],
    ["environment with boost effect (Shielded Bunker)", shieldedBunker],
  ] as const)("%s validates", (_label, card) => {
    const result = validateCard(card);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("schema fixtures: malformed cards are rejected", () => {
  it("rejects an ally with negative cost", () => {
    const result = validateAllyCard({ ...blackCat, cost: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects an upgrade with a Uses keyword count of 0", () => {
    const result = validateUpgradeCard({
      ...webShooters,
      keywords: [{ name: "uses", count: 0, counterType: "web" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a hero identity missing rules text on the alter-ego face", () => {
    const result = validateHeroIdentityCard({
      ...spiderMan,
      alterEgo: { ...spiderMan.alterEgo, text: { printed: "", current: "" } },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a villain whose stages are not in ascending order", () => {
    const [first, second] = rhino.sides[0].stages as [typeof rhino.sides[0]["stages"][0], typeof rhino.sides[0]["stages"][0]];
    const result = validateVillainCard({
      ...rhino,
      sides: [{ side: "A", name: "Rhino", stages: [second, first] }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a main scheme stage with a non-ScalingValue acceleration", () => {
    const malformed = {
      ...theBreakIn,
      stages: [{ ...theBreakIn.stages[0], acceleration: 1 as unknown as ReturnType<typeof flat> }],
    } as MainSchemeCard;
    expect(validateMainSchemeCard(malformed).valid).toBe(false);
  });

  it("rejects a side scheme whose text is not a CardText (blank strings are allowed; see Phase 2 notes)", () => {
    const result = validateSideSchemeCard({ ...breakinAndTakin, text: undefined as unknown as SideSchemeCard["text"] });
    expect(result.valid).toBe(false);
  });

  it("rejects an obligation missing rules text", () => {
    expect(validateCard({ ...evictionNotice, text: { printed: "", current: "" } }).valid).toBe(false);
  });

  it("rejects a treachery with Surge but no abilities referenced", () => {
    expect(validateTreacheryCard({ ...underSiege, abilities: [] }).valid).toBe(false);
  });

  it("rejects an encounter card with more than 3 boost icons", () => {
    expect(validateMinionCard({ ...hydraMercenary, boostIcons: 4 }).valid).toBe(false);
  });
});

describe("Phase 2 schema follow-ups", () => {
  it("scaling(base, perPlayer) builds a ScalingValue", () => {
    expect(scaling(2, 1)).toEqual({ base: 2, perPlayer: 1 });
  });

  it("rejects an ability reference that still carries the dropped trigger field", () => {
    const stale = { ...blackCat, abilities: [{ id: abilityId("x"), trigger: "response" }] } as unknown as AllyCard;
    expect(validateAllyCard(stale).valid).toBe(false);
  });

  it("accepts a printed ability label", () => {
    const labelled: HeroIdentityCard = {
      ...spiderMan,
      hero: { ...spiderMan.hero, abilities: [{ id: abilityId("01001a.spider-sense"), label: "Spider-Sense" }] },
    };
    expect(validateCard(labelled).valid).toBe(true);
  });

  it("puts identity keywords on faces, not on the card", () => {
    const retaliateHeroOnly: HeroIdentityCard = {
      ...spiderMan,
      hero: { ...spiderMan.hero, keywords: [{ name: "retaliate", value: 1 }] },
    };
    expect(validateCard(retaliateHeroOnly).valid).toBe(true);
    const legacy = { ...spiderMan, keywords: [] } as unknown as HeroIdentityCard;
    expect(validateHeroIdentityCard(legacy).valid).toBe(false);
  });

  it("requires an identity's obligation and nemesis links", () => {
    const missing = { ...spiderMan, obligationCardId: "" } as unknown as HeroIdentityCard;
    expect(validateHeroIdentityCard(missing).valid).toBe(false);
  });

  it.each([
    [{ kind: "namedCard", name: "Ultron Drones" }, true],
    [{ kind: "minionWithHighestPrintedHp" }, true],
    [{ kind: "minionWithHighestPrintedHp", withoutAttachmentNamed: "Biomechanical Upgrades" }, true],
    [{ kind: "namedCard" }, false],
    [{ kind: "any_character" }, false],
    ["villain", false],
  ] as const)("attachment host %j valid=%s", (host, valid) => {
    const card = { ...charge, attachesTo: host } as unknown as AttachmentCard;
    expect(validateAttachmentCard(card).valid).toBe(valid);
  });

  it("rejects non-stat keys in attachment statModifiers", () => {
    const card = { ...charge, statModifiers: { def: 1 } } as unknown as AttachmentCard;
    expect(validateAttachmentCard(card).valid).toBe(false);
  });

  it("accepts an upgrade that attaches to a minion with a per-host limit", () => {
    const tracer: UpgradeCard = {
      ...webShooters,
      keywords: [],
      attachesTo: { kind: "minion" },
      playRestrictions: { maxPerHost: 1, form: "hero" },
    };
    expect(validateCard(tracer).valid).toBe(true);
  });

  it("requires a positive integer deckLimit on player cards", () => {
    expect(validateCard({ ...strength, deckLimit: 0 }).valid).toBe(false);
    expect(validateCard({ ...helicarrier, deckLimit: 1 }).valid).toBe(true);
  });

  it("rejects malformed play restrictions", () => {
    const bad = { ...backflip, playRestrictions: { form: "villain" } } as unknown as EventCard;
    expect(validateCard(bad).valid).toBe(false);
  });

  it("requires an A side on every main scheme stage", () => {
    const [first, second] = theBreakIn.stages as unknown as [MainSchemeCard["stages"][0], MainSchemeCard["stages"][0]];
    const { aSide: _dropped, ...noASide } = first;
    const malformed = { ...theBreakIn, stages: [noASide, second] } as unknown as MainSchemeCard;
    expect(validateMainSchemeCard(malformed).valid).toBe(false);
  });

  const rhinoScenario: Scenario = {
    id: scenarioId("rhino"),
    name: "Rhino",
    packCode: CORE,
    villainCardId: rhino.id,
    mainSchemeCardId: theBreakIn.id,
    encounterSetIds: [RHINO_SET],
    recommendedModularSetIds: [encounterSetId("bomb_scare")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  };

  it("validates a scenario with difficulty sets and villain stage ranges", () => {
    expect(validateScenario(rhinoScenario).errors).toEqual([]);
    const inverted = { ...rhinoScenario, villainStages: { standard: [2, 1], expert: [2, 3] } } as unknown as Scenario;
    expect(validateScenario(inverted).valid).toBe(false);
  });

  const spiderManPrecon: StarterDeck = {
    id: starterDeckId("core-spider-man"),
    name: "Spider-Man (Core Set precon)",
    packCode: CORE,
    identityCardId: spiderMan.id,
    aspects: ["justice"],
    cards: [
      { cardId: blackCat.id, quantity: 1 },
      { cardId: backflip.id, quantity: 2 },
    ],
    provenance: { verified: false, sources: [], note: "fixture only" },
  };

  it("validates a starter deck and its provenance", () => {
    expect(validateStarterDeck(spiderManPrecon).errors).toEqual([]);
    const verifiedWithoutSource = { ...spiderManPrecon, provenance: { verified: true, sources: [] } };
    expect(validateStarterDeck(verifiedWithoutSource).valid).toBe(false);
    const duplicate = { ...spiderManPrecon, cards: [...spiderManPrecon.cards, { cardId: blackCat.id, quantity: 1 }] };
    expect(validateStarterDeck(duplicate).valid).toBe(false);
  });
});

describe("printed dashes, X stats, blank text, stage names", () => {
  it("accepts a printed '—' (null) and 'X' stat, rejects other strings", () => {
    expect(validateCard({ ...blackCat, thw: null }).valid).toBe(true);
    expect(validateCard({ ...hydraMercenary, atk: "X" }).valid).toBe(true);
    expect(validateCard({ ...hydraMercenary, atk: "Y" as unknown as number }).valid).toBe(false);
  });

  it("allows blank text on resource cards, villain stages and side schemes only", () => {
    const blank = { printed: "", current: "" };
    expect(validateCard({ ...strength, text: blank }).valid).toBe(true);
    expect(validateCard({ ...breakinAndTakin, text: blank }).valid).toBe(true);
    const [stage1, stage2] = rhino.sides[0].stages as unknown as [VillainCard["sides"][0]["stages"][0], VillainCard["sides"][0]["stages"][0]];
    expect(validateCard({ ...rhino, sides: [{ side: "A", name: "Rhino", stages: [{ ...stage1, text: blank }, stage2] }] }).valid).toBe(true);
    expect(validateCard({ ...blackCat, text: blank }).valid).toBe(false);
    expect(validateCard({ ...underSiege, text: blank }).valid).toBe(false);
  });

  it("accepts an optional main scheme stage name", () => {
    const [first, second] = theBreakIn.stages as unknown as [MainSchemeCard["stages"][0], MainSchemeCard["stages"][0]];
    expect(validateCard({ ...theBreakIn, stages: [first, { ...second, name: "Secret Rendezvous" }] }).valid).toBe(true);
    expect(validateCard({ ...theBreakIn, stages: [first, { ...second, name: " " }] }).valid).toBe(false);
  });
});

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
  setCode,
  trait,
  unerrataedText,
  validateAllyCard,
  validateCard,
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
  SideSchemeCard,
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
  keywords: [],
  hero: {
    faceName: "Spider-Man",
    traits: [trait("Avenger")],
    atk: 2,
    thw: 1,
    def: 3,
    handSize: 5,
    text: unerrataedText("Spider-Sense — Interrupt: When the villain initiates an attack against you, draw 1 card."),
    abilities: [{ id: abilityId("spider-man-spider-sense"), trigger: "interrupt" }],
    art: artRef("core/01a-spider-man"),
  },
  alterEgo: {
    faceName: "Peter Parker",
    traits: [trait("Genius")],
    rec: 3,
    handSize: 6,
    text: unerrataedText("Scientist — Resource: Generate a [mental] resource. (Limit once per round.)"),
    abilities: [{ id: abilityId("peter-parker-scientist"), trigger: "action" }],
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
  traits: [trait("Hero for Hire")],
  keywords: [],
  cost: 2,
  resourceIcons: { physical: 1 },
  atk: 1,
  thw: 1,
  hp: 2,
  consequentialDamage: { attack: 1, thwart: 1 },
  text: unerrataedText("Response: After Black Cat enters play, draw 1 card."),
  abilities: [{ id: abilityId("black-cat-response"), trigger: "response" }],
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
  traits: [trait("Defense")],
  keywords: [],
  cost: 0,
  resourceIcons: { energy: 1 },
  text: unerrataedText("Interrupt: When Spider-Man is attacked, prevent all damage from that attack."),
  abilities: [{ id: abilityId("backflip-interrupt"), trigger: "interrupt" }],
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
  traits: [trait("Item"), trait("Tech")],
  keywords: [{ name: "uses", count: 4, counterType: "web" }],
  cost: 1,
  resourceIcons: { energy: 1 },
  text: unerrataedText(
    "Uses (4 web counters). Action: Exhaust Web-Shooters and remove 1 web counter from it → give a hero +1 THW or +1 ATK until the end of the phase.",
  ),
  abilities: [{ id: abilityId("web-shooters-action"), trigger: "action" }],
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
  traits: [trait("Location"), trait("S.H.I.E.L.D.")],
  keywords: [],
  cost: 3,
  resourceIcons: { mental: 1 },
  text: unerrataedText("Action: Exhaust Helicarrier → reduce the cost of the next card you play this phase by 1."),
  abilities: [{ id: abilityId("helicarrier-action"), trigger: "action" }],
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
  traits: [trait("X-Men")],
  keywords: [],
  cost: 2,
  resourceIcons: { mental: 1 },
  startingThreat: perPlayerOnly(2),
  text: unerrataedText("When Defeated: Each player draws 1 card."),
  abilities: [{ id: abilityId("mutant-education-when-defeated"), trigger: "forced_response" }],
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
          abilities: [{ id: abilityId("rhino-i-charge-bonus"), trigger: "constant" }],
        },
        {
          stageNumber: 2,
          hp: perPlayerOnly(15),
          atk: 3,
          sch: 1,
          text: unerrataedText("Rhino gets +1 ATK while Charge is attached to him."),
          traits: [trait("Brute"), trait("Criminal")],
          keywords: [],
          abilities: [{ id: abilityId("rhino-ii-charge-bonus"), trigger: "constant" }],
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
      keywords: [{ name: "setup" }],
      abilities: [{ id: abilityId("break-in-1a-setup"), trigger: "setup" }],
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
      abilities: [{ id: abilityId("break-in-2a-complete"), trigger: "forced_response" }],
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
  abilities: [{ id: abilityId("under-siege-when-revealed"), trigger: "when_revealed" }],
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
  abilities: [{ id: abilityId("breakin-takin-when-revealed"), trigger: "when_revealed" }],
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
  attachesTo: "villain",
  traits: [],
  keywords: [],
  text: unerrataedText("Attach to Rhino. Forced Response: After Rhino attacks, discard Charge."),
  abilities: [{ id: abilityId("charge-forced-response"), trigger: "forced_response" }],
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
  abilities: [{ id: abilityId("eviction-notice-when-revealed"), trigger: "when_revealed" }],
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
    { id: abilityId("shielded-bunker-passive"), trigger: "constant" },
    { id: abilityId("shielded-bunker-boost"), trigger: "boost_effect" },
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

  it("rejects a side scheme missing rules text", () => {
    const result = validateSideSchemeCard({ ...breakinAndTakin, text: { printed: "", current: "" } });
    expect(result.valid).toBe(false);
  });

  it("rejects a treachery with Surge but no abilities referenced", () => {
    expect(validateTreacheryCard({ ...underSiege, abilities: [] }).valid).toBe(false);
  });

  it("rejects an encounter card with more than 3 boost icons", () => {
    expect(validateMinionCard({ ...hydraMercenary, boostIcons: 4 }).valid).toBe(false);
  });
});

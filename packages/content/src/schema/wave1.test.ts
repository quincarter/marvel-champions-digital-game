import { describe, expect, it } from "vitest";
import {
  abilityId,
  cardId,
  cycleId,
  encounterSetId,
  flat,
  perPlayerOnly,
  scaling,
  scenarioId,
  setCode,
  trait,
  unerrataedText,
  validateAttachmentHost,
  validateCard,
  validateScenario,
} from "./index.js";
import type {
  AttachmentCard,
  AttachmentHost,
  EnvironmentCard,
  EventCard,
  HeroIdentityCard,
  MainSchemeCard,
  MinionCard,
  Scenario,
  SideSchemeCard,
  UpgradeCard,
  VillainCard,
  VillainStage,
} from "./index.js";

/**
 * Phase 7 wave 1 schema (docs/phase7-wave1.md §1). Fixtures copy the shape of real wave 1 records (MarvelCDB codes
 * and printed values), trimmed to what each rule needs; they are not the curated data.
 */

const CYCLE = cycleId("wave-1-fixture");
const text = unerrataedText;

const stage = (
  stageNumber: number,
  hp: number,
  atk: number,
  sch: number,
  extra: Partial<VillainStage> = {},
): VillainStage => ({
  stageNumber,
  hp: perPlayerOnly(hp),
  atk,
  sch,
  text: text("Fixture text."),
  traits: [],
  keywords: [],
  abilities: [],
  ...extra,
});

describe("The Wrecking Crew: villain versions A and B are stages (insert, 'Adjustable Difficulty')", () => {
  const wrecker: VillainCard = {
    id: cardId("07002"),
    type: "villain",
    name: "Wrecker",
    setCode: setCode("twc"),
    cycleId: CYCLE,
    collectorNumber: "2",
    quantityInSet: 1,
    unique: true,
    encounterSetIds: [encounterSetId("wrecker")],
    sides: [
      {
        side: "A",
        name: "Wrecker",
        stages: [
          stage(1, 14, 2, 2, {
            stageLabel: "A",
            traits: [trait("Wrecking Crew")],
            abilities: [{ id: abilityId("07002.scheme-redirect") }],
          }),
          stage(2, 18, 3, 3, {
            stageLabel: "B",
            traits: [trait("Wrecking Crew")],
            abilities: [{ id: abilityId("07003.scheme-redirect") }],
          }),
        ],
      },
    ],
  };

  it("validates with lettered stages positioned 1 and 2", () => {
    expect(validateCard(wrecker).errors).toEqual([]);
  });

  it("rejects labelling only some stages, or a blank label", () => {
    const [a, b] = wrecker.sides[0].stages as unknown as [VillainStage, VillainStage];
    const { stageLabel: _dropped, ...unlabelled } = b;
    expect(validateCard({ ...wrecker, sides: [{ ...wrecker.sides[0], stages: [a, unlabelled] }] }).valid).toBe(false);
    expect(
      validateCard({ ...wrecker, sides: [{ ...wrecker.sides[0], stages: [a, { ...b, stageLabel: " " }] }] }).valid,
    ).toBe(false);
  });

  const day: SideSchemeCard = {
    id: cardId("07004"),
    type: "side_scheme",
    name: "Day of Reckoning",
    setCode: setCode("twc"),
    cycleId: CYCLE,
    collectorNumber: "4",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("wrecker")],
    startingThreat: flat(6),
    icons: [],
    boostIcons: 0,
    traits: [],
    keywords: [],
    text: text("Wrecker's Side Scheme. This card cannot leave play while Wrecker is in play."),
    abilities: [
      { id: abilityId("07004.cannot-leave-play") },
      { id: abilityId("07004.hard-hitter"), label: "Hard Hitter" },
    ],
    signatureOf: "Wrecker",
  };

  it("a signature side scheme names its villain", () => {
    expect(validateCard(day).errors).toEqual([]);
    expect(validateCard({ ...day, signatureOf: "" }).valid).toBe(false);
  });

  const villain = (id: string, set: string, sideScheme: string) => ({
    villainCardId: cardId(id),
    encounterSetIds: [encounterSetId(set)],
    signatureSideSchemeCardId: cardId(sideScheme),
  });
  const breakout: Scenario = {
    id: scenarioId("wrecking-crew"),
    name: "The Wrecking Crew",
    packCode: setCode("twc"),
    villainCardId: cardId("07002"),
    mainSchemeCardId: cardId("07001a"),
    encounterSetIds: [],
    recommendedModularSetIds: [],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 1], expert: [2, 2] },
    multipleVillains: {
      villains: [
        villain("07002", "wrecker", "07004"),
        villain("07017", "thunderball", "07019"),
        villain("07032", "piledriver", "07034"),
        villain("07046", "bulldozer", "07048"),
      ],
      encounterDecks: "perVillain",
      activation: "activeVillainOnly",
      winCondition: "allVillainsDefeated",
    },
    usesIdentityEncounterSets: false,
    modularSetCount: 0,
  };

  it("a scenario with four villains, each with its own encounter deck, and no obligations, nemesis or modular sets", () => {
    expect(validateScenario(breakout).errors).toEqual([]);
  });

  it("rejects a villain list that does not start with villainCardId, has one villain, or repeats one", () => {
    expect(validateScenario({ ...breakout, villainCardId: cardId("07017") }).valid).toBe(false);
    const [first] = breakout.multipleVillains?.villains ?? [];
    const one = {
      ...breakout,
      multipleVillains: { ...breakout.multipleVillains, villains: [first] },
    } as unknown as Scenario;
    expect(validateScenario(one).valid).toBe(false);
    const repeated = {
      ...breakout,
      multipleVillains: { ...breakout.multipleVillains, villains: [first, first] },
    } as unknown as Scenario;
    expect(validateScenario(repeated).valid).toBe(false);
  });

  it("rejects a per-villain deck with no encounter sets, and a negative modular set count", () => {
    const multi = breakout.multipleVillains;
    if (!multi) throw new Error("fixture has multipleVillains");
    const [first, ...rest] = multi.villains;
    const bare = {
      ...breakout,
      multipleVillains: { ...multi, villains: [{ ...first, encounterSetIds: [] }, ...rest] },
    } as unknown as Scenario;
    expect(validateScenario(bare).valid).toBe(false);
    expect(validateScenario({ ...breakout, modularSetCount: -1 }).valid).toBe(false);
  });
});

describe("Risky Business: a villain deck of double-sided stage cards (Green Goblin insert, 'New Rules')", () => {
  const normanAndGoblin: VillainCard = {
    id: cardId("02001a"),
    type: "villain",
    name: "Norman Osborn",
    setCode: setCode("gob"),
    cycleId: CYCLE,
    collectorNumber: "1",
    quantityInSet: 1,
    unique: true,
    encounterSetIds: [encounterSetId("risky_business")],
    startingSide: "A",
    sides: [
      {
        side: "A",
        name: "Norman Osborn",
        stages: [
          stage(1, 14, 0, 2, { dashedStats: ["atk"], traits: [trait("Businessman"), trait("Genius")] }),
          stage(2, 18, 0, 2, { dashedStats: ["atk"] }),
          stage(3, 22, 0, 3, { dashedStats: ["atk"] }),
        ],
      },
      {
        side: "B",
        name: "Green Goblin",
        stages: [
          stage(1, 14, 3, 0, { dashedStats: ["sch"], traits: [trait("Goblin")] }),
          stage(2, 18, 4, 0, { dashedStats: ["sch"] }),
          stage(3, 22, 4, 0, { dashedStats: ["sch"] }),
        ],
      },
    ],
  };
  const [normanSide, goblinSide] = normanAndGoblin.sides as unknown as [
    VillainCard["sides"][0],
    VillainCard["sides"][0],
  ];

  it("validates: two faces with matching stage numbers, Norman up at setup, printed dashes", () => {
    expect(validateCard(normanAndGoblin).errors).toEqual([]);
  });

  it("rejects faces whose stage numbers differ (they are the two sides of the same cards)", () => {
    const [one, two] = goblinSide.stages as unknown as [VillainStage, VillainStage];
    expect(validateCard({ ...normanAndGoblin, sides: [normanSide, { ...goblinSide, stages: [one, two] }] }).valid).toBe(
      false,
    );
  });

  it("rejects a dash on a stat with a value, a dash on a stat villains do not print, and a third side", () => {
    const [one, ...rest] = normanSide.stages as unknown as [VillainStage, ...VillainStage[]];
    expect(
      validateCard({
        ...normanAndGoblin,
        sides: [{ ...normanSide, stages: [{ ...one, atk: 2 }, ...rest] }, goblinSide],
      }).valid,
    ).toBe(false);
    const thw = { ...one, dashedStats: ["thw"] } as unknown as VillainStage;
    expect(
      validateCard({ ...normanAndGoblin, sides: [{ ...normanSide, stages: [thw, ...rest] }, goblinSide] }).valid,
    ).toBe(false);
    const three = {
      ...normanAndGoblin,
      sides: [normanSide, goblinSide, { ...goblinSide, side: "B" }],
    } as unknown as VillainCard;
    expect(validateCard(three).valid).toBe(false);
  });

  it("rejects a starting side the villain does not have", () => {
    expect(validateCard({ ...normanAndGoblin, sides: [normanSide], startingSide: "B" }).valid).toBe(false);
  });

  const criminalEnterprise: EnvironmentCard = {
    id: cardId("02006a"),
    type: "environment",
    name: "Criminal Enterprise",
    setCode: setCode("gob"),
    cycleId: CYCLE,
    collectorNumber: "6",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("risky_business")],
    boostIcons: 0,
    traits: [],
    keywords: [],
    text: text(
      "Criminal Enterprise enter play with 2[per_hero] infamy counters on it. If there are no infamy counters here, flip Norman Osborn and Criminal Enterprise.",
    ),
    abilities: [{ id: abilityId("02006a.enters-with-infamy") }, { id: abilityId("02006a.flip") }],
    flipSide: {
      name: "State of Madness",
      traits: [],
      keywords: [],
      text: text(
        "State of Madness enter play with 2[per_hero] madness counters on it. If there are no madness counters here, flip Green Goblin and State of Madness.",
      ),
      abilities: [{ id: abilityId("02006b.enters-with-madness") }, { id: abilityId("02006b.flip") }],
    },
  };

  it("a double-sided environment carries the face it flips to", () => {
    expect(validateCard(criminalEnterprise).errors).toEqual([]);
  });

  it("rejects a flip side without text, or one reusing a front-face ability id", () => {
    const back = criminalEnterprise.flipSide;
    if (!back) throw new Error("fixture has a flip side");
    expect(
      validateCard({ ...criminalEnterprise, flipSide: { ...back, text: { printed: "", current: "" } } }).valid,
    ).toBe(false);
    expect(
      validateCard({ ...criminalEnterprise, flipSide: { ...back, abilities: [{ id: abilityId("02006a.flip") }] } })
        .valid,
    ).toBe(false);
  });
});

describe("Mutagen Formula: a main scheme value printed as X", () => {
  const mutagenCloud: MainSchemeCard = {
    id: cardId("02017a"),
    type: "main_scheme",
    name: "Unleashing the Mutagen",
    setCode: setCode("gob"),
    cycleId: CYCLE,
    collectorNumber: "17",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("mutagen_formula")],
    stages: [
      {
        stageNumber: 2,
        name: "Mutagen Cloud",
        startingThreat: flat(4),
        targetThreat: perPlayerOnly(11),
        acceleration: flat(0),
        printedX: ["acceleration"],
        icons: [],
        text: text(
          "X is equal to the number of Goblin enemies (including Green Goblin) in play. If this stage is completed, the players lose the game.",
        ),
        traits: [],
        keywords: [],
        abilities: [{ id: abilityId("02018b.x-acceleration") }],
        aSide: { text: text("When Revealed: Advance to stage 2B."), abilities: [] },
      },
    ],
  };

  it("validates an X acceleration held as 0", () => {
    expect(validateCard(mutagenCloud).errors).toEqual([]);
  });

  it("rejects an X field with a value, or a field that is not a threat value", () => {
    const [cloud] = mutagenCloud.stages;
    expect(validateCard({ ...mutagenCloud, stages: [{ ...cloud, acceleration: scaling(0, 1) }] }).valid).toBe(false);
    const bogus = { ...mutagenCloud, stages: [{ ...cloud, printedX: ["boost"] }] } as unknown as MainSchemeCard;
    expect(validateCard(bogus).valid).toBe(false);
  });
});

describe("attachment hosts printed on wave 1 cards", () => {
  it.each([
    [
      "Goblin Glider: the enemy with the highest printed hit points and without another Goblin Glider attached",
      {
        kind: "superlative",
        among: "enemy",
        order: "highest",
        measure: "printedHp",
        withoutAttachmentNamed: "Goblin Glider",
      },
    ],
    ["Pumpkin Bombs: the villain", { kind: "villain" }],
    ["Magic Crowbar: Wrecker, one of several villains", { kind: "namedVillain", name: "Wrecker" }],
    ["Held Hostage: the active villain's side scheme", { kind: "villainSideScheme", of: "activeVillain" }],
    ["All Tied Up / Media Coverage: your identity card", { kind: "yourIdentity" }],
    ["Counterspell: your hero", { kind: "yourIdentity", form: "hero" }],
    ["Honorary Avenger: a friendly character", { kind: "friendlyCharacter" }],
    ["Enraged: an ally", { kind: "ally" }],
    ["Followed: a side scheme", { kind: "sideScheme" }],
    ["Under Surveillance: the main scheme", { kind: "mainScheme" }],
    ["(later packs) a scheme", { kind: "scheme" }],
    ["(later packs) a non-ELITE minion", { kind: "qualified", category: "minion", withoutTrait: trait("Elite") }],
    [
      "(later packs) a Sentinel minion without Stun Beam attached",
      { kind: "qualified", category: "minion", trait: trait("Sentinel"), withoutAttachmentNamed: "Stun Beam" },
    ],
    [
      "(later packs) the minion with the most remaining hit points",
      { kind: "superlative", among: "minion", order: "highest", measure: "remainingHp" },
    ],
  ] as const)("%s", (_label, host) => {
    expect(validateAttachmentHost(host, "attachment")).toEqual([]);
  });

  it.each([
    ["namedVillain without a name", { kind: "namedVillain" }],
    ["villainSideScheme without its villain", { kind: "villainSideScheme" }],
    ["yourIdentity in a form that does not exist", { kind: "yourIdentity", form: "villain" }],
    ["qualified with no qualifier", { kind: "qualified", category: "ally" }],
    ["qualified over an unknown category", { kind: "qualified", category: "support", trait: "Avenger" }],
    [
      "superlative with an unknown measure",
      { kind: "superlative", among: "enemy", order: "highest", measure: "boostIcons" },
    ],
    ["superlative with no order", { kind: "superlative", among: "enemy", measure: "atk" }],
  ])("rejects %s", (_label, host) => {
    expect(validateAttachmentHost(host, "attachment").length).toBeGreaterThan(0);
  });

  it("a whole attachment card with a new host validates (Goblin Glider)", () => {
    const glider: AttachmentCard = {
      id: cardId("02019"),
      type: "attachment",
      name: "Goblin Glider",
      setCode: setCode("gob"),
      cycleId: CYCLE,
      collectorNumber: "19",
      quantityInSet: 1,
      unique: false,
      encounterSetIds: [encounterSetId("mutagen_formula")],
      boostIcons: 3,
      traits: [trait("Vehicle")],
      keywords: [],
      text: text(
        "Attach to the enemy with the highest printed hit points and without another Goblin Glider attached. If you cannot, this card gains surge.",
      ),
      abilities: [{ id: abilityId("02019.surge-if-unattached") }, { id: abilityId("02019.hero-action") }],
      attachesTo: {
        kind: "superlative",
        among: "enemy",
        order: "highest",
        measure: "printedHp",
        withoutAttachmentNamed: "Goblin Glider",
      } satisfies AttachmentHost,
      statModifiers: { atk: 1 },
    };
    expect(validateCard(glider).errors).toEqual([]);
  });
});

describe("nemesis minions are marked (Shadow of the Past reveals 'your set-aside nemesis minion')", () => {
  const zemo: MinionCard = {
    id: cardId("03028"),
    type: "minion",
    name: "Baron Zemo",
    setCode: setCode("cap"),
    cycleId: CYCLE,
    collectorNumber: "28",
    quantityInSet: 1,
    unique: true,
    encounterSetIds: [encounterSetId("captain_america_nemesis")],
    boostIcons: 2,
    traits: [trait("Hydra"), trait("Elite")],
    keywords: [{ name: "quickstrike" }],
    text: text(
      "Quickstrike. While Baron Zemo is engaged with you, you cannot thwart. (Captain America's nemesis minion.)",
    ),
    abilities: [{ id: abilityId("03028.cannot-thwart") }],
    atk: 3,
    sch: 1,
    hp: 5,
    nemesisMinion: true,
  };

  it("validates the marker and rejects a non-boolean", () => {
    expect(validateCard(zemo).errors).toEqual([]);
    expect(validateCard({ ...zemo, nemesisMinion: "yes" } as unknown as MinionCard).valid).toBe(false);
  });
});

describe("play restrictions printed on wave 1 player cards", () => {
  const avengersAssemble: EventCard = {
    id: cardId("03015"),
    type: "event",
    name: "Avengers Assemble!",
    setCode: setCode("cap"),
    cycleId: CYCLE,
    collectorNumber: "15",
    quantityInSet: 3,
    unique: false,
    aspect: "leadership",
    traits: [],
    keywords: [],
    text: text(
      "Max 1 per round. Hero Action: Ready each Avenger character you control. Until the end of the phase, each Avenger character in play gets +1 THW and +1 ATK.",
    ),
    abilities: [{ id: abilityId("03015.hero-action") }],
    deckLimit: 3,
    cost: 4,
    resourceIcons: { energy: 1 },
    playRestrictions: { maxPerRound: 1 },
  };
  const honoraryAvenger: UpgradeCard = {
    id: cardId("03025"),
    type: "upgrade",
    name: "Honorary Avenger",
    setCode: setCode("cap"),
    cycleId: CYCLE,
    collectorNumber: "25",
    quantityInSet: 3,
    unique: false,
    aspect: "basic",
    traits: [trait("Title")],
    keywords: [],
    text: text(
      "Play only if your identity has the Avenger trait. Attach to a friendly character. Max 1 per character. Attached character gets +1 hit point and gains the Avenger trait.",
    ),
    abilities: [{ id: abilityId("03025.constant") }],
    deckLimit: 3,
    cost: 0,
    resourceIcons: { physical: 1 },
    attachesTo: { kind: "friendlyCharacter" },
    playRestrictions: { maxPerHost: 1, requiresIdentityTrait: trait("Avenger") },
  };

  it("Max 1 per round; play only if your identity has a trait; play only if you control a character with a trait", () => {
    expect(validateCard(avengersAssemble).errors).toEqual([]);
    expect(validateCard(honoraryAvenger).errors).toEqual([]);
    const { attachesTo: _host, ...ownIdentityUpgrade } = honoraryAvenger;
    const spycraft: UpgradeCard = {
      ...ownIdentityUpgrade,
      playRestrictions: { requiresControlledCharacterTrait: trait("Spy"), maxPerPlayer: 1 },
    };
    expect(validateCard(spycraft).errors).toEqual([]);
  });

  it("rejects a non-positive per-round maximum and an empty trait", () => {
    expect(validateCard({ ...avengersAssemble, playRestrictions: { maxPerRound: 0 } }).valid).toBe(false);
    expect(validateCard({ ...honoraryAvenger, playRestrictions: { requiresIdentityTrait: trait(" ") } }).valid).toBe(
      false,
    );
  });

  const { playRestrictions: _maxPerRound, ...unrestrictedEvent } = avengersAssemble;
  const crimsonBands: EventCard = {
    ...unrestrictedEvent,
    id: cardId("09032"),
    name: "Crimson Bands of Cyttorak",
    setCode: setCode("drs"),
    collectorNumber: "32",
    quantityInSet: 1,
    aspect: "hero:09001a",
    traits: [trait("Invocation")],
    text: text("Special: Stun an enemy and deal 7 damage to it. Place this card in the Invocation deck discard pile."),
    abilities: [{ id: abilityId("09032.special") }],
    deckLimit: 0,
    cost: 2,
    resourceIcons: {},
    separateDeck: "Invocation",
  };

  it("a separate-deck card (Invocation) has deckLimit 0; any other card needs a positive deck limit", () => {
    const { playRestrictions: _none, ...card } = crimsonBands;
    expect(validateCard(card).errors).toEqual([]);
    expect(validateCard({ ...card, deckLimit: 1 }).valid).toBe(false);
    expect(validateCard({ ...card, separateDeck: "" }).valid).toBe(false);
    const { separateDeck: _dropped, ...ordinary } = card;
    expect(validateCard(ordinary).valid).toBe(false);
  });

  const strange: HeroIdentityCard = {
    id: cardId("09001a"),
    type: "hero_identity",
    name: "Doctor Strange",
    setCode: setCode("drs"),
    cycleId: CYCLE,
    collectorNumber: "1",
    quantityInSet: 1,
    unique: true,
    hp: 10,
    hero: {
      faceName: "Doctor Strange",
      atk: 1,
      thw: 2,
      def: 2,
      handSize: 5,
      keywords: [],
      traits: [trait("Avenger"), trait("Mystic")],
      text: text(
        'Spell Mastery — Action: Exhaust Doctor Strange and pay the cost of the top card of the Invocation deck → resolve the "Special" ability on that card.',
      ),
      abilities: [{ id: abilityId("09001a.spell-mastery"), label: "Spell Mastery" }],
    },
    alterEgo: {
      faceName: "Stephen Strange",
      rec: 3,
      handSize: 6,
      keywords: [],
      traits: [trait("Mystic")],
      text: text(
        "Stephen Strange begins the game with an Invocation deck. (See insert.) Natural Talent — Action: Discard the top card of the Invocation deck. (Limit once per phase.)",
      ),
      abilities: [{ id: abilityId("09001b.natural-talent"), label: "Natural Talent" }],
    },
    obligationCardId: cardId("09027"),
    nemesisEncounterSetId: encounterSetId("doctor_strange_nemesis"),
    separateDecks: [
      {
        name: "Invocation",
        cards: ["09032", "09033", "09034", "09035", "09036"].map((id) => ({ cardId: cardId(id), quantity: 1 })),
        topCardFaceup: true,
        discardPile: "own",
        whenEmpty: "reshuffleDiscardWithoutPenalty",
      },
    ],
  };

  it("an identity lists its separate deck (Doctor Strange insert, 'The Invocation Deck')", () => {
    expect(validateCard(strange).errors).toEqual([]);
  });

  it("rejects a separate deck with a repeated card, no cards, or rules the insert does not state", () => {
    const [deck] = strange.separateDecks ?? [];
    if (!deck) throw new Error("fixture has a separate deck");
    const first = deck.cards[0];
    if (!first) throw new Error("fixture deck has cards");
    expect(validateCard({ ...strange, separateDecks: [{ ...deck, cards: [first, first] }] }).valid).toBe(false);
    expect(validateCard({ ...strange, separateDecks: [{ ...deck, cards: [] }] }).valid).toBe(false);
    const penalty = {
      ...strange,
      separateDecks: [{ ...deck, whenEmpty: "encounterCard" }],
    } as unknown as HeroIdentityCard;
    expect(validateCard(penalty).valid).toBe(false);
    expect(validateCard({ ...strange, separateDecks: [deck, deck] }).valid).toBe(false);
  });
});

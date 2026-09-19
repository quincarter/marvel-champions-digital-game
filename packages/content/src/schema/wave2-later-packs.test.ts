import { describe, expect, it } from "vitest";
import {
  abilityId,
  cardId,
  cycleId,
  encounterSetId,
  flat,
  perPlayerOnly,
  requirementResources,
  scenarioId,
  setCode,
  trait,
  unerrataedText,
  validateAttachmentHost,
  validateCard,
  validateScenarioEncounterSets,
} from "./index.js";
import type {
  AllyCard,
  AttachmentHost,
  EncounterSet,
  EventCard,
  EvidenceCard,
  HeroIdentityCard,
  KeywordInstance,
  Scenario,
  UpgradeCard,
  VillainCard,
  VillainStage,
} from "./index.js";

/**
 * docs/phase7-wave2.md §6: the ten schema needs `docs/phase7-wave2-data.md` §3 found across the packs after cycle 1.
 * Fixtures copy the shape of the real MarvelCDB records (codes and printed values), trimmed to what each rule needs;
 * they are not curated data.
 */

const CYCLE = cycleId("later-packs-fixture");
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
const event = (id: string, pack: string, name: string, keywords: readonly KeywordInstance[]): EventCard => ({
  ...base(id, pack, name, id.slice(-2)),
  type: "event",
  aspect: "aggression",
  traits: [],
  keywords,
  text: text("Hero Action: Deal 4 damage to an enemy."),
  abilities: [{ id: abilityId(`${id}.action`) }],
  deckLimit: 3,
  cost: 2,
  resourceIcons: { physical: 1 },
});

describe("§6.1 Requirement with several icons (RRG 1.8 'Requirement (Resources)', p. 37)", () => {
  it("counts each printed icon: [mental][mental] (R&D Facility 29020) and [energy] [mental] [physical] (Spider-Man 27049)", () => {
    const twoMental: KeywordInstance = { name: "requirement", resources: { mental: 2 } };
    const three: KeywordInstance = { name: "requirement", resources: { energy: 1, mental: 1, physical: 1 } };
    expect(validateCard(event("29020", "ironheart", "R&D Facility", [twoMental])).errors).toEqual([]);
    expect(validateCard(event("27049", "sm", "Spider-Man", [three])).errors).toEqual([]);
    expect(requirementResources(twoMental)).toEqual({ mental: 2 });
  });

  it("reads the single-icon spelling as one of that icon", () => {
    const one: KeywordInstance = { name: "requirement", icon: "physical" };
    expect(validateCard(event("28013", "nova", "No Quarter", [one])).errors).toEqual([]);
    expect(requirementResources(one)).toEqual({ physical: 1 });
    expect(requirementResources({ name: "guard" })).toEqual({});
  });

  it("refuses both spellings at once, neither, an empty count, a zero count and a wild icon", () => {
    const bad: readonly KeywordInstance[] = [
      { name: "requirement", icon: "mental", resources: { mental: 1 } },
      { name: "requirement" },
      { name: "requirement", resources: {} },
      { name: "requirement", resources: { mental: 0 } },
      { name: "requirement", resources: { wild: 1 } },
    ];
    for (const keyword of bad) expect(validateCard(event("x", "sm", "X", [keyword])).valid).toBe(false);
  });
});

describe("§6.2 Discount X (trait) (the Fear No Evil rulebook, p. 3)", () => {
  it("carries its value and one trait (Know Your Enemy 60023) or an OR of traits (Legal Trouble 60026)", () => {
    const one: KeywordInstance = { name: "discount", value: 1, traits: [trait("Martial Artist")] };
    const either: KeywordInstance = { name: "discount", value: 1, traits: [trait("Attorney"), trait("Police")] };
    expect(validateCard(event("60023", "fne", "Know Your Enemy", [one])).errors).toEqual([]);
    expect(validateCard(event("60026", "fne", "Legal Trouble", [either])).errors).toEqual([]);
  });

  it("refuses a discount with no trait or a non-positive value", () => {
    expect(validateCard(event("x", "fne", "X", [{ name: "discount", value: 1, traits: [] }])).valid).toBe(false);
    expect(validateCard(event("x", "fne", "X", [{ name: "discount", value: 0, traits: [trait("Spy")] }])).valid).toBe(false);
  });
});

const stage = (stageNumber: number, hp: number, atk: number, sch: number, traits: readonly string[], abilities: readonly string[] = []): VillainStage => ({
  stageNumber,
  hp: perPlayerOnly(hp),
  atk,
  sch,
  text: text(abilities.length > 0 ? "Forced Response: After this villain changes to this form, heal 1 damage from him." : ""),
  traits: traits.map(trait),
  keywords: [],
  abilities: abilities.map((id) => ({ id: abilityId(id) })),
});

describe("§6.3 leader cards and competitive-only cards (RRG 1.8 'Leader', p. 26; the Civil War rulebook, pp. 3 and 6)", () => {
  const ironMan: VillainCard = {
    ...base("56059", "cw", "Iron Man", "59"),
    type: "villain",
    unique: true,
    printedType: "leader",
    encounterSetIds: [encounterSetId("iron_man_leader")],
    sides: [
      {
        side: "A",
        name: "Iron Man",
        stages: [stage(1, 12, 1, 1, ["Avenger"]), stage(2, 16, 2, 1, ["Avenger"]), stage(3, 16, 2, 1, ["Avenger"]), stage(4, 20, 3, 1, ["Avenger"])],
      },
    ],
  };

  it("a leader is a villain card with stages I–IV and its printed type recorded", () => {
    expect(validateCard(ironMan).errors).toEqual([]);
    expect(validateCard({ ...ironMan, printedType: "hero" as never }).valid).toBe(false);
  });

  it("'your leader' and 'the enemy leader' are attach hosts; an ifAble can fall back from 'your leader'", () => {
    // Tangled Up (56181): "Attach to your leader. Otherwise, attach to your hero."
    const tangled: AttachmentHost = { kind: "ifAble", preferred: { kind: "leader", of: "yours" }, otherwise: { kind: "yourIdentity", form: "hero" } };
    expect(validateAttachmentHost(tangled, "attachment")).toEqual([]);
    // Neptune's Trident (56161): "Attach to Namor. Otherwise, attach to the enemy leader."
    expect(validateAttachmentHost({ kind: "ifAble", preferred: { kind: "namedCard", name: "Namor" }, otherwise: { kind: "leader", of: "enemy" } }, "attachment")).toEqual([]);
    expect(validateAttachmentHost({ kind: "leader", of: "ally" }, "attachment")).not.toEqual([]);
  });

  it("a leader's basic player cards are competitive-specific, and a competitive-only set is refused by a standalone scenario", () => {
    const futurist: EventCard = {
      ...event("56129", "cw", "The Futurist", []),
      aspect: "basic",
      specificTo: { kind: "competitive", encounterSetId: encounterSetId("iron_man_leader") },
    };
    expect(validateCard(futurist).errors).toEqual([]);
    const sets: readonly EncounterSet[] = [
      { id: encounterSetId("iron_man_leader"), name: "Iron Man", packCodes: [setCode("cw")] },
      { id: encounterSetId("standard_pvp"), name: "Standard PvP", packCodes: [setCode("cw")], competitiveOnly: true },
      { id: encounterSetId("hydra_camp"), name: "Hydra Campaign", packCodes: [setCode("trors")], campaignSpecific: true },
    ];
    const scenario: Scenario = {
      id: scenarioId("registration"),
      name: "Superhero Registration Act",
      packCode: setCode("cw"),
      villainCardId: ironMan.id,
      mainSchemeCardId: cardId("56063"),
      encounterSetIds: [encounterSetId("iron_man_leader")],
      recommendedModularSetIds: [],
      standardEncounterSetIds: [],
      expertEncounterSetIds: [],
      villainStages: { standard: [1, 2], expert: [3, 4] },
    };
    expect(validateScenarioEncounterSets(scenario, sets).errors).toEqual([]);
    const pvp = { ...scenario, standardEncounterSetIds: [encounterSetId("standard_pvp")] };
    expect(validateScenarioEncounterSets(pvp, sets).errors).toEqual(["scenario registration names competitive-only set standard_pvp; competitive mode is not built"]);
    const campaign = { ...scenario, encounterSetIds: [...scenario.encounterSetIds, encounterSetId("hydra_camp")] };
    expect(validateScenarioEncounterSets(campaign, sets).valid).toBe(false);
    expect(validateScenarioEncounterSets({ ...scenario, expertEncounterSetIds: [encounterSetId("nope")] }, sets).valid).toBe(false);
  });
});

describe("§6.4 Agents of S.H.I.E.L.D. evidence cards (the Agents of S.H.I.E.L.D. rulebook, pp. 5–6 and 18)", () => {
  const wiretap: EvidenceCard = {
    ...base("50186", "aos", "Wiretap", "186"),
    type: "evidence",
    evidence: "means",
    encounterSetIds: [encounterSetId("executive_board_evidence")],
    traits: [],
    text: text("Setup: Each player may add 1 secret counter to a Board Member environment to search their collection for a different Justice ally and shuffle it into their deck."),
    abilities: [{ id: abilityId("50186.setup") }],
  };

  it("an evidence card is its own card type: means, motive or opportunity", () => {
    expect(validateCard(wiretap).errors).toEqual([]);
    expect(validateCard({ ...wiretap, evidence: "weapon" as never }).valid).toBe(false);
    expect(validateCard({ ...wiretap, encounterSetIds: [] }).valid).toBe(false);
  });
});

describe("§6.5–§6.8 attach hosts", () => {
  it("'a non-permanent side scheme' is a keyword qualifier (Containment Strategy 42019, The Direct Approach 43020)", () => {
    const host: AttachmentHost = { kind: "qualified", category: "sideScheme", withoutKeyword: "permanent" };
    expect(validateAttachmentHost(host, "upgrade")).toEqual([]);
    expect(validateAttachmentHost({ kind: "qualified", category: "sideScheme", withoutKeyword: "sturdy" as never }, "upgrade")).not.toEqual([]);
  });

  it("an OR of hosts: 'an enemy or scheme' (Acute Tactility 60002), 'Greycrow or Harpoon' inside an ifAble (Favored Weapon 40107)", () => {
    expect(validateAttachmentHost({ kind: "anyOf", hosts: [{ kind: "enemy" }, { kind: "scheme" }] }, "upgrade")).toEqual([]);
    const favored: AttachmentHost = {
      kind: "ifAble",
      preferred: { kind: "anyOf", hosts: [{ kind: "namedCard", name: "Greycrow" }, { kind: "namedCard", name: "Harpoon" }] },
      otherwise: { kind: "superlative", among: "enemy", order: "lowest", measure: "atk", trait: trait("Marauder") },
    };
    expect(validateAttachmentHost(favored, "attachment")).toEqual([]);
    // "an X-FORCE or X-MEN ally" (Advanced Suit 45014).
    const advanced: AttachmentHost = {
      kind: "anyOf",
      hosts: [
        { kind: "qualified", category: "ally", trait: trait("X-Force") },
        { kind: "qualified", category: "ally", trait: trait("X-Men") },
      ],
    };
    expect(validateAttachmentHost(advanced, "upgrade")).toEqual([]);
  });

  it("an anyOf needs two hosts and may not nest ifAble or anyOf", () => {
    expect(validateAttachmentHost({ kind: "anyOf", hosts: [{ kind: "enemy" }] as never }, "upgrade")).not.toEqual([]);
    const nested = { kind: "anyOf", hosts: [{ kind: "enemy" }, { kind: "anyOf", hosts: [{ kind: "ally" }, { kind: "minion" }] }] };
    expect(validateAttachmentHost(nested, "upgrade")).toContain("upgrade anyOf host 2 cannot itself be anyOf");
  });

  it("measures: the highest activation order value (Heightened Morale 27103), the most traits (Cyborg Tech 29031)", () => {
    expect(validateAttachmentHost({ kind: "superlative", among: "villain", order: "highest", measure: "activationOrder" }, "attachment")).toEqual([]);
    expect(validateAttachmentHost({ kind: "superlative", among: "minion", order: "highest", measure: "traitCount" }, "attachment")).toEqual([]);
    expect(validateAttachmentHost({ kind: "superlative", among: "minion", order: "highest", measure: "activationOrder" }, "attachment")).toContain(
      "attachment superlative host measure 'activationOrder' ranks villains only",
    );
  });

  it("'the villain who is not the active villain' (Direct Assault 21105)", () => {
    expect(validateAttachmentHost({ kind: "nonActiveVillain" }, "attachment")).toEqual([]);
  });

  it("a villain's activation order value is a positive whole number (Doctor Octopus 27094: 'Activation Order 1')", () => {
    const doc: VillainCard = {
      ...base("27094", "sm", "Doctor Octopus", "94"),
      type: "villain",
      unique: true,
      activationOrder: 1,
      encounterSetIds: [encounterSetId("sinister_six")],
      sides: [{ side: "A", name: "Doctor Octopus", stages: [stage(1, 8, 2, 2, [])] }],
    };
    expect(validateCard(doc).errors).toEqual([]);
    expect(validateCard({ ...doc, activationOrder: 0 }).valid).toBe(false);
  });
});

describe("§6.9 a three-sided villain (Apocalypse 45184–45186; RRG 1.8 'Flip', p. 20)", () => {
  const faces = (letter: "A" | "B" | "C", form: string) => ({
    side: letter,
    name: "Apocalypse",
    stages: [stage(1, 16, 2, 1, ["Mutant", form], [`45184${letter.toLowerCase()}.form`]), stage(2, 20, 3, 1, ["Mutant", form])] as [VillainStage, VillainStage],
  });
  const apocalypse: VillainCard = {
    ...base("45184a", "aoa", "Apocalypse", "184"),
    type: "villain",
    unique: true,
    encounterSetIds: [encounterSetId("en_sabah_nur")],
    sides: [faces("A", "Biomorph"), faces("B", "Cyberpath"), faces("C", "Giant")],
  };

  it("validates with A, B and C faces listing the same stages", () => {
    expect(validateCard(apocalypse).errors).toEqual([]);
    expect(validateCard({ ...apocalypse, startingSide: "C" }).errors).toEqual([]);
  });

  it("refuses a C face without a B face, a fourth face, and faces with different stages", () => {
    const [a, , c] = apocalypse.sides;
    if (!a || !c) throw new Error("fixture");
    expect(validateCard({ ...apocalypse, sides: [a, c] }).valid).toBe(false);
    expect(validateCard({ ...apocalypse, sides: [...apocalypse.sides, { ...c, side: "D" as never }] }).valid).toBe(false);
    expect(validateCard({ ...apocalypse, sides: [a, apocalypse.sides[1] as never, { ...c, stages: [c.stages[0]] }] }).valid).toBe(false);
  });
});

describe("§6.10 a separated identity (the SP//dr insert, 'New Rule: Separated Identity Card')", () => {
  const spdr: HeroIdentityCard = {
    ...base("31001a", "spdr", "SP//dr", "1"),
    type: "hero_identity",
    unique: true,
    hp: 14,
    hero: {
      faceName: "SP//dr Suit",
      atk: 2,
      thw: 2,
      def: 2,
      handSize: 3,
      keywords: [],
      traits: [trait("Active"), trait("Web-Warrior")],
      text: text("Sync Ratio — Resource: Exhaust an Interface upgrade you control → generate that upgrade's resources."),
      abilities: [{ id: abilityId("31001a.sync-ratio"), label: "Sync Ratio" }],
    },
    alterEgo: {
      faceName: "Peni Parker",
      rec: 4,
      handSize: 6,
      keywords: [],
      traits: [trait("Genius")],
      text: text("Setup: Put the SP//dr Suit into play, Inactive side faceup."),
      abilities: [{ id: abilityId("31002a.setup") }],
    },
    obligationCardId: cardId("31038"),
    nemesisEncounterSetId: encounterSetId("spdr_nemesis"),
    separatedIdentity: {
      alterEgoCardNumber: "2",
      heroCardOtherSide: {
        cardType: "support",
        name: "SP//dr Suit",
        traits: [trait("Inactive"), trait("Tech")],
        keywords: [{ name: "permanent" }],
        text: text("Return to Base — Forced Interrupt: When you flip to this side, flip SP//dr to Peni Parker."),
        abilities: [{ id: abilityId("31001b.return-to-base") }],
      },
      alterEgoCardOtherSide: {
        cardType: "upgrade",
        name: "SP//dr",
        traits: [trait("Pilot")],
        keywords: [],
        text: text("Attached to the SP//dr Suit while in hero form."),
        abilities: [{ id: abilityId("31002b.pilot") }],
      },
    },
  };

  it("validates the two physical cards' other sides as a support and an upgrade", () => {
    expect(validateCard(spdr).errors).toEqual([]);
  });

  it("refuses the wrong card types, a missing collector number, and an ability id shared with a form", () => {
    const separated = spdr.separatedIdentity;
    if (!separated) throw new Error("fixture");
    expect(validateCard({ ...spdr, separatedIdentity: { ...separated, heroCardOtherSide: { ...separated.heroCardOtherSide, cardType: "upgrade" as never } } }).valid).toBe(false);
    expect(validateCard({ ...spdr, separatedIdentity: { ...separated, alterEgoCardNumber: "" } }).valid).toBe(false);
    const clash = { ...separated.alterEgoCardOtherSide, abilities: [{ id: abilityId("31001a.sync-ratio") }] };
    expect(validateCard({ ...spdr, separatedIdentity: { ...separated, alterEgoCardOtherSide: clash } }).errors).toContain(
      "identity separatedIdentity alter-ego card's other side ability 31001a.sync-ratio is also on another face; ability ids are unique per card",
    );
  });
});

describe("existing shapes are unchanged by the pass", () => {
  it("an upgrade with a plain host and an ally with a flat stat still validate", () => {
    const upgrade: UpgradeCard = {
      ...base("u1", "core", "Web-Shooter", "1"),
      type: "upgrade",
      aspect: "basic",
      traits: [],
      keywords: [],
      text: text("Attach to a minion."),
      abilities: [],
      deckLimit: 3,
      cost: 1,
      resourceIcons: {},
      attachesTo: { kind: "minion" },
    };
    const ally: AllyCard = {
      ...base("a1", "core", "Ally", "2"),
      type: "ally",
      aspect: "basic",
      traits: [],
      keywords: [],
      text: text("x"),
      abilities: [],
      deckLimit: 3,
      cost: 2,
      resourceIcons: {},
      atk: 1,
      thw: 1,
      hp: 3,
      consequentialDamage: { attack: 1, thwart: 1 },
    };
    expect(validateCard(upgrade).errors).toEqual([]);
    expect(validateCard(ally).errors).toEqual([]);
    expect(flat(2)).toEqual({ base: 2, perPlayer: 0 });
  });
});

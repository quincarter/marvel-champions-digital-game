import { describe, expect, it } from "vitest";
import {
  abilityId,
  cardId,
  cycleId,
  encounterSetId,
  flat,
  GLOSSARY_ENTRIES,
  KNOWN_KEYWORD_NAMES,
  setCode,
  trait,
  unerrataedText,
  validateAttachmentHost,
  validateCard,
} from "./index.js";
import type { AttachmentHost, KeywordInstance, MainSchemeCard, MinionCard, UpgradeCard } from "./index.js";

/**
 * docs/phase7-wave2.md §7: the schema requests `card-data-pipeline` raised in `docs/phase7-wave2-data.md`
 * (Part 1 §6, Part 3 §5) with a real card behind each one. Fixtures copy the shape of the MarvelCDB records
 * (codes and printed values), trimmed to what each rule needs; they are not curated data.
 *
 * Sources: RRG 1.8 "Printed" (p. 35), "Subtitle" (p. 41), "Encounter Card" (p. 18); the Fear No Evil rulebook,
 * "Featured Keywords" (p. 3), which is not in the repo — every shape it is the only source for is `unverified`.
 */

const CYCLE = cycleId("data-requests-fixture");
const text = unerrataedText;

const upgrade = (id: string, pack: string, name: string, attachesTo: AttachmentHost, keywords: readonly KeywordInstance[] = []): UpgradeCard => ({
  id: cardId(id),
  name,
  setCode: setCode(pack),
  cycleId: CYCLE,
  collectorNumber: id.slice(-3),
  quantityInSet: 1,
  unique: false,
  type: "upgrade",
  aspect: "leadership",
  traits: [],
  keywords,
  text: text("Attach to something."),
  abilities: [{ id: abilityId(`${id}.constant`) }],
  deckLimit: 3,
  cost: 1,
  resourceIcons: { mental: 1 },
  attachesTo,
});

describe("§7.1 the ally pool and the printed-cost measure", () => {
  // Beguiled (valk 25031) / 'Pool-ized (deadpool 44041): "Attach to the ally with the highest cost without
  // [this] attached."
  const beguiled: AttachmentHost = {
    kind: "superlative",
    among: "ally",
    order: "highest",
    measure: "printedCost",
    withoutAttachmentNamed: "Beguiled",
  };

  it("accepts 'the ally with the highest cost without <name> attached'", () => {
    expect(validateAttachmentHost(beguiled, "attachment")).toEqual([]);
  });

  it("refuses printedCost over an encounter-only pool, since only player cards print a cost", () => {
    expect(validateAttachmentHost({ ...beguiled, among: "minion" }, "attachment")).not.toEqual([]);
    expect(validateAttachmentHost({ ...beguiled, among: "villain" }, "attachment")).not.toEqual([]);
    // A friendly character can be an ally, so that pool is allowed.
    expect(validateAttachmentHost({ ...beguiled, among: "friendlyCharacter" }, "attachment")).toEqual([]);
  });

  it("still accepts every measure that already existed, over its own pool", () => {
    expect(validateAttachmentHost({ kind: "superlative", among: "villain", order: "highest", measure: "activationOrder" }, "a")).toEqual([]);
    expect(validateAttachmentHost({ kind: "superlative", among: "minion", order: "lowest", measure: "remainingHp" }, "a")).toEqual([]);
    expect(validateAttachmentHost({ kind: "superlative", among: "ally", order: "highest", measure: "bulk" as never }, "a")).not.toEqual([]);
  });
});

describe("§7.2 'an encounter card in play' as a host", () => {
  // Coordinated Effort (wonder_man 58032): "Attach to an encounter card in play. Max 1 per encounter card."
  it("is its own host kind, with the per-host play restriction alongside it", () => {
    const card: UpgradeCard = {
      ...upgrade("58032", "wonder_man", "Coordinated Effort", { kind: "encounterCard" }),
      playRestrictions: { maxPerHost: 1 },
    };
    expect(validateCard(card).errors).toEqual([]);
    expect(validateAttachmentHost({ kind: "encounterCard" }, "upgrade")).toEqual([]);
  });
});

describe("§7.3 a title substring qualifier", () => {
  // Warrior of the Great Web (spiderham 30029): "Attach to a character with 'Spider' in its title."
  const host: AttachmentHost = { kind: "qualified", category: "character", titleContains: "Spider" };

  it("is a qualifier in its own right, so it satisfies the 'at least one qualifier' rule", () => {
    expect(validateAttachmentHost(host, "upgrade")).toEqual([]);
    expect(validateAttachmentHost({ kind: "qualified", category: "character" }, "upgrade")).not.toEqual([]);
  });

  it("refuses an empty substring, which would match every card", () => {
    expect(validateAttachmentHost({ ...host, titleContains: "" }, "upgrade")).not.toEqual([]);
  });

  it("works on a superlative host too, since both share HostQualifiers", () => {
    expect(
      validateAttachmentHost({ kind: "superlative", among: "ally", order: "highest", measure: "printedCost", titleContains: "Spider" }, "a"),
    ).toEqual([]);
  });
});

describe("§7.4 the temporal qualifier (data only)", () => {
  // Puncture Wound (x23 43012): "Attach to an enemy that X-23 or Honey Badger attacked this turn."
  const host: AttachmentHost = { kind: "qualified", category: "enemy", attackedThisTurnBy: ["X-23", "Honey Badger"] };

  it("names the card titles whose attacks count", () => {
    expect(validateAttachmentHost(host, "upgrade")).toEqual([]);
  });

  it("refuses an empty list, which could only mean 'no host'", () => {
    expect(validateAttachmentHost({ ...host, attackedThisTurnBy: [] }, "upgrade")).not.toEqual([]);
    expect(validateAttachmentHost({ ...host, attackedThisTurnBy: [""] }, "upgrade")).not.toEqual([]);
  });
});

describe("§7.5 the Fear No Evil keywords", () => {
  const DEFENDER = trait("DEFENDER");

  it("Prerequisite names a form, or an OR of traits, and needs at least one", () => {
    // Defend Our City (jj 61029): "Prerequisite ([Defender])."
    const card = upgrade("61029", "jj", "Defend Our City", { kind: "yourIdentity" }, [{ name: "prerequisite", traits: [DEFENDER] }]);
    expect(validateCard(card).errors).toEqual([]);
    expect(validateCard(upgrade("61029b", "jj", "Form Only", { kind: "yourIdentity" }, [{ name: "prerequisite", form: "hero" }])).errors).toEqual([]);
    expect(validateCard(upgrade("61029c", "jj", "Neither", { kind: "yourIdentity" }, [{ name: "prerequisite" }])).errors).not.toEqual([]);
    expect(
      validateCard(upgrade("61029d", "jj", "Empty", { kind: "yourIdentity" }, [{ name: "prerequisite", traits: [] }])).errors,
    ).not.toEqual([]);
  });

  it("Starting takes no parameters", () => {
    // Innate Reflexes (fne 60038): "Starting. (You may add this card to your hand before drawing your starting hand.)"
    const card = upgrade("60038", "fne", "Innate Reflexes", { kind: "yourIdentity", form: "hero" }, [{ name: "starting" }]);
    expect(validateCard(card).errors).toEqual([]);
  });

  it("both are enumerated and carry a glossary entry, flagged unverified while the rulebook is not in the repo", () => {
    expect(KNOWN_KEYWORD_NAMES).toContain("prerequisite");
    expect(KNOWN_KEYWORD_NAMES).toContain("starting");
    for (const id of ["prerequisite", "starting"]) {
      const entry = GLOSSARY_ENTRIES.find((e) => e.id === id);
      expect(entry?.unverified).toBe(true);
      expect(entry?.sources[0]?.kind).toBe("insert-not-in-repo");
    }
  });
});

describe("§7.6 the two older gaps the pipeline pinned exclusions for", () => {
  const encounterBase = (id: string, pack: string, name: string) => ({
    id: cardId(id),
    name,
    setCode: setCode(pack),
    cycleId: CYCLE,
    collectorNumber: id.slice(-3),
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId(`${pack}-set`)],
    traits: [],
    keywords: [],
    abilities: [],
  });

  it("a main scheme stage may print no text at all (Attack on Mount Athena 04061a)", () => {
    const scheme: MainSchemeCard = {
      ...encounterBase("04061", "trors", "Attack on Mount Athena"),
      type: "main_scheme",
      stages: [
        {
          stageNumber: 1,
          startingThreat: flat(0),
          targetThreat: flat(12),
          acceleration: flat(1),
          icons: [],
          text: text(""),
          abilities: [],
          traits: [],
          keywords: [],
          aSide: { text: text(""), abilities: [] },
        },
      ],
    };
    expect(validateCard(scheme).errors).toEqual([]);
  });

  it("a minion may print more than 3 boost icons (Joystick 51039, Fixer 53038, Blizzard 54034)", () => {
    const minion: MinionCard = {
      ...encounterBase("51039", "bp", "Joystick"),
      type: "minion",
      boostIcons: 4,
      atk: 2,
      sch: 1,
      hp: 4,
      text: text("Guard."),
    };
    expect(validateCard(minion).errors).toEqual([]);
    expect(validateCard({ ...minion, boostIcons: -1 }).errors).not.toEqual([]);
    expect(validateCard({ ...minion, boostIcons: 1.5 }).errors).not.toEqual([]);
  });
});

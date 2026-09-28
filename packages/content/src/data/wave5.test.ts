import { describe, expect, it } from "vitest";
import {
  requirementResources,
  validateCampaign,
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateStarterDeck,
} from "../schema/index.js";
import type {
  AnyCard,
  AttachmentCard,
  EncounterSet,
  EnvironmentCard,
  HeroIdentityCard,
  MainSchemeCard,
} from "../schema/index.js";
import { CORE_CARDS } from "./core/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { IRONHEART_CARDS } from "./ironheart/cards.js";
import { NOVA_CARDS } from "./nova/cards.js";
import { poolVersionOf } from "./pool-version.js";
import { SILK_CARDS } from "./silk/cards.js";
import { SM_CAMPAIGN } from "./sm/campaign.js";
import { SM_CARDS } from "./sm/cards.js";
import { SM_ENCOUNTER_SETS } from "./sm/encounterSets.js";
import { SM_SCENARIOS } from "./sm/scenarios.js";
import { SM_STARTER_DECKS } from "./sm/starterDecks.js";
import { SPDR_CARDS } from "./spdr/cards.js";
import { SPIDERHAM_CARDS } from "./spiderham/cards.js";
import { PLAYABLE_CARDS, WAVE5_CARDS, WAVE5_ENCOUNTER_SETS, WAVE5_SCENARIOS, WAVE5_STARTER_DECKS } from "./index.js";

/**
 * Wave 5 (cycle 4, docs/phase7-wave5.md): `sm` (Sinister Motives) is new data this wave; `nova`/`ironheart`/
 * `spiderham`/`spdr` were emitted in earlier passes and are re-checked here as part of the same cycle. This file
 * covers both the data-integrity half (the wave 4 `wave4.test.ts` model) and, in its own "pool wiring" describe
 * block below, the `WAVE5_*` aggregate / `PLAYABLE_CARDS` step (docs/wave-definition-of-done.md §2) — `silk` is
 * cycle 4 too but is not part of this wave's pool (that block's own comment). `CAMPAIGNS` registration for
 * `SM_CAMPAIGN` is the box's own campaign step (§6), not this pool-wiring step, and is not covered here. Engine-
 * level deck legality (`validateDeck`/`requiredIdentitySet`) is `@mc/engine`'s/`@mc/cards`' own test, not
 * `@mc/content`'s — it cannot import `@mc/engine` (client → cards → engine → content dependency direction,
 * CLAUDE.md).
 */

interface PackFixture {
  readonly code: string;
  readonly cards: readonly AnyCard[];
}

const CYCLE4_PACKS: readonly PackFixture[] = [
  { code: "sm", cards: SM_CARDS },
  { code: "nova", cards: NOVA_CARDS },
  { code: "ironheart", cards: IRONHEART_CARDS },
  { code: "spiderham", cards: SPIDERHAM_CARDS },
  { code: "spdr", cards: SPDR_CARDS },
];

describe("wave 5 (cycle 4) data — integrity", () => {
  it("every card in every cycle 4 pack passes validateCard()", () => {
    for (const pack of CYCLE4_PACKS) {
      const failures = pack.cards
        .map((c) => ({ id: c.id, errors: validateCard(c).errors }))
        .filter((f) => f.errors.length > 0);
      expect(failures, pack.code).toEqual([]);
    }
  });

  it.each(CYCLE4_PACKS.map((p) => [p.code, p] as const))("%s: every card belongs to its own pack", (code, pack) => {
    for (const c of pack.cards) expect(c.setCode, c.id as string).toBe(code);
  });

  it("sm has no duplicate card ids", () => {
    const ids = SM_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sm registers encounter sets with no duplicate ids", () => {
    const ids = SM_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Sinister Motives — scan-confirmed text corrections", () => {
  // None of these fixes touch a hero_identity card (the only `AnyCard` member without `text`/`abilities` at the
  // top level) — narrows the union so the assertions below can read `.text.current`/`.abilities` directly.
  function findTexted(id: string) {
    const card = SM_CARDS.find((c) => c.id === id);
    if (!card || !("text" in card) || !("abilities" in card)) throw new Error(`expected a texted card for ${id}`);
    return card;
  }

  // assets/card-art/bundles/cards/27157.png: "...If no identity-specific card was discarded this way, take 1
  // damage." — MarvelCDB's raw text reads "not" for "no".
  it("Deepest Fears (27157) reads 'no identity-specific card', not 'not'", () => {
    const card = findTexted("27157");
    expect(card.text.current).toContain("If no identity-specific card was discarded this way, take 1 damage.");
  });

  // assets/card-art/bundles/cards/27060.png: "...or no attack was made this way, this card gains surge."
  it("Slice and Dice (27060) reads 'or no attack was made', not 'or not attack was made'", () => {
    const card = findTexted("27060");
    expect(card.text.current).toContain(
      "If that attack defeats a character or no attack was made this way, this card gains surge.",
    );
  });

  // assets/card-art/bundles/cards/27153.png: the constant restriction and the Alter-Ego Action are printed as two
  // separate paragraphs/abilities, unlike MarvelCDB's raw text (a literal "/n" instead of a newline hides the
  // Action from the header parser, docs/phase7-wave5.md-style curation comment in curation/sm.ts).
  it("Induced Panic (27153) scripts its constant restriction and its Alter-Ego Action as two abilities", () => {
    const card = findTexted("27153");
    expect(card.abilities.map((a) => a.id)).toEqual(["27153.induced-panic-constant", "27153.induced-panic-action"]);
    expect(card.text.current).toContain(
      "Alter-Ego Action: Discard 1 identity-specific card at random from your hand → discard this card.",
    );
  });

  // assets/card-art/bundles/cards/27128.png: "Rhino's attacks gain overkill and piercing." — MarvelCDB's raw
  // text has a subject/verb mismatch ("attack" for "attacks") and no closing period.
  it("Rhino (27128) reads 'attacks gain', not 'attack gain', with a closing period", () => {
    const card = findTexted("27128");
    expect(card.text.current).toContain("Rhino's attacks gain overkill and piercing.");
  });

  // assets/card-art/bundles/cards/27116b.png: three "•"-bulleted sentences, "Encounter cards" capitalized, "the
  // main scheme" quoted in the first two, and a closing period on the third.
  it("Skies Over New York (27116b) capitalizes 'Encounter cards' and quotes 'the main scheme'", () => {
    const card = findTexted("27116b");
    expect(card.text.current).toContain('Encounter cards that affect "the main scheme"');
    expect(card.text.current).toContain('Player cards that affect "the main scheme"');
    expect(card.text.current.endsWith("on that scheme.")).toBe(true);
  });

  // assets/card-art/bundles/cards/27152.png: "Surge." with no space before the period, unlike every other
  // "Surge." card in the corpus.
  it("Tracking Display (27152) reads 'Surge.' with no stray space", () => {
    const card = findTexted("27152");
    expect(card.text.current.startsWith("Surge.\n")).toBe(true);
  });

  // assets/card-art/bundles/cards/27103.png: "+X ATK" in the stat box — MarvelCDB sends its printed-X sentinel
  // (`attack: -1`), which `normalizeEncounterCard`'s attachment branch omits rather than emitting as a literal
  // -1 (`PrintedStatModifiers.atk` has no "X"; the dynamic bonus is scripted instead, curation/sm.ts's own
  // `27103` cardNotes entry).
  it("Heightened Morale (27103) carries no fixed statModifiers.atk (the box prints X, not a number)", () => {
    const card = findTexted("27103") as AttachmentCard;
    expect(card.type).toBe("attachment");
    expect(card.statModifiers?.atk).toBeUndefined();
  });

  // assets/card-art/bundles/cards/27104.png: a second printed sentence, "Threat cannot be removed from Light at
  // the End.", entirely absent from MarvelCDB's raw text/real_text.
  it("Taunting Presence (27104) restores 'Threat cannot be removed from Light at the End.'", () => {
    const card = findTexted("27104");
    expect(card.text.current).toContain("Threat cannot be removed from Light at the End.");
  });
});

describe("SP//dr — separated identity sides", () => {
  // Hall of Heroes scan s2.jpg ("SP//DR (2/17)", 2B): one wild resource icon, which Sync Ratio reads.
  it("the SP//dr upgrade side prints one wild resource icon", () => {
    const identity = SPDR_CARDS.find((c) => c.id === "31001a");
    expect(identity?.type).toBe("hero_identity");
    if (identity?.type !== "hero_identity") return;
    expect(identity.separatedIdentity?.alterEgoCardOtherSide).toMatchObject({
      cardType: "upgrade",
      name: "SP//dr",
      resourceIcons: { wild: 1 },
    });
  });
});

describe("Sinister Motives — five scenarios", () => {
  it("five scenarios: Sandman, Venom, Mysterio, The Sinister Six, Venom Goblin", () => {
    expect(SM_SCENARIOS.map((s) => s.id).sort()).toEqual(
      ["sandman", "venom", "mysterio", "sinister-six", "venom-goblin"].sort(),
    );
  });

  it("every scenario passes validateScenario()", () => {
    for (const s of SM_SCENARIOS) expect(validateScenario(s).errors, s.id as string).toEqual([]);
  });

  it("every scenario's named encounter sets are registered (sm's own plus Core's)", () => {
    const sets: readonly EncounterSet[] = [...CORE_ENCOUNTER_SETS, ...SM_ENCOUNTER_SETS];
    for (const s of SM_SCENARIOS) expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
  });

  it("every scenario's villainCardId/mainSchemeCardId resolve to a real card in SM_CARDS", () => {
    const ids = new Set(SM_CARDS.map((c) => c.id as string));
    for (const s of SM_SCENARIOS) {
      expect(ids.has(s.villainCardId as string), `${s.id as string} villain`).toBe(true);
      expect(ids.has(s.mainSchemeCardId as string), `${s.id as string} main scheme`).toBe(true);
    }
  });

  it("The Sinister Six is a set-aside, card-ability-win multipleVillains scenario (docs/phase7-wave5.md §1.5)", () => {
    const scenario = SM_SCENARIOS.find((s) => s.id === "sinister-six");
    expect(scenario?.multipleVillains?.winCondition).toBe("cardAbility");
    expect(scenario?.multipleVillains?.atSetup).toBe("setAside");
    expect(scenario?.multipleVillains?.villains).toHaveLength(6);
    expect(scenario?.multipleVillains?.encounterDecks).toBe("shared");
  });

  it("Venom Goblin's main scheme is a single 4-stage card whose stages flip to real environment cards (docs/phase7-wave5.md §1.1)", () => {
    const scenario = SM_SCENARIOS.find((s) => s.id === "venom-goblin");
    expect(scenario).toBeDefined();
    const cardsById = new Map(SM_CARDS.map((c) => [c.id as string, c]));
    const mainScheme = cardsById.get(scenario?.mainSchemeCardId as string) as MainSchemeCard | undefined;
    expect(mainScheme?.type).toBe("main_scheme");
    expect(mainScheme?.stages).toHaveLength(4);
    const letters = mainScheme?.stages.map((s) => s.stageLetter);
    expect(letters).toEqual(["A", "B", "C", "D"]);
    for (const stage of mainScheme?.stages ?? []) {
      expect(stage.otherFaceId, `stage ${stage.stageLetter as string}`).toBeDefined();
      const other = cardsById.get(stage.otherFaceId as string);
      expect(other, `stage ${stage.stageLetter as string} otherFaceId`).toBeDefined();
      expect(
        (other as EnvironmentCard | undefined)?.type,
        `stage ${stage.stageLetter as string} otherFaceId type`,
      ).toBe("environment");
      expect(
        (other as EnvironmentCard | undefined)?.otherFaceId,
        `stage ${stage.stageLetter as string} back-link`,
      ).toBe(mainScheme?.id);
    }
    // Stage A (Skies Over New York) never holds threat; stages B-D flip on completion (the p. 67 erratum).
    expect(mainScheme?.stages[0]?.dashedValues?.slice().sort()).toEqual(
      ["acceleration", "startingThreat", "targetThreat"].sort(),
    );
    expect(mainScheme?.stages[0]?.onCompletion).toBeUndefined();
    for (const stage of (mainScheme?.stages ?? []).slice(1)) {
      expect(stage.onCompletion, `stage ${stage.stageLetter as string}`).toBe("flipToOtherFace");
    }
  });

  it('every scenario reuses Core\'s Standard and Expert encounter sets (MC27\'s own Setups print only "Standard"; RRG 1.8 "Expert Mode" adds the Expert set)', () => {
    for (const s of SM_SCENARIOS) {
      expect(s.standardEncounterSetIds, s.id as string).toEqual(["standard"]);
      expect(s.expertEncounterSetIds, s.id as string).toEqual(["expert"]);
    }
  });

  it("nova, ironheart, spiderham and spdr (hero packs with no scenario of their own) are not among sm's scenarios", () => {
    for (const s of SM_SCENARIOS) expect(s.packCode as string).toBe("sm");
  });
});

describe("Sinister Motives — starter decks (content-level; see wave5.test.ts's own header comment)", () => {
  it("sm has two box precons: Ghost-Spider and Spider-Man (Miles Morales)", () => {
    expect(SM_STARTER_DECKS).toHaveLength(2);
    expect(SM_STARTER_DECKS.map((d) => d.id).sort()).toEqual(["ghost-spider", "spider-man-morales"].sort());
  });

  it("both precons validate as a StarterDeck", () => {
    for (const d of SM_STARTER_DECKS) expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
  });

  it("both precons are verified against MC27 p. 20 and are exactly 40 cards", () => {
    for (const d of SM_STARTER_DECKS) {
      expect(d.provenance.verified, d.id as string).toBe(true);
      expect(d.provenance.sources.length, d.id as string).toBeGreaterThan(0);
      expect(
        d.cards.reduce((n, e) => n + e.quantity, 0),
        d.id as string,
      ).toBe(40);
    }
  });

  it("both precons' identity cards resolve to a real sm hero identity, and each lists exactly one aspect", () => {
    const ids = new Set(SM_CARDS.map((c) => c.id as string));
    for (const d of SM_STARTER_DECKS) {
      expect(ids.has(d.identityCardId as string), d.id as string).toBe(true);
      expect(d.aspects, d.id as string).toHaveLength(1);
    }
  });

  // Precons for nova/ironheart/spiderham/spdr were emitted in a separate pass (docs/phase7-wave5-sources.md
  // §5/§7.1) and are covered together with sm's own two in the "pool wiring" describe block below, once as part
  // of WAVE5_STARTER_DECKS rather than sm-specific assertions here.
});

describe("Sinister Motives — campaign record", () => {
  it("SM_CAMPAIGN passes validateCampaign()", () => {
    const outcome = validateCampaign(SM_CAMPAIGN);
    expect(outcome.errors).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("every scenario SM_CAMPAIGN names is registered and belongs to sm, in box order, no duplicates", () => {
    const byId = new Map(SM_SCENARIOS.map((s) => [s.id as string, s]));
    expect(SM_CAMPAIGN.scenarioIds.map((id) => id as string)).toEqual([
      "sandman",
      "venom",
      "mysterio",
      "sinister-six",
      "venom-goblin",
    ]);
    for (const scenarioId of SM_CAMPAIGN.scenarioIds) {
      const scenario = byId.get(scenarioId as string);
      expect(scenario, `scenario ${scenarioId} is not registered`).toBeDefined();
      expect(scenario?.packCode, `scenario ${scenarioId} pack`).toBe(SM_CAMPAIGN.packCode);
    }
    expect(new Set(SM_CAMPAIGN.scenarioIds).size).toBe(SM_CAMPAIGN.scenarioIds.length);
  });

  it("every set SM_CAMPAIGN names is registered and campaignSpecific, with no duplicates", () => {
    const byId = new Map(SM_ENCOUNTER_SETS.map((s) => [s.id as string, s]));
    for (const setId of SM_CAMPAIGN.campaignSetIds) {
      const set = byId.get(setId as string);
      expect(set, `set ${setId} is not registered`).toBeDefined();
      expect(set?.campaignSpecific, `set ${setId} must be campaignSpecific`).toBe(true);
    }
    expect(new Set(SM_CAMPAIGN.campaignSetIds).size).toBe(SM_CAMPAIGN.campaignSetIds.length);
  });

  it("SM_CAMPAIGN's prohibited cardIds/encounterSetIds resolve to real records (MC27 p. 4)", () => {
    const cardIds = new Set(SM_CARDS.map((c) => c.id as string));
    const setIds = new Set(SM_ENCOUNTER_SETS.map((s) => s.id as string));
    for (const id of SM_CAMPAIGN.prohibited?.cardIds ?? []) {
      expect(cardIds.has(id as string), `prohibited card ${id}`).toBe(true);
    }
    for (const id of SM_CAMPAIGN.prohibited?.encounterSetIds ?? []) {
      expect(setIds.has(id as string), `prohibited encounter set ${id}`).toBe(true);
    }
  });

  it("prohibited cards (Venom (Eddie Brock), Symbiote Suit) are not themselves campaign-specific", () => {
    const cardsById = new Map(SM_CARDS.map((c) => [c.id as string, c]));
    for (const id of SM_CAMPAIGN.prohibited?.cardIds ?? []) {
      const card = cardsById.get(id as string);
      expect(card, id as string).toBeDefined();
      expect(
        "specificTo" in (card as object) ? (card as { specificTo?: unknown }).specificTo : undefined,
        id as string,
      ).toBeUndefined();
    }
  });

  it("every campaign-specific encounter set's own cards belong only to campaign-specific sets", () => {
    const campaignSetIds = new Set(SM_ENCOUNTER_SETS.filter((s) => s.campaignSpecific).map((s) => s.id as string));
    for (const card of SM_CARDS) {
      if (!("encounterSetIds" in card)) continue;
      const setIds = (card as { encounterSetIds: readonly unknown[] }).encounterSetIds.map((id) => id as string);
      const inCampaignSet = setIds.some((id) => campaignSetIds.has(id));
      if (!inCampaignSet) continue;
      for (const id of setIds) {
        expect(campaignSetIds.has(id), `${card.id as string} mixes a campaign-specific and ordinary set`).toBe(true);
      }
    }
  });

  it("every S.H.I.E.L.D. Tech player card (182-189) is specificTo the campaign's own shield_tech set", () => {
    const shieldTechCards = SM_CARDS.filter(
      (c) => "specificTo" in c && (c as { specificTo?: { kind?: string } }).specificTo?.kind === "campaign",
    );
    expect(shieldTechCards.length).toBe(8);
    for (const card of shieldTechCards) {
      const specificTo = (card as { specificTo: { encounterSetId: unknown } }).specificTo;
      expect(specificTo.encounterSetId as string, card.id as string).toBe("shield_tech");
    }
  });
});

describe("wave 5 pool wiring (docs/wave-definition-of-done.md §2: WAVE5_* content exports, PLAYABLE_CARDS)", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = WAVE5_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("every WAVE5_CARDS entry is Core plus sm/nova/ironheart/spiderham/spdr, with no duplicate ids", () => {
    const ids = WAVE5_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WAVE5_CARDS.length).toBe(
      CORE_CARDS.length +
        SM_CARDS.length +
        NOVA_CARDS.length +
        IRONHEART_CARDS.length +
        SPIDERHAM_CARDS.length +
        SPDR_CARDS.length,
    );
  });

  it("silk is not part of the wave 5 pool (its own kit ships in a later wave)", () => {
    const silkIds = new Set(SILK_CARDS.map((c) => c.id as string));
    for (const c of WAVE5_CARDS) expect(silkIds.has(c.id as string), c.id as string).toBe(false);
  });

  it("wave 5 registers encounter sets for every pack, with no duplicate ids", () => {
    const ids = WAVE5_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("WAVE5_SCENARIOS is exactly sm's five scenarios (nova/ironheart/spiderham/spdr define none of their own)", () => {
    expect(WAVE5_SCENARIOS.map((s) => s.id).sort()).toEqual(SM_SCENARIOS.map((s) => s.id).sort());
    for (const s of WAVE5_SCENARIOS) expect(s.packCode as string).toBe("sm");
  });

  it("every WAVE5_SCENARIOS entry's named encounter sets are registered (cycle 4's own plus Core's)", () => {
    const sets: readonly EncounterSet[] = [...CORE_ENCOUNTER_SETS, ...WAVE5_ENCOUNTER_SETS];
    for (const s of WAVE5_SCENARIOS) expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
  });

  it("the wave 5 pool version is deterministic and well-formed, and differs from Core's", () => {
    const v1 = poolVersionOf(WAVE5_CARDS);
    const v2 = poolVersionOf(WAVE5_CARDS);
    expect(v1).toBe(v2);
    expect(v1).toMatch(/^v1-[0-9a-f]{8}$/);
    expect(poolVersionOf(WAVE5_CARDS)).not.toBe(poolVersionOf(CORE_CARDS));
  });

  it("PLAYABLE_CARDS includes wave 5's own cards, with no duplicate ids", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of [...SM_CARDS, ...NOVA_CARDS, ...IRONHEART_CARDS, ...SPIDERHAM_CARDS, ...SPDR_CARDS]) {
      expect(ids).toContain(c.id);
    }
  });

  it("wave 5 has five starter decks: Ghost-Spider, Spider-Man (Miles Morales), Nova, Ironheart, Spider-Ham, SP//dr", () => {
    // Six decks: sm's own two, plus one each for the four hero packs.
    expect(WAVE5_STARTER_DECKS).toHaveLength(6);
    expect(WAVE5_STARTER_DECKS.map((d) => d.id).sort()).toEqual(
      [
        "ghost-spider",
        "spider-man-morales",
        "nova-aggression",
        "ironheart-leadership",
        "spiderham-justice",
        "spdr-protection",
      ].sort(),
    );
  });

  it("every wave 5 starter deck validates as a StarterDeck, is verified against a real source, and is 40 cards", () => {
    for (const d of WAVE5_STARTER_DECKS) {
      expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
      expect(d.provenance.verified, d.id as string).toBe(true);
      expect(d.provenance.sources.length, d.id as string).toBeGreaterThan(0);
      expect(
        d.cards.reduce((n, e) => n + e.quantity, 0),
        d.id as string,
      ).toBe(40);
    }
  });

  it("every wave 5 precon's identity resolves in WAVE5_CARDS and lists exactly one aspect", () => {
    for (const d of WAVE5_STARTER_DECKS) {
      const identity = WAVE5_CARDS.find((c) => c.id === d.identityCardId) as HeroIdentityCard | undefined;
      expect(identity, d.id as string).toBeDefined();
      expect(d.aspects, d.id as string).toHaveLength(1);
    }
  });

  it("every wave 5 precon includes its identity's own hero-kit cards (aspect hero:<id>, no separateDeck) at their exact printed quantity", () => {
    for (const d of WAVE5_STARTER_DECKS) {
      const identity = WAVE5_CARDS.find((c) => c.id === d.identityCardId) as HeroIdentityCard | undefined;
      if (!identity) continue;
      for (const card of WAVE5_CARDS) {
        const isIdentitySpecific = "aspect" in card && card.aspect === `hero:${identity.id}`;
        const inSeparateDeck = "separateDeck" in card && card.separateDeck !== undefined;
        if (!isIdentitySpecific || inSeparateDeck) continue;
        const listed = d.cards.find((e) => e.cardId === card.id)?.quantity ?? 0;
        expect(listed, `${d.id as string}: ${card.id as string}`).toBe(card.quantityInSet);
      }
    }
  });
});

describe("Requirement keyword: several printed icons parse into `keywords` (RRG 1.8 'Requirement (Resources)', p. 37)", () => {
  // 27049/52022 print "Requirement ([energy] [mental] [physical])" — icons separated by spaces, which the ingest
  // parser's Requirement regex used to reject outright, dropping the keyword (`keywords: []`) and letting the card
  // be paid for without spending the listed resources. Fixed in packages/content/scripts/marvelcdb/parse-text.ts.
  const keywordsOf = (card: AnyCard | undefined) => {
    if (!card || !("keywords" in card)) throw new Error(`no keywords on ${card?.id as string}`);
    return card.keywords;
  };

  it("Spider-Man / Peter Parker (ally, sm 27049) carries all three space-separated icons", () => {
    const keywords = keywordsOf(SM_CARDS.find((c) => c.id === "27049"));
    expect(keywords).toContainEqual({ name: "requirement", resources: { energy: 1, mental: 1, physical: 1 } });
    expect(requirementResources(keywords.find((k) => k.name === "requirement")!)).toEqual({
      energy: 1,
      mental: 1,
      physical: 1,
    });
  });

  it("its silk 52022 reprint carries the same three icons", () => {
    const keywords = keywordsOf(SILK_CARDS.find((c) => c.id === "52022"));
    expect(keywords).toContainEqual({ name: "requirement", resources: { energy: 1, mental: 1, physical: 1 } });
  });

  // Adjacent icons with no separator (`[mental][mental]`) already parsed correctly before this fix — unchanged.
  it("R&D Facility (ironheart 29020) still carries its adjacent-icon Requirement", () => {
    const keywords = keywordsOf(IRONHEART_CARDS.find((c) => c.id === "29020"));
    expect(keywords).toContainEqual({ name: "requirement", resources: { mental: 2 } });
  });

  // Single-icon Requirement cards resolve to the wave 1 `icon` shape and are unaffected by the multi-icon fix.
  it("Web Binding (sm 27006) still carries its single-icon Requirement", () => {
    const keywords = keywordsOf(SM_CARDS.find((c) => c.id === "27006"));
    expect(keywords).toContainEqual({ name: "requirement", icon: "mental" });
  });
});

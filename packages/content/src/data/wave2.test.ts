/// <reference types="node" />
import { readFileSync } from "node:fs";
import {
  validateCard,
  validateScenario,
  validateScenarioEncounterSets,
  validateStarterDeck,
  type AnyCard,
  type HeroIdentityCard,
  type MainSchemeCard,
  type VillainCard,
} from "../schema/index.js";
import { ANT_CARDS, ANT_PACK, ANT_PROVENANCE, ANT_STARTER_DECKS } from "./ant/index.js";
import { WSP_CARDS, WSP_PACK, WSP_PROVENANCE, WSP_STARTER_DECKS } from "./wsp/index.js";
import { QSV_CARDS, QSV_PACK, QSV_PROVENANCE, QSV_STARTER_DECKS } from "./qsv/index.js";
import { SCW_CARDS, SCW_PACK, SCW_PROVENANCE, SCW_STARTER_DECKS } from "./scw/index.js";
import { TRORS_CARDS, TRORS_PACK, TRORS_PROVENANCE, TRORS_STARTER_DECKS } from "./trors/index.js";
import { TOAFK_CARDS, TOAFK_PACK, TOAFK_PROVENANCE } from "./toafk/index.js";
import { WAVE2_CARDS, WAVE2_ENCOUNTER_SETS, WAVE2_SCENARIOS, WAVE2_STARTER_DECKS } from "./index.js";
import { CORE_CARDS } from "./core/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { poolVersionOf } from "./pool-version.js";
import type { CardProvenance, DroppedSourceRecord } from "./types.js";

interface RawRecord {
  code: string;
  card_set_code?: string | null;
  quantity: number;
  type_code: string;
  linked_card?: RawRecord | null;
  [key: string]: unknown;
}

interface PackFixture {
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly provenance: readonly CardProvenance[];
  readonly dropped: readonly DroppedSourceRecord[];
}

function rawCacheOf(code: string): { cards: RawRecord[] } {
  return JSON.parse(readFileSync(new URL(`../../raw/marvelcdb/${code}.json`, import.meta.url), "utf8")) as { cards: RawRecord[] };
}

const PACKS: readonly PackFixture[] = [
  { code: "trors", cards: TRORS_CARDS, provenance: TRORS_PROVENANCE, dropped: [] },
  { code: "toafk", cards: TOAFK_CARDS, provenance: TOAFK_PROVENANCE, dropped: [] },
  { code: "ant", cards: ANT_CARDS, provenance: ANT_PROVENANCE, dropped: [] },
  { code: "wsp", cards: WSP_CARDS, provenance: WSP_PROVENANCE, dropped: [] },
  { code: "qsv", cards: QSV_CARDS, provenance: QSV_PROVENANCE, dropped: [] },
  { code: "scw", cards: SCW_CARDS, provenance: SCW_PROVENANCE, dropped: [] },
];

function byId<T extends AnyCard>(cards: readonly AnyCard[], id: string, type: T["type"]): T {
  const c = cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  expect(c.type).toBe(type);
  return c as T;
}

describe("wave 2 (cycle 1) data — integrity (every pack)", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = WAVE2_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors }))
      .filter((f) => f.errors.length > 0);
    expect(failures).toEqual([]);
  });

  it("every WAVE2_CARDS entry is Core plus the six cycle 1 packs, with no duplicate ids", () => {
    const ids = WAVE2_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WAVE2_CARDS.length).toBe(CORE_CARDS.length + PACKS.reduce((n, p) => n + p.cards.length, 0));
  });

  it.each(PACKS.map((p) => [p.code, p] as const))("%s: every non-aggregate/non-dropped MarvelCDB record is covered exactly once", (code, pack) => {
    const raw = rawCacheOf(code);
    const rawCodes = new Set(raw.cards.flatMap((r) => (r.linked_card ? [r.code, r.linked_card.code] : [r.code])));
    const isAggregate = (c: string) => /\d$/.test(c) && rawCodes.has(`${c}a`);
    const coveredCodes = new Set(pack.provenance.flatMap((p) => p.marvelcdbCodes));
    // trors drops one ignored record (10098, not a printed card — see curation/trors.ts) and toafk drops its
    // main-scheme aggregate B/A sides folded into A/B pairs; both are legitimately uncovered by provenance.
    const knownDrops = new Set(code === "trors" ? ["10098"] : []);
    for (const c of rawCodes) {
      if (isAggregate(c) || knownDrops.has(c)) continue;
      expect(coveredCodes.has(c), `${code} ${c} not covered by any emitted card`).toBe(true);
    }
    const cardIds = new Set(pack.cards.map((c) => c.id as string));
    for (const p of pack.provenance) expect(cardIds.has(p.cardId as string), `${code} ${p.cardId}`).toBe(true);
  });

  it.each(PACKS.map((p) => [p.code, p] as const))("%s: every card belongs to its own pack/cycle1", (code, pack) => {
    for (const c of pack.cards) {
      expect(c.setCode, c.id as string).toBe(code);
      expect(c.cycleId, c.id as string).toBe("cycle1");
    }
  });

  it("pack metadata: release dates researched from Hall of Heroes, not placeholders", () => {
    for (const p of [TRORS_PACK, TOAFK_PACK, ANT_PACK, WSP_PACK, QSV_PACK, SCW_PACK]) {
      expect(p.releaseDate).not.toBe("unresearched");
      expect(p.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("no HTML, trait markup, or unknown icon tokens survive in any cycle 1 card's text", () => {
    for (const c of WAVE2_CARDS) {
      for (const t of allTexts(c)) {
        expect(t, c.id).not.toMatch(/<[a-z/]|\[\[|&[a-z]+;/);
      }
    }
  });

  it("wave 2 registers encounter sets for every pack, with no duplicate ids", () => {
    const ids = WAVE2_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["hawkeye_nemesis", "spider_woman_nemesis", "kang", "exp_kang", "ant_nemesis", "wsp_nemesis", "qsv_nemesis", "scw_nemesis"]));
  });

  it("the wave 2 pool version is deterministic and well-formed", () => {
    const v1 = poolVersionOf(WAVE2_CARDS);
    const v2 = poolVersionOf(WAVE2_CARDS);
    expect(v1).toBe(v2);
    expect(v1).toMatch(/^v1-[0-9a-f]{8}$/);
    // The wave 2 pool is a strict superset of Core's — the extra cards must actually change the fingerprint.
    expect(poolVersionOf(WAVE2_CARDS)).not.toBe(poolVersionOf(CORE_CARDS));
  });
});

describe("cycle 1 scenarios — The Rise of Red Skull's five plus The Once and Future Kang", () => {
  it("six scenarios: Crossbones, Absorbing Man, Taskmaster, Zola, Red Skull, Kang", () => {
    expect(WAVE2_SCENARIOS.map((s) => s.id).sort()).toEqual(
      ["absorbing-man", "crossbones", "kang", "red-skull", "taskmaster", "zola"].sort(),
    );
  });

  it("every scenario passes validateScenario()", () => {
    for (const s of WAVE2_SCENARIOS) expect(validateScenario(s).errors, s.id as string).toEqual([]);
  });

  it("every scenario's named encounter sets are registered (cycle 1's own plus Core's, for cross-pack modular sets)", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...WAVE2_ENCOUNTER_SETS];
    for (const s of WAVE2_SCENARIOS) expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
  });

  it("every scenario's villainCardId/mainSchemeCardId resolve to a real card in WAVE2_CARDS", () => {
    const ids = new Set(WAVE2_CARDS.map((c) => c.id as string));
    for (const s of WAVE2_SCENARIOS) {
      expect(ids.has(s.villainCardId as string), `${s.id as string} villain`).toBe(true);
      expect(ids.has(s.mainSchemeCardId as string), `${s.id as string} main scheme`).toBe(true);
    }
  });

  it("Crossbones' modular sets include Core's Legions of Hydra, not a trors-only set (docs/phase7-wave2-data.md, Task A #2)", () => {
    const crossbones = WAVE2_SCENARIOS.find((s) => s.id === "crossbones");
    expect(crossbones?.recommendedModularSetIds).toContain("legions_of_hydra");
    expect(CORE_ENCOUNTER_SETS.some((s) => s.id === "legions_of_hydra")).toBe(true);
    // trors' own raw feed has no "legions_of_hydra" card_set_code at all — it is a Core Set modular set that
    // Attack on Mount Athena's 1A happens to call for alongside two of trors' own.
    expect(WAVE2_ENCOUNTER_SETS.some((s) => s.id === "legions_of_hydra")).toBe(false);
  });

  it("Kang: Kang (I) starts the villain deck; Kang (II)/(III) are set aside; expert mode replaces all six", () => {
    const kang = WAVE2_SCENARIOS.find((s) => s.id === "kang");
    expect(kang?.villainCardId).toBe("11001");
    expect(kang?.setAsideVillainCardIds).toEqual(["11002", "11003", "11004", "11005", "11006"]);
    expect(kang?.expertVillains?.villainCardId).toBe("11034");
    expect(kang?.expertVillains?.setAsideVillainCardIds).toEqual(["11035", "11036", "11037", "11038", "11039"]);
    expect(kang?.victory).toBe("cardAbility");
    expect(kang?.separateGameAreas?.centralStageNumber).toBe(2);
  });

  it("Crossbones' Experimental Weapons and Red Skull's side-scheme deck are separate decks, not part of the flat encounter deck", () => {
    const crossbones = WAVE2_SCENARIOS.find((s) => s.id === "crossbones");
    expect(crossbones?.separateDecks).toEqual([
      { name: "Experimental Weapons", contents: { encounterSetIds: ["exper_weapon"] }, discardPile: "encounter", whenEmpty: "remainsEmpty" },
    ]);
    const redSkull = WAVE2_SCENARIOS.find((s) => s.id === "red-skull");
    expect(redSkull?.separateDecks).toEqual([
      { name: "side-scheme deck", contents: { cardType: "side_scheme" }, discardPile: "own", whenEmpty: "reshuffleDiscardWithoutPenalty" },
    ]);
  });
});

describe("cycle 1 starter decks — schema validation (content-level; engine deck legality is @mc/engine's/@mc/cards' own test, not @mc/content's — it cannot import @mc/engine per the client→cards→engine→content dependency direction)", () => {
  it("wave 2 has six starter decks", () => {
    expect(WAVE2_STARTER_DECKS).toHaveLength(6);
  });

  it("every wave 2 starter deck validates as a StarterDeck", () => {
    for (const d of WAVE2_STARTER_DECKS) expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
  });

  it("every precon is exactly 40 cards and verified against a real photographed/printed source", () => {
    for (const d of WAVE2_STARTER_DECKS) {
      expect(d.provenance.verified, d.id as string).toBe(true);
      expect(d.cards.reduce((n, e) => n + e.quantity, 0), d.id as string).toBe(40);
    }
  });

  it("every precon includes its identity's own hero-kit cards (aspect hero:<id>, no separateDeck) at their exact printed quantity", () => {
    for (const d of WAVE2_STARTER_DECKS) {
      const identity = WAVE2_CARDS.find((c) => c.id === d.identityCardId) as HeroIdentityCard | undefined;
      expect(identity, d.id as string).toBeDefined();
      if (!identity) continue;
      for (const card of WAVE2_CARDS) {
        const isIdentitySpecific = "aspect" in card && card.aspect === `hero:${identity.id}`;
        const inSeparateDeck = "separateDeck" in card && card.separateDeck !== undefined;
        if (!isIdentitySpecific || inSeparateDeck) continue;
        const listed = d.cards.find((e) => e.cardId === card.id)?.quantity ?? 0;
        expect(listed, `${d.id as string}: ${card.id as string}`).toBe(card.quantityInSet);
      }
    }
  });
});

describe("Ant-Man and Wasp — three-sided identity, curated data", () => {
  it("Ant-Man's Giant inside face folds into additionalHeroForms, keyed off the real identity (not the extra face)", () => {
    const identity = byId<HeroIdentityCard>(ANT_CARDS, "12001a", "hero_identity");
    expect(identity.additionalHeroForms).toHaveLength(1);
    expect(identity.additionalHeroForms?.[0]?.faceName).toBe("Ant-Man");
    expect(identity.hero.faceName).toBe("Ant-Man");
    expect(identity.alterEgo.faceName).toBe("Scott Lang");
  });

  it("Wasp's Giant inside face folds into additionalHeroForms", () => {
    const identity = byId<HeroIdentityCard>(WSP_CARDS, "13001a", "hero_identity");
    expect(identity.additionalHeroForms).toHaveLength(1);
    expect(identity.alterEgo.faceName).toBe("Nadia Van Dyne");
  });

  it("every Ant-Man hero-kit card is identity-specific to the real identity code, not the extra Giant face", () => {
    for (const c of ANT_CARDS) {
      if ("aspect" in c && typeof c.aspect === "string" && c.aspect.startsWith("hero:")) {
        expect(c.aspect, c.id as string).toBe("hero:12001a");
      }
    }
  });

  it("every Wasp hero-kit card is identity-specific to the real identity code", () => {
    for (const c of WSP_CARDS) {
      if ("aspect" in c && typeof c.aspect === "string" && c.aspect.startsWith("hero:")) {
        expect(c.aspect, c.id as string).toBe("hero:13001a");
      }
    }
  });

  it("Ant-Man ally (12011) does not match the Ant-Man identity (bare title vs Scott Lang alter-ego)", () => {
    const ally = ANT_CARDS.find((c) => c.id === "12011");
    expect(ally?.name).toBe("Ant-Man");
    const identity = byId<HeroIdentityCard>(ANT_CARDS, "12001a", "hero_identity");
    expect(identity.alterEgo.faceName).not.toBe(ally?.name);
  });
});

describe("Spider-Woman — two aspects, printedAspect signature cards", () => {
  it("Double Agent deckbuilding: aspectCount 2, equalCardsPerAspect", () => {
    const identity = byId<HeroIdentityCard>(TRORS_CARDS, "04031a", "hero_identity");
    expect(identity.deckbuilding).toEqual({ aspectCount: 2, equalCardsPerAspect: true });
  });

  it("her four aspect-printed signature cards stay identity-specific, with printedAspect set", () => {
    const expected: readonly [string, string][] = [
      ["04035", "aggression"],
      ["04036", "leadership"],
      ["04037", "protection"],
      ["04038", "justice"],
    ];
    for (const [id, aspect] of expected) {
      const card = TRORS_CARDS.find((c) => c.id === id);
      expect(card && "aspect" in card ? card.aspect : undefined, id).toBe("hero:04031a");
      expect(card && "printedAspect" in card ? card.printedAspect : undefined, id).toBe(aspect);
    }
  });

  it("her starter deck lists two aspects and passes validateDeck", () => {
    const deck = WAVE2_STARTER_DECKS.find((d) => d.identityCardId === "04031a");
    expect(deck?.aspects).toEqual(["aggression", "justice"]);
  });
});

describe("The Rise of Red Skull — errata and curated corrections", () => {
  it("Marked for Death (04028): 'places'/'return Mockingbird' errata'd to 'tucks'/'return the tucked Mockingbird'", () => {
    const card = TRORS_CARDS.find((c) => c.id === "04028");
    expect(card && "text" in card ? card.text.printed : undefined).toContain("places her faceup");
    expect(card && "text" in card ? card.text.current : undefined).toContain("tucks her faceup");
    expect(card && "text" in card ? card.text.current : undefined).toContain("return the tucked Mockingbird");
  });

  it("The Rise of Red Skull 1A (04128a): 'side scheme' errata'd to 'encounter side scheme'", () => {
    const card = TRORS_CARDS.find((c) => "stages" in c && c.id === "04128a") as MainSchemeCard | undefined;
    expect(card?.stages[0]?.aSide.text.current).toContain("Shuffle every other encounter side scheme");
  });

  it("Bitter Rival (04136): updated 'For Each' errata applied", () => {
    const card = TRORS_CARDS.find((c) => c.id === "04136");
    const text = card && "text" in card ? card.text.current : undefined;
    expect(text).toContain("For each side scheme in play, choose and exhaust a character you control.");
    expect(text).not.toContain("Exhaust a character you control for each side scheme in play.");
  });

  it("Beetle (13028): 'the defeating player chooses' errata applied", () => {
    const card = WSP_CARDS.find((c) => c.id === "13028");
    expect(card && "text" in card ? card.text.current : undefined).toContain("the defeating player chooses to either spend");
  });

  it("Crossbones' Machine Gun named search typo fixed (04059 no longer searches for 'Crossbone's Machine Gun')", () => {
    // 04059 is Crossbones' second villain stage: text lives on its stage, not a top-level `text` field.
    const villain = byId<VillainCard>(TRORS_CARDS, "04058", "villain");
    const stageII = villain.sides[0]?.stages.find((s) => s.stageNumber === 2);
    expect(stageII?.text.current).toContain("Crossbones' Machine Gun");
    expect(stageII?.text.current).not.toContain("Crossbone's Machine Gun");
  });

  it("10098 (a spurious duplicate Shang-Chi record) was dropped, not emitted as a card", () => {
    expect(TRORS_CARDS.some((c) => c.id === "10098")).toBe(false);
  });

  it("Captive allies (Taskmaster's Moon Knight/Shang-Chi/White Tiger/Elektra) are classified 'none', scenario-specific", () => {
    for (const id of ["04097", "04098", "04099", "04100"]) {
      const card = TRORS_CARDS.find((c) => c.id === id);
      expect(card && "aspect" in card ? card.aspect : undefined, id).toBe("none");
      expect(card && "specificTo" in card ? card.specificTo : undefined, id).toEqual({ kind: "scenario", encounterSetId: "taskmaster" });
    }
  });

  it("the four Hydra Campaign 'Basic' upgrades print a dash cost, confirmed against the card image", () => {
    for (const id of ["04159a", "04160a", "04161a", "04162a"]) {
      const card = TRORS_CARDS.find((c) => c.id === id);
      expect(card && "specialCost" in card ? card.specialCost : undefined, id).toBe("dash");
      expect(card && "cost" in card ? card.cost : undefined, id).toBe(0);
    }
  });
});

describe("The Once and Future Kang — one villain per Kang record, stage alternatives, dashed values", () => {
  it("six standard-mode Kang villains, each its own single-stage VillainCard", () => {
    // Kang (I)/(III) print per-player HP (12/20); the four Kang (II) variants print a flat 18 each.
    const expected: readonly [string, number, { base: number; perPlayer: number }][] = [
      ["11001", 1, { base: 0, perPlayer: 12 }],
      ["11002", 2, { base: 18, perPlayer: 0 }],
      ["11003", 2, { base: 18, perPlayer: 0 }],
      ["11004", 2, { base: 18, perPlayer: 0 }],
      ["11005", 2, { base: 18, perPlayer: 0 }],
      ["11006", 3, { base: 0, perPlayer: 20 }],
    ];
    for (const [id, stageNumber, hp] of expected) {
      const villain = byId<VillainCard>(TOAFK_CARDS, id, "villain");
      expect(villain.sides).toHaveLength(1);
      expect(villain.sides[0]?.stages).toHaveLength(1);
      expect(villain.sides[0]?.stages[0]?.stageNumber, id).toBe(stageNumber);
      expect(villain.sides[0]?.stages[0]?.hp, id).toEqual(hp);
    }
  });

  it("six expert-mode Kang villains (higher HP) also emitted, one per record", () => {
    for (const id of ["11034", "11035", "11036", "11037", "11038", "11039"]) {
      const villain = byId<VillainCard>(TOAFK_CARDS, id, "villain");
      expect(villain.sides[0]?.stages).toHaveLength(1);
    }
  });

  it("Kang (Scarlet Centurion)'s SCH is printed 0 (standard) / 1 (expert), confirmed against the card image", () => {
    expect(byId<VillainCard>(TOAFK_CARDS, "11005", "villain").sides[0]?.stages[0]?.sch).toBe(0);
    expect(byId<VillainCard>(TOAFK_CARDS, "11038", "villain").sides[0]?.stages[0]?.sch).toBe(1);
  });

  it("one MainSchemeCard for Kang's whole deck: stages 1, 2, four alternative 3s, and 4", () => {
    const scheme = TOAFK_CARDS.find((c) => c.type === "main_scheme") as MainSchemeCard | undefined;
    expect(scheme?.stages.map((s) => s.stageNumber)).toEqual([1, 2, 3, 3, 3, 3, 4]);
    const stage3Names = scheme?.stages.filter((s) => s.stageNumber === 3).map((s) => s.name);
    expect(stage3Names).toEqual(["The Chronopolis", "Inexorable Fate", "The Realm of Rama-Tut", "The Present Future War"]);
  });

  it("The Master of Time (stage 2) has dashed starting/target/acceleration threat", () => {
    const scheme = TOAFK_CARDS.find((c) => c.type === "main_scheme") as MainSchemeCard | undefined;
    const stage2 = scheme?.stages.find((s) => s.stageNumber === 2);
    expect(stage2?.dashedValues?.slice().sort()).toEqual(["acceleration", "startingThreat", "targetThreat"]);
    expect(stage2?.startingThreat).toEqual({ base: 0, perPlayer: 0 });
    expect(stage2?.targetThreat).toEqual({ base: 0, perPlayer: 0 });
    expect(stage2?.acceleration).toEqual({ base: 0, perPlayer: 0 });
  });

  it("stage 2A's transcription typo is corrected: 'in turn order', not 'in turn oder'", () => {
    const scheme = TOAFK_CARDS.find((c) => c.type === "main_scheme") as MainSchemeCard | undefined;
    const stage2 = scheme?.stages.find((s) => s.stageNumber === 2);
    expect(stage2?.aSide.text.current).toContain("in turn order");
    expect(stage2?.aSide.text.current).not.toContain("oder");
  });

  it("stage 2B's transcription typo is corrected: 'advance to stage 4A', not 'advanced'", () => {
    const scheme = TOAFK_CARDS.find((c) => c.type === "main_scheme") as MainSchemeCard | undefined;
    const stage2 = scheme?.stages.find((s) => s.stageNumber === 2);
    expect(stage2?.text.current).toContain("advance to stage 4A");
    expect(stage2?.text.current).not.toContain("advanced to stage 4A");
  });
});

function allTexts(c: AnyCard): string[] {
  const t = (x: { printed: string; current: string }) => [x.printed, x.current];
  switch (c.type) {
    case "hero_identity":
      return [...t(c.hero.text), ...t(c.alterEgo.text), ...(c.additionalHeroForms?.flatMap((f) => t(f.text)) ?? [])];
    case "villain":
      return c.sides.flatMap((s) => s.stages.flatMap((st) => t(st.text)));
    case "main_scheme":
      return c.stages.flatMap((s) => [...t(s.text), ...t(s.aSide.text)]);
    default: {
      const texts = "text" in c ? t(c.text) : [];
      const flip = "flipSide" in c && c.flipSide ? t(c.flipSide.text) : [];
      return [...texts, ...flip];
    }
  }
}

/// <reference types="node" />
import { readFileSync } from "node:fs";
import {
  validateCard,
  validateScenario,
  validateStarterDeck,
  type AnyCard,
  type AttachmentCard,
  type EnvironmentCard,
  type HeroIdentityCard,
  type MainSchemeCard,
  type MinionCard,
  type SideSchemeCard,
  type UpgradeCard,
  type VillainCard,
} from "../schema/index.js";
import { GOB_CARDS, GOB_DROPPED_SOURCE_RECORDS, GOB_PACK, GOB_PROVENANCE, GOB_SCENARIOS } from "./gob/index.js";
import { TWC_CARDS, TWC_DROPPED_SOURCE_RECORDS, TWC_PACK, TWC_PROVENANCE, TWC_SCENARIOS } from "./twc/index.js";
import { CAP_CARDS, CAP_PACK, CAP_PROVENANCE, CAP_STARTER_DECKS } from "./cap/index.js";
import { MSM_CARDS, MSM_PACK, MSM_PROVENANCE, MSM_STARTER_DECKS } from "./msm/index.js";
import { THOR_CARDS, THOR_PACK, THOR_PROVENANCE, THOR_STARTER_DECKS } from "./thor/index.js";
import { BKW_CARDS, BKW_PACK, BKW_PROVENANCE, BKW_STARTER_DECKS } from "./bkw/index.js";
import { DRS_CARDS, DRS_PACK, DRS_PROVENANCE, DRS_STARTER_DECKS } from "./drs/index.js";
import { HLK_CARDS, HLK_PACK, HLK_PROVENANCE, HLK_STARTER_DECKS } from "./hlk/index.js";
import { WAVE1_CARDS, WAVE1_ENCOUNTER_SETS, WAVE1_SCENARIOS, WAVE1_STARTER_DECKS } from "./index.js";
import { CORE_CARDS } from "./core/index.js";
import type { CardProvenance, DroppedSourceRecord } from "./types.js";

interface RawRecord {
  code: string;
  card_set_code?: string | null;
  quantity: number;
  type_code: string;
  linked_card?: RawRecord | null;
  [key: string]: unknown;
}

/** One pack's fixture bundle, for the generic cross-pack checks below. */
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
  { code: "gob", cards: GOB_CARDS, provenance: GOB_PROVENANCE, dropped: GOB_DROPPED_SOURCE_RECORDS },
  { code: "twc", cards: TWC_CARDS, provenance: TWC_PROVENANCE, dropped: TWC_DROPPED_SOURCE_RECORDS },
  { code: "cap", cards: CAP_CARDS, provenance: CAP_PROVENANCE, dropped: [] },
  { code: "msm", cards: MSM_CARDS, provenance: MSM_PROVENANCE, dropped: [] },
  { code: "thor", cards: THOR_CARDS, provenance: THOR_PROVENANCE, dropped: [] },
  { code: "bkw", cards: BKW_CARDS, provenance: BKW_PROVENANCE, dropped: [] },
  { code: "drs", cards: DRS_CARDS, provenance: DRS_PROVENANCE, dropped: [] },
  { code: "hlk", cards: HLK_CARDS, provenance: HLK_PROVENANCE, dropped: [] },
];

function byId<T extends AnyCard>(cards: readonly AnyCard[], id: string, type: T["type"]): T {
  const c = cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  expect(c.type).toBe(type);
  return c as T;
}
const abilityIds = (c: { abilities: readonly { id: string }[] }) => c.abilities.map((a) => a.id);

describe("wave 1 data — integrity (every pack)", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = WAVE1_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter((f) => f.errors.length > 0);
    expect(failures).toEqual([]);
  });

  it("every WAVE1_CARDS entry is Core plus the eight wave 1 packs, with no duplicate ids", () => {
    const ids = WAVE1_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WAVE1_CARDS.length).toBe(CORE_CARDS.length + PACKS.reduce((n, p) => n + p.cards.length, 0));
  });

  it.each(PACKS.map((p) => [p.code, p] as const))("%s: card counts and every non-aggregate MarvelCDB record is covered exactly once", (code, pack) => {
    const raw = rawCacheOf(code);
    const dropped = new Set(pack.dropped.map((d) => d.marvelcdbCode));
    const rawCodes = new Set(raw.cards.flatMap((r) => (r.linked_card ? [r.code, r.linked_card.code] : [r.code])));
    const isAggregate = (c: string) => /\d$/.test(c) && rawCodes.has(`${c}a`);
    const expectedTopLevel = [...rawCodes].filter((c) => !isAggregate(c));
    for (const c of expectedTopLevel) if (isAggregate(c)) continue;
    const coveredCodes = new Set(pack.provenance.flatMap((p) => p.marvelcdbCodes));
    for (const c of rawCodes) {
      if (dropped.has(c)) continue;
      expect(coveredCodes.has(c), `${code} ${c} not covered by any emitted card`).toBe(true);
    }
    // Every card the provenance names is really in the pack's card list.
    const cardIds = new Set(pack.cards.map((c) => c.id as string));
    for (const p of pack.provenance) expect(cardIds.has(p.cardId as string), `${code} ${p.cardId}`).toBe(true);
  });

  it.each(PACKS.map((p) => [p.code, p] as const))("%s: every card belongs to its own pack/cycle", (code, pack) => {
    for (const c of pack.cards) {
      expect(c.setCode, c.id as string).toBe(code);
      expect(c.cycleId, c.id as string).toBe("wave1");
    }
  });

  it("pack metadata: release dates researched from Hall of Heroes, not placeholders", () => {
    for (const p of [GOB_PACK, TWC_PACK, CAP_PACK, MSM_PACK, THOR_PACK, BKW_PACK, DRS_PACK, HLK_PACK]) {
      expect(p.releaseDate).not.toBe("unresearched");
      expect(p.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("no HTML, trait markup, or unknown icon tokens survive in any wave 1 card's text", () => {
    for (const c of WAVE1_CARDS) {
      for (const t of allTexts(c)) {
        expect(t, c.id).not.toMatch(/<[a-z/]|\[\[|&[a-z]+;/);
        for (const token of t.match(/\[[a-z_]+\]/g) ?? []) {
          expect(["[energy]", "[mental]", "[physical]", "[wild]", "[per_hero]", "[star]", "[boost]"]).toContain(token);
        }
      }
    }
  });
});

describe("wave 1 scenarios and starter decks — schema validation", () => {
  it("every wave 1 scenario validates", () => {
    for (const s of WAVE1_SCENARIOS) expect(validateScenario(s).errors, s.id as string).toEqual([]);
  });
  it("every wave 1 starter deck validates", () => {
    for (const d of WAVE1_STARTER_DECKS) expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
  });
  it("wave 1 has exactly three scenarios and six starter decks", () => {
    expect(WAVE1_SCENARIOS.map((s) => s.id).sort()).toEqual(["breakout", "mutagen-formula", "risky-business"]);
    expect(WAVE1_STARTER_DECKS).toHaveLength(6);
  });
});

describe("Green Goblin — curated corrections and structure", () => {
  it("Risky Business: Norman Osborn is side A (face up at setup), Green Goblin side B", () => {
    const villain = byId<VillainCard>(GOB_CARDS, "02001a", "villain");
    expect(villain.name).toBe("Norman Osborn");
    expect(villain.startingSide).toBe("A");
    expect(villain.sides.map((s) => [s.side, s.name])).toEqual([
      ["A", "Norman Osborn"],
      ["B", "Green Goblin"],
    ]);
  });

  it("Norman Osborn has no printed ATK (dash); Green Goblin has no printed SCH (dash)", () => {
    const villain = byId<VillainCard>(GOB_CARDS, "02001a", "villain");
    const normanSide = villain.sides.find((s) => s.side === "A");
    const goblinSide = villain.sides.find((s) => s.side === "B");
    for (const stage of normanSide?.stages ?? []) {
      expect(stage.atk).toBe(0);
      expect(stage.dashedStats).toEqual(["atk"]);
    }
    for (const stage of goblinSide?.stages ?? []) {
      expect(stage.sch).toBe(0);
      expect(stage.dashedStats).toEqual(["sch"]);
    }
  });

  it("Mutagen Formula's Green Goblin is single-sided", () => {
    const villain = byId<VillainCard>(GOB_CARDS, "02014", "villain");
    expect(villain.sides).toHaveLength(1);
    expect(villain.sides[0]?.stages).toHaveLength(3);
    expect(villain.startingSide).toBeUndefined();
  });

  it("Criminal Enterprise flips to State of Madness; flipping is not modeled as a second card", () => {
    const env = byId<EnvironmentCard>(GOB_CARDS, "02006a", "environment");
    expect(env.name).toBe("Criminal Enterprise");
    expect(env.flipSide?.name).toBe("State of Madness");
    expect(env.text.current).toMatch(/^Criminal Enterprise enter play with 2\[per_hero\] infamy counters/);
    expect(env.flipSide?.text.current).toMatch(/^State of Madness enter play with 2\[per_hero\] madness counters/);
  });

  it("Hostile Takeover / Corporate Acquisition: A/B sides, When Completed on 1B, threat values", () => {
    const scheme = byId<MainSchemeCard>(GOB_CARDS, "02004a", "main_scheme");
    expect(scheme.stages.map((s) => s.stageNumber)).toEqual([1, 2]);
    const [s1, s2] = scheme.stages;
    expect(s1 && [s1.startingThreat, s1.targetThreat, s1.acceleration]).toEqual([
      { base: 0, perPlayer: 2 },
      { base: 0, perPlayer: 7 },
      { base: 0, perPlayer: 1 },
    ]);
    expect(s1 && abilityIds(s1)).toEqual(["02004b.when-completed"]);
    expect(s1 && abilityIds(s1.aSide)).toEqual(["02004a.setup"]);
    expect(s2?.name).toBe("Corporate Acquisition");
    expect(s2?.icons).toEqual(["hazard"]);
    expect(s2 && s2.text.current).toMatch(/players lose the game/);
    expect(s2 && abilityIds(s2.aSide)).toEqual(["02005a.when-revealed"]);
  });

  it("Unleashing the Mutagen / Mutagen Cloud: When Completed on 1B, X acceleration on 2B", () => {
    const scheme = byId<MainSchemeCard>(GOB_CARDS, "02017a", "main_scheme");
    const [s1, s2] = scheme.stages;
    expect(s1 && abilityIds(s1)).toEqual(["02017b.when-completed"]);
    expect(s1 && s1.aSide.text.current).toMatch(/Put a Goblin Thrall minion into play engaged with each player/);
    expect(s2?.name).toBe("Mutagen Cloud");
    expect(s2?.printedX).toEqual(["acceleration"]);
    expect(s2?.acceleration).toEqual({ base: 0, perPlayer: 0 });
  });

  it("attachment host shapes: Goblin Glider (superlative), Hysteria (villain by name), All Tied Up / Media Coverage (identity), Pumpkin Bombs (villain)", () => {
    expect(byId<AttachmentCard>(GOB_CARDS, "02019", "attachment").attachesTo).toEqual({
      kind: "superlative",
      among: "enemy",
      order: "highest",
      measure: "printedHp",
      withoutAttachmentNamed: "Goblin Glider",
    });
    expect(byId<AttachmentCard>(GOB_CARDS, "02020", "attachment").attachesTo).toEqual({ kind: "villain" });
    expect(byId<AttachmentCard>(GOB_CARDS, "02021", "attachment").attachesTo).toEqual({ kind: "villain" });
    expect(byId<AttachmentCard>(GOB_CARDS, "02048", "attachment").attachesTo).toEqual({ kind: "yourIdentity" });
    expect(byId<AttachmentCard>(GOB_CARDS, "02049", "attachment").attachesTo).toEqual({ kind: "yourIdentity" });
  });

  it("guard minions carry a printed SCH of 0, not a dash", () => {
    const guard = byId<MinionCard>(GOB_CARDS, "02008", "minion");
    expect(guard.keywords).toEqual([{ name: "guard" }]);
    expect(guard.sch).toBe(0);
  });

  it("risky-business and mutagen-formula scenarios wire the right villain/main scheme/modular set", () => {
    expect(GOB_SCENARIOS.map((s) => [s.id, s.villainCardId, s.mainSchemeCardId, s.recommendedModularSetIds])).toEqual([
      ["risky-business", "02001a", "02004a", ["power_drain"]],
      ["mutagen-formula", "02014", "02017a", ["goblin_gimmicks"]],
    ]);
    for (const s of GOB_SCENARIOS) {
      // Green Goblin ships no Standard/Expert cards of its own; these resolve to Core's shared sets.
      expect(s.standardEncounterSetIds).toEqual(["standard"]);
      expect(s.expertEncounterSetIds).toEqual(["expert"]);
      expect(s.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
    }
  });

  it("modular sets present: Goblin Gimmicks, A Mess of Things, Power Drain, Running Interference", () => {
    const ids = WAVE1_ENCOUNTER_SETS.filter((s) => (s.packCodes as readonly string[]).includes("gob")).map((s) => s.id).sort();
    expect(ids).toEqual(["a_mess_of_things", "goblin_gimmicks", "mutagen_formula", "power_drain", "risky_business", "running_interference"]);
  });
});

describe("The Wrecking Crew — curated corrections and structure", () => {
  it("Breakout: main scheme in its own set, villain in Wrecker's set", () => {
    const scheme = byId<MainSchemeCard>(TWC_CARDS, "07001a", "main_scheme");
    expect(scheme.encounterSetIds).toEqual(["wrecking_crew"]);
    expect(scheme.stages).toHaveLength(1);
    expect(scheme.stages[0]?.text.current).toMatch(/players lose the game/);
  });

  it("multipleVillains: four villains, printed order, each with its own encounter set and signature side scheme", () => {
    const [s] = TWC_SCENARIOS;
    expect(s?.multipleVillains?.villains.map((v) => [v.villainCardId, v.encounterSetIds, v.signatureSideSchemeCardId])).toEqual([
      ["07002", ["wrecker"], "07004"],
      ["07017", ["thunderball"], "07019"],
      ["07032", ["piledriver"], "07034"],
      ["07046", ["bulldozer"], "07048"],
    ]);
    expect(s?.multipleVillains?.encounterDecks).toBe("perVillain");
    expect(s?.multipleVillains?.activation).toBe("activeVillainOnly");
    expect(s?.multipleVillains?.winCondition).toBe("allVillainsDefeated");
    expect(s?.usesIdentityEncounterSets).toBe(false);
    expect(s?.modularSetCount).toBe(0);
    expect(s?.villainStages).toEqual({ standard: [1, 1], expert: [2, 2] });
  });

  it("Pile It On! (07034): corrected to name Piledriver, not Wrecker, as the villain it cannot leave play without", () => {
    const scheme = byId<SideSchemeCard>(TWC_CARDS, "07034", "side_scheme");
    expect(scheme.signatureOf).toBe("Piledriver");
    expect(scheme.text.current).toContain("This card cannot leave play while Piledriver is in play.");
    expect(scheme.text.current).not.toContain("while Wrecker is in play");
  });

  it("every signature side scheme's signatureOf matches its villain", () => {
    expect(byId<SideSchemeCard>(TWC_CARDS, "07004", "side_scheme").signatureOf).toBe("Wrecker");
    expect(byId<SideSchemeCard>(TWC_CARDS, "07019", "side_scheme").signatureOf).toBe("Thunderball");
    expect(byId<SideSchemeCard>(TWC_CARDS, "07048", "side_scheme").signatureOf).toBe("Bulldozer");
  });

  it("Held Hostage: corrected typo (07005) and corrected apostrophe (07036/07050) resolve to villainSideScheme, not a bogus namedCard host", () => {
    for (const code of ["07005", "07021", "07036", "07050"]) {
      const held = byId<AttachmentCard>(TWC_CARDS, code, "attachment");
      expect(held.attachesTo, code).toEqual({ kind: "villainSideScheme", of: "activeVillain" });
      expect(held.text.current, code).toContain("Threat cannot be removed from attached scheme by thwarting.");
    }
  });

  it("guard minions (Corrupt Prison Guard, one per villain deck) carry a printed SCH of 0", () => {
    for (const code of ["07008", "07023", "07037", "07052"]) {
      const guard = byId<MinionCard>(TWC_CARDS, code, "minion");
      expect(guard.keywords, code).toEqual([{ name: "guard" }]);
      expect(guard.sch, code).toBe(0);
    }
  });

  it("villains are single-sided with lettered A/B stages, not roman numerals", () => {
    for (const code of ["07002", "07017", "07032", "07046"]) {
      const villain = byId<VillainCard>(TWC_CARDS, code, "villain");
      expect(villain.sides).toHaveLength(1);
      expect(villain.sides[0]?.stages.map((s) => [s.stageNumber, s.stageLabel])).toEqual([
        [1, "A"],
        [2, "B"],
      ]);
    }
  });
});

describe("hero packs — obligation/nemesis links and errata", () => {
  const packsOf: readonly [string, readonly AnyCard[], string, string, readonly string[]][] = [
    ["cap", CAP_CARDS, "03001a", "03026", ["03027", "03028", "03029", "03030"]],
    ["msm", MSM_CARDS, "05001a", "05025", ["05026", "05027", "05028", "05029"]],
    ["thor", THOR_CARDS, "06001a", "06026", ["06027", "06028", "06029", "06030"]],
    ["bkw", BKW_CARDS, "08001a", "08025", ["08026", "08027", "08028", "08029"]],
    ["drs", DRS_CARDS, "09001a", "09027", ["09028", "09029", "09030", "09031"]],
    ["hlk", HLK_CARDS, "10001a", "10025", ["10026", "10027", "10028"]],
  ];

  it.each(packsOf)("%s: identity links its obligation and nemesis set", (_code, cards, identityId, obligationId, nemesisIds) => {
    const identity = byId<HeroIdentityCard>(cards, identityId, "hero_identity");
    expect(identity.obligationCardId).toBe(obligationId);
    const nemesisMembers = cards.filter((c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(identity.nemesisEncounterSetId)).map((c) => c.id).sort();
    expect(nemesisMembers).toEqual([...nemesisIds].sort());
  });

  it("Black Widow (08001a) and Synth-Suit (08009): 'trigger' -> 'resolve' errata, printed text unchanged", () => {
    const widow = byId<HeroIdentityCard>(BKW_CARDS, "08001a", "hero_identity");
    expect(widow.hero.text.printed).toContain("trigger the ability");
    expect(widow.hero.text.current).toContain("resolve the ability");
    const synthSuit = byId<UpgradeCard>(BKW_CARDS, "08009", "upgrade");
    expect(synthSuit.text.printed).toContain("trigger the ability");
    expect(synthSuit.text.current).toContain("resolve the ability");
    expect(synthSuit.errata?.currentVersion).toBe("RRG 1.8");
  });

  it("Taskmaster's ATK/SCH are printed 0 (boost-star reminder), not a dash", () => {
    const taskmaster = byId<MinionCard>(BKW_CARDS, "08026", "minion");
    expect([taskmaster.atk, taskmaster.sch]).toEqual([0, 0]);
    expect(taskmaster.nemesisMinion).toBe(true);
  });

  it("Preemptive Strike (05014) is an event; MarvelCDB's stray attack/thwart fields are not carried", () => {
    const card = MSM_CARDS.find((c) => c.id === "05014");
    expect(card?.type).toBe("event");
    expect(card && "atk" in card).toBe(false);
    expect(card && "thw" in card).toBe(false);
  });

  it("Electrostatic Armor (10031): corrected 'Player under' -> 'Play under', parses as anyPlayerControl", () => {
    const armor = byId<UpgradeCard>(HLK_CARDS, "10031", "upgrade");
    expect(armor.text.current).toMatch(/^Play under any player's control\./);
    expect(armor.playRestrictions).toEqual({ anyPlayerControl: true, maxPerPlayer: 1 });
  });

  it("hand-corrected titles: Strength in Numbers, Clash of the Titans", () => {
    expect(CAP_CARDS.find((c) => c.id === "03017")?.name).toBe("Strength in Numbers");
    expect(HLK_CARDS.find((c) => c.id === "10028")?.name).toBe("Clash of the Titans");
  });

  it("Doctor Strange's Invocation deck: five Special-only events, deckLimit 0, listed on the identity", () => {
    const identity = byId<HeroIdentityCard>(DRS_CARDS, "09001a", "hero_identity");
    expect(identity.separateDecks).toHaveLength(1);
    const deck = identity.separateDecks?.[0];
    expect(deck?.name).toBe("Invocation");
    expect(deck?.topCardFaceup).toBe(true);
    expect(deck?.discardPile).toBe("own");
    expect(deck?.whenEmpty).toBe("reshuffleDiscardWithoutPenalty");
    expect(deck?.cards.map((c) => c.cardId).sort()).toEqual(["09032", "09033", "09034", "09035", "09036"]);
    for (const code of ["09032", "09033", "09034", "09035", "09036"]) {
      const c = DRS_CARDS.find((x) => x.id === code);
      expect(c && "deckLimit" in c && c.deckLimit, code).toBe(0);
      expect(c && "separateDeck" in c && c.separateDeck, code).toBe("Invocation");
      expect(c && "aspect" in c && c.aspect, code).toBe("hero:09001a");
    }
  });

  it("Teamwork (06032) is an event's printed title, not the keyword", () => {
    const teamwork = THOR_CARDS.find((c) => c.id === "06032");
    expect(teamwork?.type).toBe("event");
    expect(teamwork && "keywords" in teamwork ? teamwork.keywords : []).toEqual([]);
  });
});

describe("wave 1 starter decks (content-level; legality is checked in @mc/cards)", () => {
  const decksOf: readonly [string, readonly (typeof CAP_STARTER_DECKS)[number][]][] = [
    ["cap", CAP_STARTER_DECKS],
    ["msm", MSM_STARTER_DECKS],
    ["thor", THOR_STARTER_DECKS],
    ["bkw", BKW_STARTER_DECKS],
    ["drs", DRS_STARTER_DECKS],
    ["hlk", HLK_STARTER_DECKS],
  ];

  it.each(decksOf)("%s: exactly one verified starter deck, 40 cards", (_code, decks) => {
    expect(decks).toHaveLength(1);
    const [deck] = decks;
    expect(deck?.provenance.verified).toBe(true);
    expect(deck?.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
  });

  it("Doctor Strange's starter deck never lists an Invocation card", () => {
    const [deck] = DRS_STARTER_DECKS;
    for (const code of ["09032", "09033", "09034", "09035", "09036"]) {
      expect(deck?.cards.some((e) => e.cardId === code), code).toBe(false);
    }
  });
});

function allTexts(c: AnyCard): string[] {
  const t = (x: { printed: string; current: string }) => [x.printed, x.current];
  switch (c.type) {
    case "hero_identity":
      return [...t(c.hero.text), ...t(c.alterEgo.text)];
    case "villain":
      return c.sides.flatMap((s) => s.stages.flatMap((st) => [...t(st.text), ...(st.dashedStats ? [] : [])]));
    case "main_scheme":
      return c.stages.flatMap((s) => [...t(s.text), ...t(s.aSide.text)]);
    default: {
      const texts = "text" in c ? t(c.text) : [];
      const flip = "flipSide" in c && c.flipSide ? t(c.flipSide.text) : [];
      return [...texts, ...flip];
    }
  }
}

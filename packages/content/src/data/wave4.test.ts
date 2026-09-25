import { validateCard, validateScenario, validateScenarioEncounterSets, validateStarterDeck } from "../schema/index.js";
import type { AnyCard, HeroIdentityCard } from "../schema/index.js";
import { MTS_CARDS, MTS_PACK } from "./mts/index.js";
import { NEBU_CARDS, NEBU_PACK } from "./nebu/index.js";
import { WARM_CARDS, WARM_PACK } from "./warm/index.js";
import { VISION_CARDS, VISION_PACK } from "./vision/index.js";
import { HOOD_CARDS, HOOD_PACK } from "./hood/index.js";
import { VALK_CARDS, VALK_PACK } from "./valk/index.js";
import { WAVE4_CARDS, WAVE4_ENCOUNTER_SETS, WAVE4_SCENARIOS, WAVE4_STARTER_DECKS, PLAYABLE_CARDS } from "./index.js";
import { CORE_CARDS } from "./core/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { poolVersionOf } from "./pool-version.js";

interface PackFixture {
  readonly code: string;
  readonly cards: readonly AnyCard[];
}

const PACKS: readonly PackFixture[] = [
  { code: "mts", cards: MTS_CARDS },
  { code: "nebu", cards: NEBU_CARDS },
  { code: "warm", cards: WARM_CARDS },
  { code: "vision", cards: VISION_CARDS },
  { code: "hood", cards: HOOD_CARDS },
  { code: "valk", cards: VALK_CARDS },
];

describe("wave 4 (cycle 3) data — integrity (every pack)", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = WAVE4_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("every WAVE4_CARDS entry is Core plus the six cycle 3 packs, with no duplicate ids", () => {
    const ids = WAVE4_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WAVE4_CARDS.length).toBe(CORE_CARDS.length + PACKS.reduce((n, p) => n + p.cards.length, 0));
  });

  it.each(PACKS.map((p) => [p.code, p] as const))("%s: every card belongs to its own pack", (code, pack) => {
    for (const c of pack.cards) expect(c.setCode, c.id as string).toBe(code);
  });

  it("pack metadata: release dates researched from Hall of Heroes, not placeholders", () => {
    for (const p of [MTS_PACK, NEBU_PACK, WARM_PACK, VISION_PACK, HOOD_PACK, VALK_PACK]) {
      expect(p.releaseDate).not.toBe("unresearched");
      expect(p.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("wave 4 registers encounter sets for every pack, with no duplicate ids", () => {
    const ids = WAVE4_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the wave 4 pool version is deterministic and well-formed, and differs from Core's", () => {
    const v1 = poolVersionOf(WAVE4_CARDS);
    const v2 = poolVersionOf(WAVE4_CARDS);
    expect(v1).toBe(v2);
    expect(v1).toMatch(/^v1-[0-9a-f]{8}$/);
    expect(poolVersionOf(WAVE4_CARDS)).not.toBe(poolVersionOf(CORE_CARDS));
  });

  it("PLAYABLE_CARDS includes wave 4's own cards, with no duplicate ids", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PACKS) for (const c of p.cards) expect(ids).toContain(c.id);
  });
});

describe("The Mad Titan's Shadow and The Hood — six scenarios", () => {
  it("six scenarios: Ebony Maw, Tower Defense, Thanos, Hela, Loki, The Hood", () => {
    expect(WAVE4_SCENARIOS.map((s) => s.id).sort()).toEqual(
      ["ebony-maw", "tower-defense", "thanos", "hela", "loki", "the-hood"].sort(),
    );
  });

  it("every scenario passes validateScenario()", () => {
    for (const s of WAVE4_SCENARIOS) expect(validateScenario(s).errors, s.id as string).toEqual([]);
  });

  it("every scenario's named encounter sets are registered (cycle 3's own plus Core's)", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...WAVE4_ENCOUNTER_SETS];
    for (const s of WAVE4_SCENARIOS) expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
  });

  it("every scenario's villainCardId/mainSchemeCardId resolve to a real card in WAVE4_CARDS", () => {
    const ids = new Set(WAVE4_CARDS.map((c) => c.id as string));
    for (const s of WAVE4_SCENARIOS) {
      expect(ids.has(s.villainCardId as string), `${s.id as string} villain`).toBe(true);
      expect(ids.has(s.mainSchemeCardId as string), `${s.id as string} main scheme`).toBe(true);
    }
  });

  it("Tower Defense is a shared-deck multipleVillains scenario (Proxima Midnight and Corvus Glaive, MC21 p. 10)", () => {
    const scenario = WAVE4_SCENARIOS.find((s) => s.id === "tower-defense");
    expect(scenario?.multipleVillains?.encounterDecks).toBe("shared");
    expect(scenario?.multipleVillains?.villains).toHaveLength(2);
  });

  it("Loki starts a random set-aside villain and carries a card-ability victory count (docs/phase7-wave4.md §3.7)", () => {
    const scenario = WAVE4_SCENARIOS.find((s) => s.id === "loki");
    expect(scenario?.startingVillain).toBe("random");
    expect(scenario?.setAsideVillainCardIds).toHaveLength(4);
    expect(scenario?.victory).toBe("cardAbility");
  });

  it("Hela has its own expert-mode villain card (MC21 p. 20: Hela A / Hela B)", () => {
    const scenario = WAVE4_SCENARIOS.find((s) => s.id === "hela");
    expect(scenario?.expertVillains?.villainCardId).toBeDefined();
  });

  it("The Hood sets aside seven of its own nine modular encounter sets", () => {
    const scenario = WAVE4_SCENARIOS.find((s) => s.id === "the-hood");
    expect(scenario?.setAsideModularSetCount).toBe(7);
  });

  it("nebu, warm, vision and valk (hero packs with no scenario of their own) are not among the scenarios", () => {
    for (const code of ["nebu", "warm", "vision", "valk"]) {
      expect(WAVE4_SCENARIOS.some((s) => s.packCode === code)).toBe(false);
    }
  });
});

describe(
  "wave 4 starter decks — schema validation (content-level; engine deck legality is @mc/engine's/@mc/cards' own " +
    "test, not @mc/content's — it cannot import @mc/engine per the client→cards→engine→content dependency direction)",
  () => {
    it("wave 4 has six starter decks: Spectrum, Adam Warlock, Nebula, War Machine, Vision, Valkyrie", () => {
      expect(WAVE4_STARTER_DECKS).toHaveLength(6);
    });

    it("every wave 4 starter deck validates as a StarterDeck", () => {
      for (const d of WAVE4_STARTER_DECKS) expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
    });

    // Two wave 4 precons deviate from the ordinary 40, each documented in its own `provenance.note` rather than
    // force-fit to 40: Spectrum's printed list is 43 (18 Spectrum + 16 Leadership + 9 Basic, docs/phase7-wave4.md
    // §4 open item), and Vision's is 41 (16 Vision + 17 Protection + 8 Basic, including his own nemesis set).
    const EXPECTED_SIZE: Readonly<Record<string, number>> = { "spectrum-leadership": 43, "vision-protection": 41 };

    it("every precon is verified against a real photographed/printed source, and is 40 cards unless documented otherwise", () => {
      for (const d of WAVE4_STARTER_DECKS) {
        expect(d.provenance.verified, d.id as string).toBe(true);
        expect(d.provenance.sources.length, d.id as string).toBeGreaterThan(0);
        expect(
          d.cards.reduce((n, e) => n + e.quantity, 0),
          d.id as string,
        ).toBe(EXPECTED_SIZE[d.id as string] ?? 40);
      }
    });

    it("every precon includes its identity's own hero-kit cards (aspect hero:<id>, no separateDeck) at their exact printed quantity", () => {
      for (const d of WAVE4_STARTER_DECKS) {
        const identity = WAVE4_CARDS.find((c) => c.id === d.identityCardId) as HeroIdentityCard | undefined;
        expect(identity, d.id as string).toBeDefined();
        if (!identity) continue;
        for (const card of WAVE4_CARDS) {
          const isIdentitySpecific = "aspect" in card && card.aspect === `hero:${identity.id}`;
          const inSeparateDeck = "separateDeck" in card && card.separateDeck !== undefined;
          if (!isIdentitySpecific || inSeparateDeck) continue;
          const listed = d.cards.find((e) => e.cardId === card.id)?.quantity ?? 0;
          expect(listed, `${d.id as string}: ${card.id as string}`).toBe(card.quantityInSet);
        }
      }
    });

    it("every wave 4 precon lists exactly one chosen aspect, except Adam Warlock's own all-four-aspects deck (§1.4)", () => {
      for (const d of WAVE4_STARTER_DECKS) {
        if (d.id === "adam-warlock-all-aspects") {
          expect(d.aspects.slice().sort()).toEqual(["aggression", "justice", "leadership", "protection"]);
          continue;
        }
        expect(d.aspects, d.id as string).toHaveLength(1);
      }
    });
  },
);

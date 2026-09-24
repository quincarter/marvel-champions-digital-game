import { validateCard, validateScenario, validateScenarioEncounterSets, validateStarterDeck } from "../schema/index.js";
import type { AnyCard, HeroIdentityCard } from "../schema/index.js";
import { GMW_CARDS, GMW_PACK } from "./gmw/index.js";
import { STLD_CARDS, STLD_PACK } from "./stld/index.js";
import { GAM_CARDS, GAM_PACK } from "./gam/index.js";
import { DRAX_CARDS, DRAX_PACK } from "./drax/index.js";
import { VNM_CARDS, VNM_PACK } from "./vnm/index.js";
import { RON_CARDS, RON_PACK } from "./ron/index.js";
import { WAVE3_CARDS, WAVE3_ENCOUNTER_SETS, WAVE3_SCENARIOS, WAVE3_STARTER_DECKS, PLAYABLE_CARDS } from "./index.js";
import { CORE_CARDS } from "./core/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { poolVersionOf } from "./pool-version.js";

interface PackFixture {
  readonly code: string;
  readonly cards: readonly AnyCard[];
}

const PACKS: readonly PackFixture[] = [
  { code: "gmw", cards: GMW_CARDS },
  { code: "stld", cards: STLD_CARDS },
  { code: "gam", cards: GAM_CARDS },
  { code: "drax", cards: DRAX_CARDS },
  { code: "vnm", cards: VNM_CARDS },
  { code: "ron", cards: RON_CARDS },
];

describe("wave 3 (cycle 2) data — integrity (every pack)", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = WAVE3_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("every WAVE3_CARDS entry is Core plus the six cycle 2 packs, with no duplicate ids", () => {
    const ids = WAVE3_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WAVE3_CARDS.length).toBe(CORE_CARDS.length + PACKS.reduce((n, p) => n + p.cards.length, 0));
  });

  it.each(PACKS.map((p) => [p.code, p] as const))("%s: every card belongs to its own pack", (code, pack) => {
    for (const c of pack.cards) expect(c.setCode, c.id as string).toBe(code);
  });

  it("pack metadata: release dates researched from Hall of Heroes, not placeholders", () => {
    for (const p of [GMW_PACK, STLD_PACK, GAM_PACK, DRAX_PACK, VNM_PACK, RON_PACK]) {
      expect(p.releaseDate).not.toBe("unresearched");
      expect(p.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("wave 3 registers encounter sets for every pack, with no duplicate ids", () => {
    const ids = WAVE3_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the wave 3 pool version is deterministic and well-formed, and differs from Core's", () => {
    const v1 = poolVersionOf(WAVE3_CARDS);
    const v2 = poolVersionOf(WAVE3_CARDS);
    expect(v1).toBe(v2);
    expect(v1).toMatch(/^v1-[0-9a-f]{8}$/);
    expect(poolVersionOf(WAVE3_CARDS)).not.toBe(poolVersionOf(CORE_CARDS));
  });

  it("PLAYABLE_CARDS includes wave 3's own cards, with no duplicate ids", () => {
    const ids = PLAYABLE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PACKS) for (const c of p.cards) expect(ids).toContain(c.id);
  });
});

describe("The Galaxy's Most Wanted — five scenarios", () => {
  it("five scenarios: Brotherhood of Badoon, Infiltrate the Museum, Escape the Museum, Nebula, Ronan the Accuser", () => {
    expect(WAVE3_SCENARIOS.map((s) => s.id).sort()).toEqual(
      ["brotherhood-of-badoon", "infiltrate-the-museum", "escape-the-museum", "nebula", "ronan-the-accuser"].sort(),
    );
  });

  it("every scenario passes validateScenario()", () => {
    for (const s of WAVE3_SCENARIOS) expect(validateScenario(s).errors, s.id as string).toEqual([]);
  });

  it("every scenario's named encounter sets are registered (cycle 2's own plus Core's)", () => {
    const sets = [...CORE_ENCOUNTER_SETS, ...WAVE3_ENCOUNTER_SETS];
    for (const s of WAVE3_SCENARIOS) expect(validateScenarioEncounterSets(s, sets).errors, s.id as string).toEqual([]);
  });

  it("every scenario's villainCardId/mainSchemeCardId resolve to a real card in WAVE3_CARDS", () => {
    const ids = new Set(WAVE3_CARDS.map((c) => c.id as string));
    for (const s of WAVE3_SCENARIOS) {
      expect(ids.has(s.villainCardId as string), `${s.id as string} villain`).toBe(true);
      expect(ids.has(s.mainSchemeCardId as string), `${s.id as string} main scheme`).toBe(true);
    }
  });

  it("Escape the Museum: standard/expert Collector are each their own one-stage, two-sided VillainCard (wave3 §1.1)", () => {
    const scenario = WAVE3_SCENARIOS.find((s) => s.id === "escape-the-museum");
    expect(scenario?.villainCardId).toBe("16080a");
    expect(scenario?.expertVillains?.villainCardId).toBe("16081a");
    expect(scenario?.villainStages).toEqual({ standard: [1, 1], expert: [1, 1] });
  });

  it("ron (the Kree Fanatic modular set) is not among the scenarios", () => {
    expect(WAVE3_SCENARIOS.some((s) => s.packCode === "ron")).toBe(false);
  });
});

describe(
  "wave 3 starter decks — schema validation (content-level; engine deck legality is @mc/engine's/@mc/cards' own " +
    "test, not @mc/content's — it cannot import @mc/engine per the client→cards→engine→content dependency direction)",
  () => {
    it("wave 3 has six starter decks: Groot, Rocket Raccoon, Star-Lord, Gamora, Drax, Venom", () => {
      expect(WAVE3_STARTER_DECKS).toHaveLength(6);
    });

    it("every wave 3 starter deck validates as a StarterDeck", () => {
      for (const d of WAVE3_STARTER_DECKS) expect(validateStarterDeck(d).errors, d.id as string).toEqual([]);
    });

    it("every precon is exactly 40 cards and verified against a real photographed/printed source", () => {
      for (const d of WAVE3_STARTER_DECKS) {
        expect(d.provenance.verified, d.id as string).toBe(true);
        expect(d.provenance.sources.length, d.id as string).toBeGreaterThan(0);
        expect(
          d.cards.reduce((n, e) => n + e.quantity, 0),
          d.id as string,
        ).toBe(40);
      }
    });

    it("every precon includes its identity's own hero-kit cards (aspect hero:<id>, no separateDeck) at their exact printed quantity", () => {
      for (const d of WAVE3_STARTER_DECKS) {
        const identity = WAVE3_CARDS.find((c) => c.id === d.identityCardId) as HeroIdentityCard | undefined;
        expect(identity, d.id as string).toBeDefined();
        if (!identity) continue;
        for (const card of WAVE3_CARDS) {
          const isIdentitySpecific = "aspect" in card && card.aspect === `hero:${identity.id}`;
          const inSeparateDeck = "separateDeck" in card && card.separateDeck !== undefined;
          if (!isIdentitySpecific || inSeparateDeck) continue;
          const listed = d.cards.find((e) => e.cardId === card.id)?.quantity ?? 0;
          expect(listed, `${d.id as string}: ${card.id as string}`).toBe(card.quantityInSet);
        }
      }
    });

    it("every wave 3 precon lists exactly one chosen aspect, including Gamora's (her Protection/Justice off-aspect allowance cards, wave3 §1.5, are not a second chosen aspect)", () => {
      for (const d of WAVE3_STARTER_DECKS) expect(d.aspects, d.id as string).toHaveLength(1);
      const gamora = WAVE3_STARTER_DECKS.find((d) => d.identityCardId === "18001a");
      expect(gamora?.aspects).toEqual(["aggression"]);
      expect(gamora?.cards.some((e) => e.cardId === "18015")).toBe(true); // First Hit (Protection)
      expect(gamora?.cards.some((e) => e.cardId === "18016")).toBe(true); // Impede (Justice)
    });
  },
);

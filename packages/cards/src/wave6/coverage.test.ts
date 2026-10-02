/**
 * Coverage for the wave 6 (cycle 6) packs (docs/phase7-wave6.md §8), modeled on `../wave4/coverage.test.ts`: which
 * packs are scripted, and, for a pack not started, that nothing of it resolves yet. Starting a pack means: change its
 * `PACK_STATUS` row, add its registry to `PACKS_WITH_OWN_REGISTRIES`, and list any `KNOWN_SKIPPED` refs with a reason.
 */
import {
  CYCLOPS_CARDS,
  GAMBIT_CARDS,
  MOJO_CARDS,
  MUT_GEN_CARDS,
  PHOENIX_CARDS,
  ROGUE_CARDS,
  STORM_CARDS,
  WOLV_CARDS,
  type AnyCard,
} from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { WAVE5_ABILITIES } from "../wave5/index.js";
import { WAVE6_ABILITIES } from "./index.js";
import { CYCLOPS_ABILITIES } from "./cyclops/index.js";
import { MUT_GEN_ABILITIES } from "./mut_gen/index.js";
import { PHOENIX_ABILITIES } from "./phoenix/index.js";
import { abilityRefIds } from "../ability-refs.js";

describe("wave 6 ability registry", () => {
  it("includes every wave 5 (Core through cycle 4) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE5_ABILITIES)) expect(WAVE6_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  mut_gen: "in progress",
  cyclops: "in progress",
  phoenix: "in progress",
  wolv: "not started",
  storm: "not started",
  gambit: "not started",
  rogue: "not started",
  mojo: "not started",
};

/** Refs a started pack deliberately leaves unscripted, each with its written reason. Pinned exactly. */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {
  mut_gen: [
    // Boom Boom (32090): "deal 2 damage to each enemy for each bomb counter removed from it" needs an amount that is
    // read per target (`dealDamage` computes one amount for every target); no docs/phase7-wave6.md §3 row names it.
    "32090.boom-boom-response",
    // Titanium Muscles (32005): "generate a [physical] resource for each tough status card on Colossus" counts status
    // cards, but `generatesPerCard` counts cards in play matching a query and Colossus can hold two tough cards; no
    // value reads a status count (docs/phase7-wave6.md §4.1 table row "Generate a [physical] resource for each tough
    // status card on Colossus" names only wave 4 §3.38, which cannot express it). Needs a new §3 row.
    "32005.titanium-muscles-resource",
    // Role upgrades (`mut_gen/role-upgrades.ts`):
    // Compassion (32182, 32192): "heal 3 damage from among characters you control" divides a heal; `divide` takes
    // damage, threat or status cards only. No §3 row names it.
    "32182.compassion-response",
    "32192.compassion-response",
    // Determined Defense (32189): "that attack removes threat from the main scheme instead of dealing damage" (a
    // "(thwart)" replacement of an attack's damage) has no primitive and no §3 row.
    "32189.determined-defense-constant",
  ],
};

/**
 * A pack scripted one encounter set at a time ("in progress" with no pack-wide list to pin) checks only the cards of
 * the sets already scripted, each against its own `KNOWN_SKIPPED` entry. `mut_gen`: the Project Wideawake set (its
 * Captive allies and Jubilee are scenario-specific cards with no set of their own), the Sabretooth set (Robert Kelly is the same kind of card), the Master Mold set (Magneto 172B, which its Setup
 * puts into play, is a campaign-set card scripted with the campaign) and Operation Zero Tolerance (32104, the Zero
 * Tolerance set's card that scenario is built around). Add a set's name here when its module is registered.
 */
const SCRIPTED_SETS: Readonly<
  Record<string, { readonly sets: readonly string[]; readonly cardIds: readonly string[] }>
> = {
  mut_gen: {
    sets: [
      "project_wideawake",
      "sabretooth",
      "master_mold",
      "mansion_attack",
      "brotherhood",
      "magneto_villain",
      "acolytes",
      "mystique",
      "sentinels",
      "colossus_nemesis",
      "zero_tolerance",
      "future_past",
    ],
    // 32001a: Colossus's identity, events 32007-32010, obligation 32025 (his nemesis set is `colossus_nemesis`) and his supports, upgrades and allies.
    cardIds: [
      "32104",
      "32001a",
      "32007",
      "32008",
      "32009",
      "32010",
      "32025",
      // Colossus's supports, upgrades and allies.
      "32002",
      "32003",
      "32004",
      "32005",
      "32006",
      "32011",
      "32012",
      "32013",
      "32019",
      "32020",
      // Shadowcat's identity and Solid / Phased mass form (her folder: the rest not started).
      "32030a",
      "32031a",
      // Shadowcat's events (32037-32040), Team Strike (32045) and Toe to Toe (32046).
      "32037",
      "32038",
      "32039",
      "32040",
      "32045",
      "32046",
      // Shadowcat's supports, upgrades and allies, and Aggressive Energy.
      "32032",
      "32033",
      "32034",
      "32035",
      "32036",
      "32041",
      "32042",
      "32043",
      "32044",
      "32047",
      "32048",
      "32049",
      // Shadowcat's obligation and Hellfire Club nemesis set.
      "32055",
      "32056",
      "32057",
      "32058",
      "32059",
      // The precon aspect and basic cards no hero folder owns (`mut_gen/precon-player-cards.ts`).
      "32014",
      "32015",
      "32016",
      "32017",
      "32018",
      "32021",
      "32050",
      "32051",
      // The campaign cards 171A/B-175A/B (`mut_gen/campaign-cards.ts`); 171B and 172B are in no encounter set.
      "32171a",
      "32171b",
      "32172a",
      "32172b",
      "32173a",
      "32173b",
      "32174a",
      "32174b",
      "32175a",
      "32175b",
      // The role upgrades 32176-32195 (`mut_gen/role-upgrades.ts`); the campaign alone deals them.
      ...Array.from({ length: 20 }, (_, index) => String(32176 + index)),
    ],
  },
  // Cyclops: identity, events, supports/upgrades/allies, obligation and Mister Sinister nemesis set.
  // Phoenix: her identity and Phoenix Force (34001a, 34002a); everything else not started.
  phoenix: {
    sets: [],
    cardIds: [
      "34001a",
      "34002a",
      // Her events (`phoenix/phoenix/events.ts`).
      "34010",
      "34011",
      "34012",
      "34013",
      "34017",
      "34018",
      "34019",
      "34023",
      "34032",
      "34033",
      "34034",
      "34035",
      // Her supports, upgrades and allies (`phoenix/phoenix/support-upgrades-allies.ts`).
      "34003",
      "34004",
      "34005",
      "34006",
      "34007",
      "34008",
      "34009",
      "34014",
      "34015",
      "34016",
      "34021",
      "34022",
      "34024",
    ],
  },
  cyclops: {
    sets: ["cyclops_nemesis"],
    cardIds: [
      "33001a",
      // His obligation, Lost Visor (`cyclops/cyclops/obligation-nemesis.ts`; the nemesis set is `cyclops_nemesis`).
      "33027",
      // His signature events: Full Blast, Ricochet Beam, Tactical Brilliance (`cyclops/cyclops/events.ts`).
      "33008",
      "33009",
      "33010",
      // His supports, upgrades and allies (`cyclops/cyclops/support-upgrades-allies.ts`).
      "33002",
      "33003",
      "33004",
      "33005",
      "33006",
      "33007",
      "33011",
      "33012",
      "33013",
      "33014",
      "33015",
      "33016",
      "33019",
      "33020",
      "33021",
      "33032",
      "33033",
      "33034",
      "33035",
      // The aspect and basic events no hero folder owns (`cyclops/precon-player-cards.ts`).
      "33017",
      "33018",
      "33022",
    ],
  },
};
const inScriptedSets = (code: string, card: AnyCard): boolean => {
  const scope = SCRIPTED_SETS[code];
  if (!scope) return true;
  if (scope.cardIds.includes(card.id)) return true;
  const sets: readonly string[] = "encounterSetIds" in card && card.encounterSetIds ? card.encounterSetIds : [];
  const own =
    "specificTo" in card && card.specificTo?.kind === "scenario" ? [card.specificTo.encounterSetId as string] : [];
  return [...sets, ...own].some((id) => scope.sets.includes(id));
};

const PACKS: ReadonlyArray<{ readonly code: string; readonly cards: readonly AnyCard[] }> = [
  { code: "mut_gen", cards: MUT_GEN_CARDS },
  { code: "cyclops", cards: CYCLOPS_CARDS },
  { code: "phoenix", cards: PHOENIX_CARDS },
  { code: "wolv", cards: WOLV_CARDS },
  { code: "storm", cards: STORM_CARDS },
  { code: "gambit", cards: GAMBIT_CARDS },
  { code: "rogue", cards: ROGUE_CARDS },
  { code: "mojo", cards: MOJO_CARDS },
];

describe("wave 6 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs this suite checks (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards }) => {
    const allRefs = cards.filter((card) => inScriptedSets(code, card)).flatMap(abilityRefIds);
    const missing = allRefs.filter((id) => !(id in WAVE6_ABILITIES));

    if (PACK_STATUS[code] === "not started") {
      it("is not started: nothing resolves beyond what an earlier wave already scripted", () => {
        expect(missing).toEqual(allRefs);
      });
    } else {
      it("every ability reference resolves, except its documented skips", () => {
        const skipped = KNOWN_SKIPPED[code] ?? [];
        expect(
          missing.filter((id) => !skipped.includes(id)),
          `unscripted ${code} refs not in KNOWN_SKIPPED`,
        ).toEqual([]);
        expect(missing).toHaveLength(skipped.length);
      });
    }
  });
});

/** Every ability id a started pack's own registry holds must be named in a test file of that pack's folder. */
describe("wave 6 pack ability id coverage", () => {
  const rawTestFiles = (import.meta as unknown as ImportMetaEnv).glob("./**/*.test.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  interface ImportMetaEnv {
    readonly glob: (pattern: string, opts: object) => unknown;
  }
  const packTestText = (pack: string): string =>
    Object.entries(rawTestFiles)
      .filter(([path]) => path.startsWith(`./${pack}/`))
      .map(([, text]) => text)
      .join("\n");

  const PACKS_WITH_OWN_REGISTRIES: ReadonlyArray<{ readonly code: string; readonly registry: AbilityRegistry }> = [
    { code: "mut_gen", registry: MUT_GEN_ABILITIES },
    { code: "cyclops", registry: CYCLOPS_ABILITIES },
    { code: "phoenix", registry: PHOENIX_ABILITIES },
  ];

  it("checks every pack PACK_STATUS marks started", () => {
    const started = Object.entries(PACK_STATUS)
      .filter(([, status]) => status !== "not started")
      .map(([code]) => code)
      .sort();
    expect(PACKS_WITH_OWN_REGISTRIES.map((p) => p.code).sort()).toEqual(started);
  });

  describe.each(PACKS_WITH_OWN_REGISTRIES)("$code", ({ code, registry }) => {
    it("every ability id it registers is named in one of its own test files", () => {
      const text = packTestText(code);
      const unnamed = Object.keys(registry).filter((id) => !text.includes(id));
      expect(
        unnamed,
        `${code} ability ids registered but not named in any wave6/${code}/**/*.test.ts file:\n${unnamed.join("\n")}`,
      ).toEqual([]);
    });
  });
});

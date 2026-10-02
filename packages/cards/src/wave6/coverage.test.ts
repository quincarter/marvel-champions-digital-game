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
import { MUT_GEN_ABILITIES } from "./mut_gen/index.js";
import { abilityRefIds } from "../ability-refs.js";

describe("wave 6 ability registry", () => {
  it("includes every wave 5 (Core through cycle 4) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE5_ABILITIES)) expect(WAVE6_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  mut_gen: "in progress",
  cyclops: "not started",
  phoenix: "not started",
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
    // Cannonball (32091): "takes -1 consequential damage after he attacks and defeats a minion" is a change to the
    // amount of an ally's consequential damage, which is docs/phase7-wave6.md §3.31 (not yet landed).
    "32091.cannonball-constant",
    // Sentinel Mark VIII (32114): "attach the topmost Sentinel attachment from the discard pile to this minion" needs the
    // topmost *matching* card of the encounter discard pile; `encounterCards` limits only the deck by `top`, so a
    // selector would attach every Sentinel attachment in the pile. Needs a new docs/phase7-wave6.md §3 row
    // (`encounterCards.topmostOnly`, which Master of Magnetism 32151 needs too).
    "32114.sentinel-mark-viii-forced-response",
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
  mut_gen: { sets: ["project_wideawake", "sabretooth", "master_mold"], cardIds: ["32104"] },
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

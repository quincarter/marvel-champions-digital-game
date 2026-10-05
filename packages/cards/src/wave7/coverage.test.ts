/**
 * Coverage for the wave 7 (cycle 7) packs, modeled on `../wave6/coverage.test.ts`: which packs are scripted, and, for
 * a pack not started, that nothing of it resolves yet. At the scaffold every pack is "not started" and every registry
 * is empty, so this passes; marking a pack scripted switches it to the strict check (every ref registered or in
 * `KNOWN_SKIPPED` with a reason). Starting a pack means: change its `PACK_STATUS` row and list any `KNOWN_SKIPPED` refs
 * with a reason. A "not started" pack whose registry is not empty fails, so the marker cannot lag behind the scripts.
 */
import { ANGEL_CARDS, DEADPOOL_CARDS, NEXT_EVOL_CARDS, PSYLOCKE_CARDS, X23_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { WAVE6_ABILITIES } from "../wave6/index.js";
import { WAVE7_ABILITIES } from "./index.js";
import { ANGEL_ABILITIES } from "./angel/index.js";
import { DEADPOOL_ABILITIES } from "./deadpool/index.js";
import { NEXT_EVOL_ABILITIES } from "./next_evol/index.js";
import { MARAUDERS } from "./next_evol/marauders.js";
import { MORLOCK_SIEGE } from "./next_evol/morlock-siege.js";
import { PSYLOCKE_ABILITIES } from "./psylocke/index.js";
import { X23_ABILITIES } from "./x23/index.js";
import { abilityRefIds } from "../ability-refs.js";

describe("wave 7 ability registry", () => {
  it("includes every wave 6 (Core through cycle 6) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE6_ABILITIES)) expect(WAVE7_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  next_evol: "not started",
  psylocke: "not started",
  angel: "not started",
  x23: "not started",
  deadpool: "not started",
};

/** Refs a started pack deliberately leaves unscripted, each with its written reason. Pinned exactly. */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

/**
 * Scripted modules of a pack still marked "not started": the smallest partial state. Each names the printed ids it
 * covers and its registry; every ref of those cards is registered or in `skipped` with a reason, and the pack's whole
 * registry is exactly the union of these modules. Remove the entry when the pack is marked scripted.
 */
const SCRIPTED_MODULES: Readonly<
  Record<
    string,
    ReadonlyArray<{
      readonly module: string;
      readonly cardIds: readonly string[];
      readonly registry: AbilityRegistry;
      readonly skipped: Readonly<Record<string, string>>;
    }>
  >
> = {
  next_evol: [
    {
      module: "marauders",
      cardIds: ["40070", "40071", "40072", "40073", "40074", "40075", "40076"].flatMap((n) => [`${n}a`, `${n}b`]),
      registry: MARAUDERS,
      skipped: {},
    },
    {
      module: "morlock-siege",
      cardIds: [
        "40077a",
        "40079",
        "40080",
        "40081a",
        ...["2", "3", "4", "5", "6", "7", "8", "9"].map((n) => `4008${n}`),
      ],
      registry: MORLOCK_SIEGE,
      skipped: {
        "40082.bolstered-by-wrath-action":
          "'Spend X resources of any type, X = villains under Routed' as a cost: AbilityCost.resources / resourcesX take literal numbers, not a ValueSpec",
      },
    },
  ],
};

const PACKS: ReadonlyArray<{
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly registry: AbilityRegistry;
}> = [
  { code: "next_evol", cards: NEXT_EVOL_CARDS, registry: NEXT_EVOL_ABILITIES },
  { code: "psylocke", cards: PSYLOCKE_CARDS, registry: PSYLOCKE_ABILITIES },
  { code: "angel", cards: ANGEL_CARDS, registry: ANGEL_ABILITIES },
  { code: "x23", cards: X23_CARDS, registry: X23_ABILITIES },
  { code: "deadpool", cards: DEADPOOL_CARDS, registry: DEADPOOL_ABILITIES },
];

describe("wave 7 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs this suite checks (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards, registry }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const missing = allRefs.filter((id) => !(id in WAVE7_ABILITIES));

    if (PACK_STATUS[code] === "not started") {
      const modules = SCRIPTED_MODULES[code] ?? [];
      const scripted = modules.flatMap((m) => Object.keys(m.registry));
      it("is not started: nothing resolves beyond what an earlier wave already scripted and its scripted modules", () => {
        expect(missing).toEqual(allRefs.filter((id) => !scripted.includes(id)));
        expect(
          Object.keys(registry).sort(),
          `${code} is marked not started but its registry holds more than its scripted modules`,
        ).toEqual([...scripted].sort());
      });
      it.each(modules.map((m) => [m.module, m] as const))(
        "scripted module %s: every ref registered or skipped",
        (_, m) => {
          const refs = cards.filter((c) => m.cardIds.includes(c.id as string)).flatMap(abilityRefIds);
          expect(refs.length).toBeGreaterThan(0);
          expect(refs.filter((id) => !(id in m.registry) && !(id in m.skipped))).toEqual([]);
          expect(Object.keys(m.skipped).filter((id) => id in m.registry || !refs.includes(id))).toEqual([]);
          expect(Object.keys(m.registry).filter((id) => !refs.includes(id))).toEqual([]);
        },
      );
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
describe("wave 7 pack ability id coverage", () => {
  const rawTestFiles = (import.meta as unknown as ImportMetaEnv).glob("./**/*.test.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  interface ImportMetaEnv {
    readonly glob: (pattern: string, opts: object) => unknown;
  }
  /**
   * `next_evol` owns the box's whole folder; each hero pack owns its own. A hero pack's folder is its code, so
   * `./psylocke/...` is psylocke's.
   */
  const packTestText = (pack: string): string =>
    Object.entries(rawTestFiles)
      .filter(([path]) => path.startsWith(`./${pack}/`))
      .map(([, text]) => text)
      .join("\n");

  it("every ability id a started pack registers is named in one of its own test files", () => {
    for (const { code, registry } of PACKS.filter(
      (p) => PACK_STATUS[p.code] !== "not started" || p.code in SCRIPTED_MODULES,
    )) {
      const text = packTestText(code);
      const unnamed = Object.keys(registry).filter((id) => !text.includes(id));
      expect(
        unnamed,
        `${code} ability ids registered but not named in any wave7/${code}/**/*.test.ts file:\n${unnamed.join("\n")}`,
      ).toEqual([]);
    }
  });
});

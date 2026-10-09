/**
 * Coverage for the wave 9 (cycle 9) packs, modeled on `../wave8/coverage.test.ts`: which packs are scripted, and, for
 * a pack not started, that nothing of it resolves yet. At the scaffold every pack is "not started" and every registry
 * is empty, so this passes; marking a pack scripted switches it to the strict check (every ref registered or in
 * `KNOWN_SKIPPED` with a reason). Starting a pack means: change its `PACK_STATUS` row, add `SCRIPTED_MODULES` entries
 * for its modules while it is partial, and list any `KNOWN_SKIPPED` refs with a reason. A "not started" pack whose
 * registry is not empty fails, so the marker cannot lag behind the scripts.
 */
import { AOS_CARDS, BP_CARDS, FALCON_CARDS, SILK_CARDS, TT_CARDS, WINTER_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { abilityRefIds } from "../ability-refs.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { WAVE9_ABILITIES } from "./index.js";
import { AOS_ABILITIES } from "./aos/index.js";
import { BP_ABILITIES } from "./bp/index.js";
import { FALCON_ABILITIES } from "./falcon/index.js";
import { SILK_ABILITIES } from "./silk/index.js";
import { TT_ABILITIES } from "./tt/index.js";
import { WINTER_ABILITIES } from "./winter/index.js";

describe("wave 9 ability registry", () => {
  it("includes every wave 8 (Core through cycle 8) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE8_ABILITIES)) expect(WAVE9_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  aos: "not started",
  bp: "not started",
  silk: "not started",
  falcon: "not started",
  winter: "not started",
  tt: "not started",
};

/** Refs a started pack deliberately leaves unscripted, each with its written reason. Pinned exactly. */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

/**
 * Scripted modules of a pack still marked "not started": the smallest partial state (modeled on wave 8's). Each names the
 * printed ids it covers and its registry; every ref of those cards is registered or in `skipped` with a reason, and the
 * pack's whole registry is exactly the union of these modules. Remove the entry when the pack is marked scripted.
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
> = {};

const PACKS: ReadonlyArray<{
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly registry: AbilityRegistry;
}> = [
  { code: "aos", cards: AOS_CARDS, registry: AOS_ABILITIES },
  { code: "bp", cards: BP_CARDS, registry: BP_ABILITIES },
  { code: "silk", cards: SILK_CARDS, registry: SILK_ABILITIES },
  { code: "falcon", cards: FALCON_CARDS, registry: FALCON_ABILITIES },
  { code: "winter", cards: WINTER_CARDS, registry: WINTER_ABILITIES },
  { code: "tt", cards: TT_CARDS, registry: TT_ABILITIES },
];

describe("wave 9 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs this suite checks (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards, registry }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const missing = allRefs.filter((id) => !(id in WAVE9_ABILITIES));

    if (PACK_STATUS[code] === "not started") {
      const modules = SCRIPTED_MODULES[code] ?? [];
      const scripted = modules.flatMap((m) => Object.keys(m.registry));
      it("is not started: nothing resolves beyond what an earlier wave already scripted and its scripted modules", () => {
        // Refs an earlier wave already registered resolve (Silk's Quick Quip 52034 was scripted in wave 5, ahead of its pack).
        expect(missing).toEqual(allRefs.filter((id) => !(id in WAVE8_ABILITIES) && !scripted.includes(id)));
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

/** Every ability id a pack's own scripted modules register must be named in a test file of that pack's folder. */
describe("wave 9 pack ability id coverage", () => {
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

  it("every ability id a started pack registers is named in one of its own test files", () => {
    for (const { code, registry } of PACKS.filter(
      (p) => PACK_STATUS[p.code] !== "not started" || p.code in SCRIPTED_MODULES,
    )) {
      const text = packTestText(code);
      const unnamed = Object.keys(registry).filter((id) => !text.includes(id));
      expect(unnamed, `${code} ids registered but not named in any wave9/${code}/**/*.test.ts file`).toEqual([]);
    }
  });
});

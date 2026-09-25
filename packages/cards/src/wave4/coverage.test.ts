/**
 * Coverage for every wave 4 (cycle 4) pack (docs/phase7-wave4.md), modeled directly on `../wave3/coverage.test.ts`:
 * which packs are fully scripted, which are not started, and — for a pack that isn't started — nothing resolves
 * that isn't already covered by an earlier wave.
 */
import { NEBU_CARDS, WARM_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { WAVE4_ABILITIES } from "./index.js";
import { NEBU_ABILITIES } from "./nebu/index.js";
import { WARM_ABILITIES } from "./warm/index.js";
import { abilityRefIds } from "../ability-refs.js";

describe("wave 4 ability registry", () => {
  it("includes every wave 3 (Core through cycle 3) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE3_ABILITIES)) expect(WAVE4_ABILITIES[id], id).toBe(definition);
  });
});

/** One row per wave 4 pack (docs/phase7-wave4.md). */
const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  nebu: "scripted",
  warm: "scripted",
};

/**
 * Ability refs Nebula deliberately leaves unscripted (docs/phase7-wave1-scripting.md §4, "missing primitive →
 * record and skip"). Pinned exactly: every other ref must resolve, and each listed ref must still be unresolved.
 */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

const PACKS: ReadonlyArray<{ readonly code: string; readonly cards: readonly AnyCard[] }> = [
  { code: "nebu", cards: NEBU_CARDS },
  { code: "warm", cards: WARM_CARDS },
];

describe("wave 4 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs this suite checks for wave 4 (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const missing = allRefs.filter((id) => !(id in WAVE4_ABILITIES));

    if (PACK_STATUS[code] === "scripted" || PACK_STATUS[code] === "in progress") {
      it(`every ability reference resolves, except its documented skips`, () => {
        const skipped = KNOWN_SKIPPED[code] ?? [];
        expect(missing, `unscripted ${code} ability refs:\n${missing.join("\n")}`).toEqual(
          expect.arrayContaining([...skipped]),
        );
        expect(
          missing.filter((id) => !skipped.includes(id)),
          `unscripted ${code} ability refs not in KNOWN_SKIPPED`,
        ).toEqual([]);
        expect(missing).toHaveLength(skipped.length);
      });
    } else {
      it(`is not started: nothing resolves beyond what an earlier wave already scripted`, () => {
        expect(missing).toEqual(allRefs);
      });
    }
  });
});

/**
 * A registered-but-untested guard (`../wave3/coverage.test.ts`'s own "§7 Progress" precedent — the standing rule
 * that session earned): every ability id a wave 4 pack's own module registers must appear, as a literal string, in
 * at least one `*.test.ts` file in that pack's own folder. Naming the id is necessary, not sufficient — a reviewer
 * still has to check the test that names it actually drives the ability through a real command and asserts on the
 * result, not merely mentions the string in a comment.
 */
describe("wave 4 pack ability id coverage (every registered ability id is named in that pack's own tests)", () => {
  const rawTestFiles = (import.meta as unknown as ImportMetaEnv).glob("./*/*.test.ts", {
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
    { code: "nebu", registry: NEBU_ABILITIES },
    { code: "warm", registry: WARM_ABILITIES },
  ];

  it("checks every pack PACK_STATUS marks started, so a new pack can't skip the guard by not being listed here", () => {
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
        `${code} ability ids registered but not named in any wave4/${code}/*.test.ts file:\n${unnamed.join("\n")}`,
      ).toEqual([]);
    });
  });
});

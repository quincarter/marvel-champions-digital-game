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
import { abilityRefIds } from "../ability-refs.js";

describe("wave 6 ability registry", () => {
  it("includes every wave 5 (Core through cycle 4) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE5_ABILITIES)) expect(WAVE6_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  mut_gen: "not started",
  cyclops: "not started",
  phoenix: "not started",
  wolv: "not started",
  storm: "not started",
  gambit: "not started",
  rogue: "not started",
  mojo: "not started",
};

/** Refs a started pack deliberately leaves unscripted, each with its written reason. Pinned exactly. */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

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
    const allRefs = cards.flatMap(abilityRefIds);
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
  const PACKS_WITH_OWN_REGISTRIES: ReadonlyArray<{ readonly code: string; readonly registry: AbilityRegistry }> = [];

  it("checks every pack PACK_STATUS marks started", () => {
    const started = Object.entries(PACK_STATUS)
      .filter(([, status]) => status !== "not started")
      .map(([code]) => code)
      .sort();
    expect(PACKS_WITH_OWN_REGISTRIES.map((p) => p.code).sort()).toEqual(started);
  });
});

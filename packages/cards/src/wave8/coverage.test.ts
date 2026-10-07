/**
 * Coverage for the wave 8 (cycle 8) packs, modeled on `../wave7/coverage.test.ts`: which packs are scripted, and, for
 * a pack not started, that nothing of it resolves yet. At the scaffold every pack is "not started" and every registry
 * is empty, so this passes; marking a pack scripted switches it to the strict check (every ref registered or in
 * `KNOWN_SKIPPED` with a reason). Starting a pack means: change its `PACK_STATUS` row and list any `KNOWN_SKIPPED` refs
 * with a reason. A "not started" pack whose registry is not empty fails, so the marker cannot lag behind the scripts.
 */
import { AOA_CARDS, ICEMAN_CARDS, JUBILEE_CARDS, MAGNETO_CARDS, NCRAWLER_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { abilityRefIds } from "../ability-refs.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";
import { WAVE8_ABILITIES } from "./index.js";
import { AOA_ABILITIES } from "./aoa/index.js";
import { ICEMAN_ABILITIES } from "./iceman/index.js";
import { JUBILEE_ABILITIES } from "./jubilee/index.js";
import { MAGNETO_ABILITIES } from "./magneto/index.js";
import { NCRAWLER_ABILITIES } from "./ncrawler/index.js";

describe("wave 8 ability registry", () => {
  it("includes every wave 7 (Core through cycle 7) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE7_ABILITIES)) expect(WAVE8_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  aoa: "not started",
  iceman: "not started",
  jubilee: "not started",
  ncrawler: "not started",
  magneto: "not started",
};

/** Refs a started pack deliberately leaves unscripted, each with its written reason. Pinned exactly. */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

const PACKS: ReadonlyArray<{
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly registry: AbilityRegistry;
}> = [
  { code: "aoa", cards: AOA_CARDS, registry: AOA_ABILITIES },
  { code: "iceman", cards: ICEMAN_CARDS, registry: ICEMAN_ABILITIES },
  { code: "jubilee", cards: JUBILEE_CARDS, registry: JUBILEE_ABILITIES },
  { code: "ncrawler", cards: NCRAWLER_CARDS, registry: NCRAWLER_ABILITIES },
  { code: "magneto", cards: MAGNETO_CARDS, registry: MAGNETO_ABILITIES },
];

describe("wave 8 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs this suite checks (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards, registry }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const missing = allRefs.filter((id) => !(id in WAVE8_ABILITIES));

    if (PACK_STATUS[code] === "not started") {
      it("is not started: nothing resolves beyond what an earlier wave already scripted", () => {
        expect(missing).toEqual(allRefs);
        expect(Object.keys(registry), `${code} is marked not started but its registry is not empty`).toEqual([]);
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

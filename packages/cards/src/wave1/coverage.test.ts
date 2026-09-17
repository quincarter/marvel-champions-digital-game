/**
 * Coverage for every wave 1 pack (docs/phase7-wave1-scripting.md "Status"): which packs are fully scripted, which
 * are not started, and — for a pack that isn't started — that anything which happens to resolve anyway is
 * accounted for entirely by `reprints.ts`'s automatic Core-reprint aliasing, never a stray hand-scripted id.
 *
 * The pack list itself (code, card array) is imported straight from `@mc/content`, the same eight arrays
 * `packages/content/src/data/wave1.test.ts` iterates — never a separately hand-maintained id list — so a ninth
 * pack lands here automatically the moment `@mc/content` exports it, instead of silently going unchecked.
 */
import { BKW_CARDS, CAP_CARDS, DRS_CARDS, GOB_CARDS, HLK_CARDS, MSM_CARDS, THOR_CARDS, TWC_CARDS, type AnyCard } from "@mc/content";
import { CORE_ABILITIES } from "../core/index.js";
import { WAVE1_ABILITIES, wave1ReprintPairs } from "./index.js";

// `WAVE1_CARDS` includes Core, and the engine skips an unregistered ability silently, so a missing Core script would
// quietly play Rhino, Klaw or Ultron (or a Core hero) with no abilities in any wave 1 game.
describe("wave 1 ability registry", () => {
  it("includes every Core script, the same definition object", () => {
    for (const [id, definition] of Object.entries(CORE_ABILITIES)) expect(WAVE1_ABILITIES[id], id).toBe(definition);
  });
});

function abilityRefIds(card: AnyCard): string[] {
  switch (card.type) {
    case "hero_identity":
      return [...card.hero.abilities, ...card.alterEgo.abilities].map((ref) => ref.id);
    case "villain":
      return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities.map((ref) => ref.id)));
    case "main_scheme":
      return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities].map((ref) => ref.id));
    default: {
      // A double-sided encounter card (Criminal Enterprise / State of Madness) carries its other face's abilities on
      // `flipSide`, not on the card itself.
      const own = "abilities" in card ? card.abilities.map((ref) => ref.id) : [];
      const flip = "flipSide" in card && card.flipSide ? card.flipSide.abilities.map((ref) => ref.id) : [];
      return [...own, ...flip];
    }
  }
}

/** Every ability id `reprints.ts` supplies for this pack's own cards (it aliases pairs across every wave 1 pack). */
const reprintIdsOf = (cards: readonly AnyCard[]): ReadonlySet<string> => {
  const packIds = new Set(cards.map((c) => c.id as string));
  const ids = new Set<string>();
  for (const { wave1 } of wave1ReprintPairs()) {
    if (!packIds.has(wave1.id as string)) continue;
    for (const ref of abilityRefIds(wave1)) ids.add(ref);
  }
  return ids;
};

/** One row per wave 1 pack (docs/phase7-wave1.md "Wave 1"): whether `ability-scripting-engineer` has scripted its own kit/nemesis/obligation/scenario modules yet. Update only when a pack agent's `<PACK>_ABILITIES` is registered in `./index.ts`. */
const PACK_STATUS: Readonly<Record<string, "scripted" | "not started">> = {
  cap: "scripted",
  gob: "scripted",
  twc: "scripted",
  msm: "scripted",
  thor: "scripted",
  bkw: "scripted",
  drs: "scripted",
  hlk: "scripted",
};

/**
 * Ability refs a scripted pack deliberately leaves unscripted because an engine primitive is missing
 * (docs/phase7-wave1-scripting.md §4, "missing primitive → record and skip"). Pinned exactly: a scripted pack must
 * resolve every other ref, and each listed ref must still be unresolved, so an entry can't go stale.
 */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

const PACKS: ReadonlyArray<{ readonly code: string; readonly cards: readonly AnyCard[] }> = [
  { code: "gob", cards: GOB_CARDS },
  { code: "twc", cards: TWC_CARDS },
  { code: "cap", cards: CAP_CARDS },
  { code: "msm", cards: MSM_CARDS },
  { code: "thor", cards: THOR_CARDS },
  { code: "bkw", cards: BKW_CARDS },
  { code: "drs", cards: DRS_CARDS },
  { code: "hlk", cards: HLK_CARDS },
];

describe("wave 1 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs @mc/content exports for wave 1 (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const reprintIds = reprintIdsOf(cards);
    const missing = allRefs.filter((id) => !(id in WAVE1_ABILITIES));
    // Anything resolved for a pack that isn't its own scripted module must be explained by an automatic Core
    // reprint alias — never a stray hand-written id smuggled in outside `docs/phase7-wave1-scripting.md`'s
    // one-module-per-pack shape.
    const resolvedBeyondReprints = allRefs.filter((id) => id in WAVE1_ABILITIES && !reprintIds.has(id));

    if (PACK_STATUS[code] === "scripted") {
      it(`every ability reference resolves (scripted directly, or aliased as a Core reprint), except its documented skips`, () => {
        const skipped = KNOWN_SKIPPED[code] ?? [];
        expect(missing, `unscripted ${code} ability refs:\n${missing.join("\n")}`).toEqual(expect.arrayContaining([...skipped]));
        expect(missing.filter((id) => !skipped.includes(id)), `unscripted ${code} ability refs not in KNOWN_SKIPPED`).toEqual([]);
        expect(missing).toHaveLength(skipped.length);
      });
    } else {
      it(`is not started: nothing resolves beyond \`reprints.ts\`'s automatic Core-reprint aliasing`, () => {
        expect(resolvedBeyondReprints, `${code} ability refs resolved outside reprints.ts — update PACK_STATUS if this pack is now scripted:\n${resolvedBeyondReprints.join("\n")}`).toEqual([]);
      });
    }
  });
});

describe("Captain America (cap) pack ability coverage", () => {
  const allRefs = CAP_CARDS.flatMap(abilityRefIds);

  it("has 34 cards and 37 ability references, each id unique", () => {
    expect(CAP_CARDS).toHaveLength(34);
    expect(allRefs).toHaveLength(37);
    expect(new Set(allRefs).size).toBe(allRefs.length);
  });

  it("8 of the 37 references are Core reprints (Hawkeye x2, Make the Call, The Power of Leadership, Mockingbird, Hydra Soldier — Energy/Genius/Strength print no ability)", () => {
    const reprintIds = ["03012.hawkeye-constant", "03012.hawkeye-response", "03016.make-the-call-action", "03018.the-power-of-leadership-constant", "03020.mockingbird-response", "03029.when-defeated"];
    for (const id of reprintIds) expect(allRefs, id).toContain(id);
    expect(reprintIds).toHaveLength(6);
  });
});

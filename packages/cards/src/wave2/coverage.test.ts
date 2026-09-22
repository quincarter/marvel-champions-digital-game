/**
 * Coverage for every wave 2 (cycle 1) pack (docs/phase7-wave2-scripting.md "Progress"): which packs are fully
 * scripted, which are in progress, which are not started, and — for a pack that isn't started — that anything
 * which happens to resolve anyway is accounted for entirely by `reprints.ts`'s automatic Core/wave 1-reprint
 * aliasing, never a stray hand-scripted id. Modeled directly on `../wave1/coverage.test.ts`.
 *
 * The pack list itself (code, card array) is imported straight from `@mc/content`, the same six arrays
 * `packages/content/src/data/wave2.test.ts`-shaped modules iterate — never a separately hand-maintained id list —
 * so a seventh pack lands here automatically the moment `@mc/content` exports it.
 */
import { ANT_CARDS, QSV_CARDS, SCW_CARDS, TOAFK_CARDS, TRORS_CARDS, WSP_CARDS, type AnyCard } from "@mc/content";
import { CORE_ABILITIES } from "../core/index.js";
import { WAVE2_ABILITIES, wave2ReprintPairs } from "./index.js";
import { abilityRefIds } from "../ability-refs.js";

// `WAVE2_CARDS` includes Core, and the engine skips an unregistered ability silently, so a missing Core script
// would quietly play Rhino, Klaw or Ultron (or a Core hero) with no abilities in any wave 2 game.
describe("wave 2 ability registry", () => {
  it("includes every Core script, the same definition object", () => {
    for (const [id, definition] of Object.entries(CORE_ABILITIES)) expect(WAVE2_ABILITIES[id], id).toBe(definition);
  });
});

/**
 * Every ability id `reprints.ts` supplies for this pack's own cards (it aliases pairs across every wave 2 pack).
 * `wave2ReprintPairs()` pairs are `{ wave2, wave1 }` — `wave2` is *this* pack's own reprinting card (whose ability
 * refs are what actually get aliased into the registry); `wave1` is the Core/wave 1 card it matches.
 */
const reprintIdsOf = (cards: readonly AnyCard[]): ReadonlySet<string> => {
  const packIds = new Set(cards.map((c) => c.id as string));
  const ids = new Set<string>();
  for (const { wave2 } of wave2ReprintPairs()) {
    if (!packIds.has(wave2.id as string)) continue;
    for (const ref of abilityRefIds(wave2)) ids.add(ref);
  }
  return ids;
};

/**
 * One row per wave 2 pack (docs/phase7-wave2.md "Wave 2"): whether `ability-scripting-engineer` has started this
 * pack's own kit/nemesis/obligation/scenario modules. `"in progress"` behaves exactly like `"scripted"` for the
 * assertion below (every ref not in `KNOWN_SKIPPED` must resolve) — the only difference is what it promises: a
 * `"scripted"` pack's `KNOWN_SKIPPED` entries are all missing-primitive blocks (docs/phase7-wave1-scripting.md §4);
 * an `"in progress"` pack's list is a mix of that and cards nobody has scripted yet, which is expected to shrink
 * (never silently grow stale — this exact-match assertion still catches that) as work continues.
 */
const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  trors: "scripted",
  toafk: "scripted",
  ant: "scripted",
  wsp: "scripted",
  qsv: "scripted",
  scw: "scripted",
};

/**
 * Ability refs a pack deliberately leaves unscripted (docs/phase7-wave1-scripting.md §4, "missing primitive →
 * record and skip" — for `"in progress"` packs this also includes cards not yet reached). Pinned exactly: every
 * other ref must resolve, and each listed ref must still be unresolved, so an entry can't go stale.
 */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {
  // Regenerated 2026-09-22 (`ability-scripting-engineer`, campaign mode design §11 step 8): 28 of the 30 Hydra
  // Campaign refs are scripted (`wave2/trors/campaign-cards.ts`). The remaining two are a *content* data gap, not
  // a missing engine primitive — see that module's own docblock and `campaign-cards.test.ts` for the full writeup.
  trors: [
    // Martial Law (04165) — "Your hand size is reduced by 1.\nAlter-Ego Action: Deal yourself an encounter card
    // and spend a [energy] resource → discard this card." One ability ref (`04165.obligation`) for two clauses
    // that need two different `AbilityTriggerSpec` kinds (`constant` + `action`) — an `AbilityDefinition` carries
    // exactly one. Needs the same `<name>-constant`/`<name>-action` content split `card-data-pipeline` already
    // made for `toafk` 11020/11049 (docs/phase7-wave2-data.md "Part 8").
    "04165.obligation",
    // Anti-Hero Propaganda (04166) — "Your hero gets -1 THW, -1 ATK, and -1 DEF.\nAlter-Ego Action: Take 2 damage
    // and spend a [wild] resource → discard this card." Same gap as 04165.
    "04166.obligation",
  ],
  // Regenerated 2026-09-20 (`pnpm refs`) after scripting `11049.fear-of-kang-constant` ("You cannot attack Kang",
  // `player: you`) — the last non-campaign ref in the wave 2 skip backlog: `game-rules-architect` gave `RuleSpec
  // cannotAttack` a `player?: PlayerRef` field mirroring `cannotPlay`'s (docs/phase7-wave2.md §25), so the
  // over-broad table-wide reading that kept this ref skipped is gone; `kang-encounter-set.ts`'s docblock and
  // `toafk/fear-of-kang-constant.test.ts` have the two-player proof for both the fixed shape and the still-correct
  // bare/table-wide shape Distracting Taunts (`twc` 07035) genuinely needs. Fully scripted.
  toafk: [],
  // Regenerated 2026-09-20 against ANT_CARDS/WAVE2_ABILITIES, after un-skipping all five remaining refs
  // (docs/phase7-wave2.md §18/§23): `12011.ant-man-interrupt` and `12032.muster-courage-action` were already
  // unblocked (stale skips, §18.3/§18.5); `12024.team-building-exercise-action` and `12029.when-revealed` needed
  // `TargetQuery.sharesTraitWith`/`encounterSetOf` (§20.1/§20.2); `12025.obligation` needed `applyRuleUntil` (§22).
  ant: [],
  // Regenerated 2026-09-20 against WSP_CARDS/WAVE2_ABILITIES, after un-skipping `13012.wasp-interrupt` (docs/
  // phase7-wave2.md §18.3/§23: `overpaid.energy` was already readable from a later `cardEntersPlay` interrupt).
  wsp: [],
  // Regenerated 2026-09-20 against QSV_CARDS/WAVE2_ABILITIES, after un-skipping both remaining refs (docs/
  // phase7-wave2.md §23): `14009.friction-resistance-response` needed the new `cardReadied` announcement (§21);
  // `14024.obligation` needed `applyRuleUntil` (§22), the same primitive `12025.obligation` (`ant`) needed.
  qsv: [],
  // Regenerated 2026-09-20 (`pnpm refs`) after scripting `15023.obligation` (Slipping Sanity) — `card-data-
  // pipeline` landed a printed `starIcon` field (docs/phase7-wave2.md §24), the engine grew `<bind>.starIcons`
  // on `discardEncounterCards`, and `obligation-nemesis.ts`'s docblock has the rest. Fully scripted.
  scw: [],
};

const PACKS: ReadonlyArray<{ readonly code: string; readonly cards: readonly AnyCard[] }> = [
  { code: "trors", cards: TRORS_CARDS },
  { code: "toafk", cards: TOAFK_CARDS },
  { code: "ant", cards: ANT_CARDS },
  { code: "wsp", cards: WSP_CARDS },
  { code: "qsv", cards: QSV_CARDS },
  { code: "scw", cards: SCW_CARDS },
];

describe("wave 2 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs @mc/content exports for wave 2 (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const reprintIds = reprintIdsOf(cards);
    const missing = allRefs.filter((id) => !(id in WAVE2_ABILITIES));
    // Anything resolved for a pack outside its own scripted module must be explained by an automatic reprint
    // alias — never a stray hand-written id smuggled in outside docs/phase7-wave2-scripting.md's one-module-per-
    // pack shape.
    const resolvedBeyondReprints = allRefs.filter((id) => id in WAVE2_ABILITIES && !reprintIds.has(id));

    if (PACK_STATUS[code] === "scripted" || PACK_STATUS[code] === "in progress") {
      it(`every ability reference resolves (scripted directly, or aliased as a reprint), except its documented skips`, () => {
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
      it(`is not started: nothing resolves beyond reprints.ts's automatic reprint aliasing`, () => {
        expect(
          resolvedBeyondReprints,
          `${code} ability refs resolved outside reprints.ts — update PACK_STATUS if this pack is now started:\n${resolvedBeyondReprints.join("\n")}`,
        ).toEqual([]);
      });
    }
  });
});

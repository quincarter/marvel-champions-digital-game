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

// `WAVE2_CARDS` includes Core, and the engine skips an unregistered ability silently, so a missing Core script
// would quietly play Rhino, Klaw or Ultron (or a Core hero) with no abilities in any wave 2 game.
describe("wave 2 ability registry", () => {
  it("includes every Core script, the same definition object", () => {
    for (const [id, definition] of Object.entries(CORE_ABILITIES)) expect(WAVE2_ABILITIES[id], id).toBe(definition);
  });
});

function abilityRefIds(card: AnyCard): string[] {
  switch (card.type) {
    case "hero_identity":
      return [...card.hero.abilities, ...card.alterEgo.abilities, ...(card.additionalHeroForms ?? []).flatMap((face) => face.abilities)].map((ref) => ref.id);
    case "villain":
      return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities.map((ref) => ref.id)));
    case "main_scheme":
      return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities].map((ref) => ref.id));
    default: {
      // A double-sided card (a campaign upgrade pair, an encounter card's flip side, …) carries its other face's
      // abilities on `flipSide`, not on the card itself (docs/phase7-wave2.md §1.5).
      const own = "abilities" in card ? card.abilities.map((ref) => ref.id) : [];
      const flip = "flipSide" in card && card.flipSide ? card.flipSide.abilities.map((ref) => ref.id) : [];
      return [...own, ...flip];
    }
  }
}

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
  // Regenerated 2026-09-20 against TRORS_CARDS/WAVE2_ABILITIES (the throwaway-test method these comments describe)
  // after un-skipping `04028.when-revealed` (docs/phase7-wave2.md §18.4/§23: the skip had gone stale — `anyOf` +
  // `ref`/`each` + `tuckCards` were all already there).
  trors: [
    // --- Hydra Campaign cards: data only while campaign mode is deferred (PLAN.md, "Campaign mode"; `trors` is
    //     slated to be the first box built). ---
    "04155.adrenal-stims-action",
    "04156.tactical-scanner-action",
    "04157.emergency-teleporter-action",
    "04158.laser-cannon-action",
    "04159a.basic-thwart-upgrade-constant",
    "04159a.basic-thwart-upgrade-constant-2",
    "04159b.improved-thwart-upgrade-constant",
    "04159b.improved-thwart-upgrade-constant-2",
    "04159b.improved-thwart-upgrade-response",
    "04160a.basic-attack-upgrade-constant",
    "04160a.basic-attack-upgrade-constant-2",
    "04160b.improved-attack-upgrade-constant",
    "04160b.improved-attack-upgrade-constant-2",
    "04160b.improved-attack-upgrade-response",
    "04161a.basic-defense-upgrade-constant",
    "04161a.basic-defense-upgrade-constant-2",
    "04161b.improved-defense-upgrade-constant",
    "04161b.improved-defense-upgrade-constant-2",
    "04161b.improved-defense-upgrade-response",
    "04162a.basic-recovery-upgrade-constant",
    "04162a.basic-recovery-upgrade-constant-2",
    "04162b.improved-recovery-upgrade-constant",
    "04162b.improved-recovery-upgrade-constant-2",
    "04162b.improved-recovery-upgrade-response",
    "04163.obligation",
    "04164.obligation",
    "04164.medical-emergency-forced-response",
    "04164.medical-emergency-action",
    "04165.obligation",
    "04166.obligation",
  ],
  // Regenerated 2026-09-20 against TOAFK_CARDS/WAVE2_ABILITIES, after un-skipping 11018/11019/11021's own
  // "Alter-Ego Action" refs (docs/phase7-wave2.md §19/§23: `AbilityCost.discardFromHand` gained `filter`).
  // `card-data-pipeline` has since split 11020/11049's own single combined ref into a `-constant` ref and a
  // `-action` ref apiece, the same shape 11018/11019/11021 already use (docs/phase7-wave2.md §18.2,
  // docs/phase7-wave2-data.md) — mechanically required here since this list is pinned to whatever ability ref ids
  // `@mc/content` actually emits. Every primitive all four refs need already exists (RuleSpec `cannotPlay`/
  // `cannotAttack`, `TargetQuery.identitySetOf`, `AbilityCost.discardFromHand.filter`, `discardRandomFromHand`);
  // none are scripted yet — that is `ability-scripting-engineer`'s follow-up.
  toafk: [
    "11020.depowered-constant",
    "11020.depowered-action",
    "11049.fear-of-kang-constant",
    "11049.fear-of-kang-action",
  ],
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
  // Computed 2026-09-19 against SCW_CARDS/WAVE2_ABILITIES, same method as the other packs' own lists above.
  scw: [
    // --- Obligation/nemesis (wave2/scw/obligation-nemesis.ts): missing-primitive block, see that file's module
    //     docblock (no primitive counts star icons — as opposed to boost icons — among a discarded pool of
    //     boost-area cards; confirmed genuinely missing, not just a missing DSL wrapper). Data gap, not an engine
    //     gap (docs/phase7-wave2.md §18.6/§23): `card-data-pipeline` needs a `starIcon?: boolean` field on
    //     encounter-side cards, backfilled; the engine read is a one-liner afterwards. ---
    "15023.obligation",
  ],
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
        expect(missing, `unscripted ${code} ability refs:\n${missing.join("\n")}`).toEqual(expect.arrayContaining([...skipped]));
        expect(missing.filter((id) => !skipped.includes(id)), `unscripted ${code} ability refs not in KNOWN_SKIPPED`).toEqual([]);
        expect(missing).toHaveLength(skipped.length);
      });
    } else {
      it(`is not started: nothing resolves beyond reprints.ts's automatic reprint aliasing`, () => {
        expect(resolvedBeyondReprints, `${code} ability refs resolved outside reprints.ts — update PACK_STATUS if this pack is now started:\n${resolvedBeyondReprints.join("\n")}`).toEqual([]);
      });
    }
  });
});

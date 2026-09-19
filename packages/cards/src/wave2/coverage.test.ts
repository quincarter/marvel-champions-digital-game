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
  trors: "in progress",
  toafk: "not started",
  ant: "not started",
  wsp: "not started",
  qsv: "not started",
  scw: "not started",
};

/**
 * Ability refs a pack deliberately leaves unscripted (docs/phase7-wave1-scripting.md §4, "missing primitive →
 * record and skip" — for `"in progress"` packs this also includes cards not yet reached). Pinned exactly: every
 * other ref must resolve, and each listed ref must still be unresolved, so an entry can't go stale.
 */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {
  // Computed 2026-09-19 against TRORS_CARDS/WAVE2_ABILITIES — regenerate the same way (a small throwaway test
  // dumping `allRefs.filter((id) => !(id in WAVE2_ABILITIES))`) whenever this list needs updating; hand-typing
  // ability slugs from memory is exactly how this list drifted from reality the first time it was written.
  trors: [
    // --- Hawkeye kit (wave2/trors/hawkeye-kit.ts): missing-primitive blocks, see that file's module docblock. ---
    "04002.hawkeyes-bow-constant",
    "04004.mockingbird-interrupt",
    "04008.cable-arrow-action",
    "04009.vibranium-arrow-action",
    "04011.hawkeye-action",
    // --- Hawkeye obligation/nemesis (wave2/trors/hawkeye-obligation-nemesis.ts): missing-primitive blocks. ---
    "04027.boost",
    "04028.when-revealed",
    "04029.crossfires-rifle-action",
    // --- Spider-Woman kit (wave2/trors/spider-woman-kit.ts): missing-primitive blocks. ---
    "04031a.superhuman-agility",
    "04033.finesse-resource",
    "04034.jessica-drews-apartment-action",
    "04044.piercing-strike-action",
    // --- Crossbones scenario (wave2/trors/crossbones.ts): missing-primitive block, see that file's docblock. ---
    "04070.when-defeated",
    // --- Not yet scripted (docs/phase7-wave2-scripting.md "Progress"): the four remaining Red Skull scenarios
    //     (Absorbing Man 04076–04095, Taskmaster 04096–04111, Zola 04112–04127, Red Skull 04128–04154) and the
    //     Hydra Campaign cards (04155–04166, data only while campaign mode is deferred). ---
    "04076.absorbing-man-constant",
    "04077.absorbing-man-constant",
    "04077.when-revealed",
    "04078.absorbing-man-constant",
    "04078.absorbing-man-forced-response",
    "04078.absorbing-man-constant-2",
    "04078.absorbing-man-constant-3",
    "04079a.setup",
    "04079b.none-shall-pass-forced-response",
    "04079b.none-shall-pass-forced-interrupt",
    "04080.dense-forest-forced-response",
    "04080.boost",
    "04081.snowy-hillside-forced-response",
    "04081.boost",
    "04082.rocky-outcrop-forced-response",
    "04082.boost",
    "04083.abandoned-facility-forced-response",
    "04083.boost",
    "04084.ball-and-chain-action",
    "04084.boost",
    "04085.when-revealed",
    "04085.boost",
    "04086.when-revealed-alter-ego",
    "04086.when-revealed-hero",
    "04087.when-revealed-alter-ego",
    "04087.when-revealed-hero",
    "04088.when-revealed",
    "04088.boost",
    "04089.when-revealed",
    "04089.omni-morph-duplication-constant",
    "04089.omni-morph-duplication-constant-2",
    "04089.omni-morph-duplication-constant-3",
    "04089.omni-morph-duplication-constant-4",
    "04090.when-revealed",
    "04090.boost",
    "04091.when-revealed",
    "04092.super-absorbing-power-constant",
    "04092.boost",
    "04093.taskmaster-forced-response",
    "04094.when-revealed",
    "04094.taskmaster-forced-response",
    "04095.when-revealed",
    "04095.taskmaster-forced-response",
    "04096a.setup",
    "04096b.hunting-down-heroes-forced-response",
    "04097.moon-knight-response",
    "04098.shang-chi-response",
    "04099.white-tiger-response",
    "04100.elektra-response",
    "04101.hydra-hunter-constant",
    "04101.boost",
    "04102.taskmasters-sword-constant",
    "04102.taskmasters-sword-action",
    "04103.taskmasters-shield-constant",
    "04103.taskmasters-shield-action",
    "04104.photographic-reflexes-forced-interrupt",
    "04105.when-revealed-alter-ego",
    "04105.when-revealed-hero",
    "04106.when-revealed",
    "04107.when-revealed",
    "04108.taskmasters-training-camp-forced-response",
    "04110.when-revealed",
    "04111.when-revealed",
    "04112a.setup",
    "04112b.the-island-of-dr-zola-forced-response",
    "04113a.when-revealed",
    "04113b.the-mad-doctor-forced-response",
    "04113b.the-mad-doctor-constant",
    "04114.ultimate-bio-servant-constant",
    "04114.boost",
    "04115.when-revealed",
    "04115.boost",
    "04116.boost",
    "04117.defensive-programming-constant",
    "04117.defensive-programming-constant-2",
    "04118.pain-inhibitors-constant",
    "04118.pain-inhibitors-constant-2",
    "04119.neurological-implants-constant",
    "04119.neurological-implants-constant-2",
    "04120.when-revealed-alter-ego",
    "04120.when-revealed-hero",
    "04121.when-revealed",
    "04121.boost",
    "04122.when-revealed",
    "04122.when-defeated",
    "04123.when-defeated",
    "04124.zolas-experiments-forced-response",
    "04125.red-skull-constant",
    "04126.red-skull-constant",
    "04126.when-revealed",
    "04127.red-skull-constant",
    "04127.when-revealed",
    "04128a.setup",
    "04128a.the-rise-of-red-skull-constant",
    "04128b.the-rise-of-red-skull-forced-response",
    "04129a.when-revealed",
    "04129b.new-world-hydra-forced-response",
    "04129b.new-world-hydra-constant",
    "04130.when-revealed",
    "04130.when-defeated",
    "04131.boost",
    "04132.red-skulls-luger-constant",
    "04132.red-skulls-luger-action",
    "04132.boost",
    "04133.red-skulls-right-hook-constant",
    "04133.red-skulls-right-hook-action",
    "04134.master-strategist-forced-interrupt",
    "04135.twisted-reality-forced-interrupt",
    "04136.when-revealed",
    "04136.boost",
    "04137.when-revealed",
    "04137.boost",
    "04138.when-revealed-alter-ego",
    "04138.when-revealed-hero",
    "04139.the-red-house-constant",
    "04139.the-red-house-interrupt",
    "04140.the-sleeper-awakened-constant",
    "04140.when-revealed",
    "04141.when-defeated",
    "04142.when-defeated",
    "04143.when-defeated",
    "04144.when-revealed",
    "04145.hydra-flame-soldier-forced-response",
    "04145.boost",
    "04146.boost",
    "04148.combat-knife-constant",
    "04148.combat-knife-action",
    "04149.hydra-sidearm-forced-interrupt",
    "04149.hydra-sidearm-action",
    "04150.when-revealed-alter-ego",
    "04150.when-revealed-hero",
    "04151.when-revealed-alter-ego",
    "04151.when-revealed-hero",
    "04154.when-defeated",
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
    "04165.obligation",
    "04166.obligation",
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

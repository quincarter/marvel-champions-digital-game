/**
 * Coverage for every wave 3 (cycle 2) pack (docs/phase7-wave3-scripting.md "Progress"): which packs are fully
 * scripted, which are in progress, which are not started, and — for a pack that isn't started — that anything
 * which happens to resolve anyway is accounted for entirely by `reprints.ts`'s automatic reprint aliasing, never
 * a stray hand-scripted id. Modeled directly on `../wave2/coverage.test.ts`.
 */
import { DRAX_CARDS, GAM_CARDS, GMW_CARDS, RON_CARDS, STLD_CARDS, VNM_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { coveredByEngineRule } from "../dsl/index.js";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { WAVE3_ABILITIES, wave3ReprintPairs } from "./index.js";
import { DRAX_ABILITIES } from "./drax/index.js";
import { GAM_ABILITIES } from "./gam/index.js";
import { GMW_ABILITIES } from "./gmw/index.js";
import { RON_ABILITIES } from "./ron/index.js";
import { STLD_ABILITIES } from "./stld/index.js";
import { VNM_ABILITIES } from "./vnm/index.js";
import { abilityRefIds } from "../ability-refs.js";

describe("wave 3 ability registry", () => {
  it("includes every Core/wave 1 script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE1_ABILITIES)) expect(WAVE3_ABILITIES[id], id).toBe(definition);
  });
  it("includes every cycle 1 script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE2_ABILITIES)) expect(WAVE3_ABILITIES[id], id).toBe(definition);
  });
});

/** Every ability id `reprints.ts` supplies for this pack's own cards. */
const reprintIdsOf = (cards: readonly AnyCard[]): ReadonlySet<string> => {
  const packIds = new Set(cards.map((c) => c.id as string));
  const ids = new Set<string>();
  for (const { wave3 } of wave3ReprintPairs()) {
    if (!packIds.has(wave3.id as string)) continue;
    for (const ref of abilityRefIds(wave3)) ids.add(ref);
  }
  return ids;
};

/** One row per wave 3 pack (docs/phase7-wave3.md "Wave 3"). */
const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  gmw: "in progress",
  stld: "scripted",
  gam: "scripted",
  drax: "scripted",
  vnm: "scripted",
  ron: "in progress",
};

/**
 * Ability refs a pack deliberately leaves unscripted (docs/phase7-wave1-scripting.md §4, "missing primitive →
 * record and skip"). Pinned exactly: every other ref must resolve, and each listed ref must still be unresolved.
 * Regenerated programmatically with `MC_REFS_PACKS=gmw pnpm refs` — never hand-typed (docs/card-scripting-
 * process.md).
 */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {
  gmw: [
    // Groot's and Rocket Raccoon's kits/obligations/nemeses, Brotherhood of Badoon (villain Drang, main scheme
    // Terrestrial Invasion/Protect the Planet, Badoon Ship, Drang's Spear, Badoon Engineer, the four side
    // schemes, the Band of Badoon modular set), the Ship Command modular set, Infiltrate the Museum (villain
    // Collector I–III, main scheme The Grand Collection, its own encounter set, and Menagerie Medley — `gmw/
    // museum.ts`), Escape the Museum (the mode-labelled Collector pair, main scheme The Missing Milano/Lost
    // in the Museum/The Great Escape, "I Have You Now!", Impossible Geometry — `gmw/escape-the-museum.ts`), and
    // Nebula (villain Nebula I–III, main scheme The Art of Evasion/Warp Drive Initiated, Nebula's Ship, the five
    // Technique attachments, Lethal Intent, Barrel Roll, Combat Ready, the Space Pirates modular set, and the
    // Power Stone modular card — `gmw/nebula.ts`), and Ronan the Accuser (villain Ronan the Accuser I–III, main
    // scheme Interception Imminent/"Take What Is Mine", Kree Command Ship, Universal Weapon, Fanaticism, the side
    // schemes Cut the Power/Pincer Maneuver/Superior Tactics, the treacheries Single-Minded Fury/Kree Physiology/
    // "You Stand Accused!", and the Kree Militants modular set — `gmw/ronan.ts`) are scripted. A second primitives
    // pass closed all 13 refs left as gaps by the first (docs/phase7-wave3.md §3.28–§3.38, docs/phase7-wave3-
    // scripting.md §6d): 16006/16009/16024 (Groot, `gmw/groot-kit.ts`), 16032/16033/16052 (Rocket,
    // `gmw/rocket-kit.ts`), 16020/16048 (Flora and Fauna, scripted identically in both files, tested together in
    // `gmw/flora-and-fauna.test.ts`), 16060.when-revealed (Drang III, `gmw/badoon.ts`),
    // 16073b.the-grand-collection-action (`gmw/museum.ts`), and 16085a.this-way plus 16085b's three refs
    // (`gmw/escape-the-museum.ts`). Ruthless (16102, `gmw/ruthless.ts`) was left in KNOWN_SKIPPED with no
    // recorded reason by the first pass — a bare oversight, not a primitive gap; scripted with the existing
    // enemyScheme/enemyAttack bind-and-read pattern. The Galactic Artifacts modular set (16122–16130,
    // `gmw/galactic-artifacts.ts`) and the Badoon Headhunter modular set (16183–16185,
    // `gmw/badoon-headhunter.ts`, modular per RRG 1.8 FAQ p. 61 despite its campaign-numbered cards) are now
    // scripted too. A third primitives pass (docs/phase7-wave3.md §3.39/§3.40/§3.43, docs/phase7-wave3-scripting.md
    // §6d) closed the last two Ronan the Accuser gaps too: 16114.when-revealed (Single-Minded Fury, `PlayerRef
    // controllerOf` + `TargetQuery.hasAttachment`) and 16131.kree-combat-armor-action (`AbilityCost.
    // sameResourceType`). Remaining genuine primitive gap: 16125.the-poison-forced-interrupt (`turnStarted` has no
    // interrupt window, module docblock in `gmw/galactic-artifacts.ts`). `gmw/nebula.ts` and `gmw/ronan.ts` have
    // no remaining genuine primitive gaps — every primitive they needed has landed.
    // Regenerated with `MC_REFS_PACKS=gmw pnpm refs` (docs/card-scripting-process.md) — never hand-typed.
    "16125.the-poison-forced-interrupt",
    "16150.brainstorm-constant",
    "16150.brainstorm-action",
    "16151.by-any-means-constant",
    "16151.by-any-means-action",
    "16152.contingency-plan-constant",
    "16152.contingency-plan-action",
    "16153.in-defiance-constant",
    "16153.in-defiance-interrupt",
    "16154.calculate-the-odds-constant",
    "16154.calculate-the-odds-action",
    "16155.creative-solution-constant",
    "16155.creative-solution-action",
    "16155.creative-solution-constant-2",
    "16155.creative-solution-constant-3",
    "16155.creative-solution-constant-4",
    "16156.grapple-constant",
    "16156.grapple-action",
    "16157.wing-it-constant",
    "16157.wing-it-action",
    "16158.close-call-constant",
    "16158.close-call-interrupt",
    "16159.defy-danger-constant",
    "16159.defy-danger-action",
    "16160.in-harms-way-constant",
    "16160.in-harms-way-action",
    "16161.take-the-fight-to-them-constant",
    "16161.take-the-fight-to-them-action",
    "16162.armor-plating-constant",
    "16162.armor-plating-interrupt",
    "16163.heavy-cannon-constant",
    "16163.heavy-cannon-action",
    "16164.hyper-thrusters-constant",
    "16164.hyper-thrusters-action",
    "16165.reactor-core-constant",
    "16165.reactor-core-action",
    "16166.ardent-resolve-constant",
    "16166.ardent-resolve-action",
    "16167.onrush-constant",
    "16167.onrush-interrupt",
    "16168.safeguard-constant",
    "16168.safeguard-action",
    "16169.sure-gamble-constant",
    "16169.sure-gamble-action",
    "16170.cargo-hold-constant",
    "16170.cargo-hold-action",
    "16171.mounted-laser-constant",
    "16171.mounted-laser-action",
    "16172.navigation-column-constant",
    "16172.navigation-column-action",
    "16173.targeting-screen-constant",
    "16173.targeting-screen-action",
    "16174.grand-strategy-constant",
    "16174.grand-strategy-action",
    "16175.power-unleashed-constant",
    "16175.power-unleashed-action",
    "16176.tried-and-true-constant",
    "16176.tried-and-true-action",
    "16177.triple-threat-constant",
    "16177.triple-threat-action",
    "16178a.badoon-blitz-constant",
    "16178a.when-defeated",
    "16178b.badoon-blitz-constant",
    "16178b.when-defeated",
    "16179a.gallery-of-splendor-constant",
    "16179a.when-defeated",
    "16179b.gallery-of-splendor-constant",
    "16179b.when-defeated",
    "16180a.there-is-no-escape-constant",
    "16180a.when-defeated",
    "16180b.there-is-no-escape-constant",
    "16180b.when-defeated",
    "16181a.guerrilla-tactics-constant",
    "16181a.when-defeated",
    "16181b.guerrilla-tactics-constant",
    "16181b.when-defeated",
    "16182a.kree-supremacy-constant",
    "16182b.kree-supremacy-constant",
  ],
  // stld: fully scripted — no genuine primitive gaps (module docblock, `wave3/stld/star-lord-kit.ts`). The last
  // three (17005.sliding-shot-constant, 17017.target-practice-interrupt, 17029.agile-flight-action) closed in the
  // third primitives pass (docs/phase7-wave3.md §3.39–§3.42). His obligation and nemesis set are fully scripted
  // too. Regenerated with `MC_REFS_PACKS=stld pnpm refs` — never hand-typed.
  stld: [],
  gam: [],
  drax: [
    // Drax's kit, obligation and nemesis set are scripted (docs/phase7-wave3-scripting.md, `wave3/drax/`). The two
    // remaining genuine primitive gaps closed in the third primitives pass (docs/phase7-wave3.md §3.44/§3.45):
    // 19012.martyr-response (consequential damage now reports its basic power's own results onto itself) and
    // 19032.regroup-interrupt (`setDefeatDestination`, `characterDefeated.fromAttack`). 19013.moondragon-action
    // stays skipped per docs/phase7-wave3.md §3.23/§4 Q12 (an enemy attacking another enemy — intentionally left
    // unbuilt this wave, not this pack's gap to resolve). Regenerated with `MC_REFS_PACKS=drax pnpm refs` — never
    // hand-typed.
    "19013.moondragon-action",
  ],
  // vnm: fully scripted — no genuine primitive gaps (module docblock, `wave3/vnm/venom-kit.ts`). Regenerated with
  // `MC_REFS_PACKS=vnm pnpm refs` — never hand-typed.
  vnm: [],
  // ron: one genuine primitive gap (module docblock, `wave3/ron/kree-fanatic.ts`): 90005.when-revealed needs a
  // `CardDestination` for dealing a specific already-known card to a player facedown, distinct from
  // `EffectSpec dealEncounterCard`'s "draw a new card from the deck top". Regenerated with `MC_REFS_PACKS=ron
  // pnpm refs` — never hand-typed.
  ron: ["90005.when-revealed"],
};

const PACKS: ReadonlyArray<{ readonly code: string; readonly cards: readonly AnyCard[] }> = [
  { code: "gmw", cards: GMW_CARDS },
  { code: "stld", cards: STLD_CARDS },
  { code: "gam", cards: GAM_CARDS },
  { code: "drax", cards: DRAX_CARDS },
  { code: "vnm", cards: VNM_CARDS },
  { code: "ron", cards: RON_CARDS },
];

describe("wave 3 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs @mc/content exports for wave 3 (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const reprintIds = reprintIdsOf(cards);
    const missing = allRefs.filter((id) => !(id in WAVE3_ABILITIES));
    const resolvedBeyondReprints = allRefs.filter((id) => id in WAVE3_ABILITIES && !reprintIds.has(id));

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

/**
 * A registered-but-untested guard (docs/phase7-wave3-scripting.md "§7 Progress" / the standing rule earned this
 * pass): `pnpm refs` / the coverage test above only prove an ability id *resolves* — that some `AbilityDefinition`
 * is registered under it. Neither proves anything ever drives real commands into it. Three scripting sessions in a
 * row reported "every ability backed by a real-command test" while some had none at all (an interrupt/response
 * with an unpayable cost among them, found only once a real test was written — docs/phase7-wave3-scripting.md §4's
 * "This is the load-bearing lesson of this whole checkpoint" bullet).
 *
 * So: for each wave 3 pack that has started, every ability id its own module registers (never a reprint alias —
 * those are `../reprints.ts`'s job and are tested there) must appear, as a literal string, in at least one
 * `*.test.ts` file in that pack's own folder. Naming the id is necessary, not sufficient — a reviewer still has to
 * check the test that names it actually drives the ability through a real command and asserts on the result, not
 * merely mentions the string in a comment. This only catches the "nobody even claims to test this" case.
 *
 * A pack is added here as one entry once it exists (`wave3/<pack>/index.ts` exporting its own registry) — see
 * `../wave2/coverage.test.ts`'s own precedent for the analogous per-pack table shape.
 */
describe("wave 3 pack ability id coverage (every registered ability id is named in that pack's own tests)", () => {
  // Raw source text of every wave 3 pack's own `*.test.ts` file, read at build time via Vite's `import.meta.glob`
  // rather than `node:fs` — `@mc/cards`'s `tsconfig.json` carries no `"node"` or `"vite/client"` types (its `src`
  // is engine-adjacent content code, never a Node or Vite-config script), so a `node:fs` import or an untyped
  // `import.meta.glob` call would fail `pnpm typecheck` for the whole package rather than just this file. Cast
  // `import.meta` locally instead of widening the package's own `tsconfig.json` for one test — Vite's static
  // `import.meta.glob` transform still matches this call after TS strips the `as ImportMetaEnv` cast, so the glob
  // pattern must stay a literal string right here (it cannot be pulled into a helper function).
  const rawTestFiles = (import.meta as unknown as ImportMetaEnv).glob("./*/*.test.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  interface ImportMetaEnv {
    readonly glob: (pattern: string, opts: object) => unknown;
  }

  /** Every `*.test.ts` file's contents under `wave3/<pack>/`, concatenated. */
  const packTestText = (pack: string): string =>
    Object.entries(rawTestFiles)
      .filter(([path]) => path.startsWith(`./${pack}/`))
      .map(([, text]) => text)
      .join("\n");

  const PACKS_WITH_OWN_REGISTRIES: ReadonlyArray<{ readonly code: string; readonly registry: AbilityRegistry }> = [
    { code: "gmw", registry: GMW_ABILITIES },
    { code: "stld", registry: STLD_ABILITIES },
    { code: "gam", registry: GAM_ABILITIES },
    { code: "drax", registry: DRAX_ABILITIES },
    { code: "vnm", registry: VNM_ABILITIES },
    { code: "ron", registry: RON_ABILITIES },
  ];

  /**
   * A principled exemption for `coveredByEngineRule()` ids, not a one-off allowlist: an id is only exempt when its
   * registered definition structurally *is* the `coveredByEngineRule()` sentinel (`{ trigger: { kind: "constant" },
   * effects: [] }`) — so this can't be used to paper over a genuinely untested ability that merely happens to have
   * empty effects — and only alongside the engine test that actually covers the rule it names, cited here by path,
   * so a reviewer can check the citation instead of taking "it's covered elsewhere" on faith.
   *
   * `18001b.gamora-constant` (Skilled Tactician, Gamora's deckbuilding-only ability, `IdentityDeckbuilding.
   * offAspectAllowance`, docs/phase7-wave3.md §1.5): the rule lives on the identity card's data, not on anything an
   * in-game command can drive, so `wave3/gam/*.test.ts` has nothing to name it in. It's tested at the engine level,
   * `packages/engine/src/off-aspect-allowance.test.ts` (4 tests) plus `packages/content/src/schema/wave3.test.ts`
   * §1.5 (2 tests).
   *
   * "Bring It!" (`drax` 19030): the maxperphase-fix pass gave 19030 a real `playRestrictions.maxPerPhase`
   * (`@mc/content`) instead of a bogus `-constant` ability ref, so it no longer needs this exemption — it's
   * covered by behavioral tests in `wave3/drax/drax-pack-cards.test.ts` instead.
   */
  const COVERED_BY_ENGINE_RULE: Readonly<Record<string, string>> = {
    "18001b.gamora-constant": "packages/engine/src/off-aspect-allowance.test.ts",
  };

  it("checks every pack PACK_STATUS marks started, so a new pack can't skip the guard by not being listed here", () => {
    const started = Object.entries(PACK_STATUS)
      .filter(([, status]) => status !== "not started")
      .map(([code]) => code)
      .sort();
    expect(PACKS_WITH_OWN_REGISTRIES.map((p) => p.code).sort()).toEqual(started);
  });

  describe.each(PACKS_WITH_OWN_REGISTRIES)("$code", ({ code, registry }) => {
    it("every ability id it registers is named in one of its own test files (or is a cited coveredByEngineRule() exemption)", () => {
      const text = packTestText(code);
      const sentinel = coveredByEngineRule();
      const unnamed = Object.keys(registry).filter((id) => !text.includes(id));
      const notExempt = unnamed.filter((id) => {
        if (!(id in COVERED_BY_ENGINE_RULE)) return true;
        // Only exempt if the registered definition really is the sentinel shape — never merely because the id is
        // listed, which would make the exemption indistinguishable from a plain allowlist.
        return JSON.stringify(registry[id]) !== JSON.stringify(sentinel);
      });
      expect(
        notExempt,
        `${code} ability ids registered but not named in any wave3/${code}/*.test.ts file (and not a cited coveredByEngineRule() exemption):\n${notExempt.join("\n")}`,
      ).toEqual([]);
    });
  });
});

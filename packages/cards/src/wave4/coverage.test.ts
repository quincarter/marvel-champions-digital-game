/**
 * Coverage for every wave 4 (cycle 4) pack (docs/phase7-wave4.md), modeled directly on `../wave3/coverage.test.ts`:
 * which packs are fully scripted, which are not started, and — for a pack that isn't started — nothing resolves
 * that isn't already covered by an earlier wave.
 */
import { HOOD_CARDS, MTS_CARDS, NEBU_CARDS, VALK_CARDS, VISION_CARDS, WARM_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { WAVE4_ABILITIES } from "./index.js";
import { HOOD_ABILITIES } from "./hood/index.js";
import { MTS_ABILITIES } from "./mts/index.js";
import { NEBU_ABILITIES } from "./nebu/index.js";
import { VALK_ABILITIES } from "./valk/index.js";
import { VISION_ABILITIES } from "./vision/index.js";
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
  valk: "scripted",
  vision: "scripted",
  mts: "in progress",
  hood: "in progress",
};

/**
 * Ability refs a wave 4 pack deliberately leaves unscripted (docs/phase7-wave1-scripting.md §4, "missing primitive →
 * record and skip"). Pinned exactly: every other ref must resolve, and each listed ref must still be unresolved.
 *
 * `mts`: Spectrum's and Adam Warlock's own genuine primitive gaps (see the docblocks on the `mts/*.ts` file that
 * skips each), plus every `mts` encounter/campaign ability ref not yet scripted — "encounter side: scripted by the
 * mts scenario passes (wave 4 step 3)" — a reason the next agent removes as that ref lands.
 */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {
  // nebu: both of its earlier primitive gaps (an in-play "discard cards you control" cost kind, and a friendly
  // character attacking its own controller without exhausting) landed since (`nebula-obligation-nemesis.ts` now
  // scripts both 22030.lethal-weapon-action and 22031.when-revealed); nothing left unresolved.
  // warm: no primitive gaps found; every ability ref resolves.
  // mts: nine refs pulled out of this list here (21044, 21045, 21049, 21051, 21056, 21057, 21062, 21063, 21157) —
  // exact reprints of earlier cards (Uppercut, Combat Training, …) that `../reprints.ts` only started auto-aliasing
  // once its `PACK_OWN_ABILITIES` protection set grew to include `MTS_ABILITIES` (needed regardless, to stop a
  // coincidental name/type match — White Tiger, 21013, reprinted from `trors` — from clobbering mts's own script
  // for the same ref with `mergeRegistries`'s "defined twice" guard). Not this pack's own scripting work; removed
  // here because leaving them would silently pin a wrong (unresolved) expectation now that they resolve.
  //
  // Thanos (`mts/thanos.ts`) and the Infinity Gauntlet modular set (`mts/infinity-gauntlet.ts`), the box's third
  // scenario: every ref in scope (the villain, the main scheme, the `thanos` encounter set, and the `infinity_
  // gauntlet` set) resolves; no genuine gap found. Black Order (21100–21110, scripted by Tower Defense) and
  // Children of Thanos (21125–21128, `mts/children-of-thanos.ts`, Thanos's own other recommended modular) and
  // Enchantress (21177–21179, `mts/enchantress.ts`, one of Loki's own two recommended modulars): every ref
  // resolves; no genuine gap found.
  //
  // The Loki scenario (`mts/loki.ts`, `mts` 21160–21176, the box's fifth): every ref resolves (Infinite Mischief's
  // When Revealed uses `scenarioDeckShuffle`, docs/phase7-wave4.md §3.49).
  mts: [
    // legions-of-hel.ts and frost-giants.ts (Hela's own two recommended modular sets): every ref resolves; no
    // genuine gap found.
    "21180a.when-defeated",
    "21180b.cosmo-constant",
    "21180b.cosmo-constant-2",
    "21180b.cosmo-forced-interrupt",
    "21181.when-revealed",
    "21181.when-defeated",
    "21182a.when-defeated",
    "21182b.black-swan-constant",
    "21182b.black-swan-forced-response",
    "21184a.when-defeated",
    "21184b.defensive-protocols-forced-interrupt",
    "21185.obligation",
    "21186a.find-the-norn-stones-constant",
    "21186a.when-defeated",
    "21186b.retrieve-odins-armor-constant",
    "21186b.when-defeated",
    "21187a.norn-stone-constant",
    "21187a.norn-stone-action",
    "21187b.norn-stone-constant",
    "21187b.norn-stone-action",
    "21188.when-revealed",
    "21189a.when-defeated",
    "21189b.jormungand-constant",
    "21189b.jormungand-forced-interrupt",
    "21190.lady-sif-action",
    "21191.fandral-constant",
    "21192.hogun-constant",
  ],
  // hood: the villain (24001-24003), the main scheme (24004-24006), The Hood's own encounter set (24007-24013) and
  // Beasty Boys (24014-24017, `hood/beasty-boys.ts`), Brothers Grimm (24018-24022, `hood/brothers-grimm.ts`) and
  // Crossfire's Crew (24023-24028, `hood/crossfire-crew.ts`), Mister Hyde (24033-24036, `hood/mister-hyde.ts`) and
  // State of Emergency (24055-24059, `hood/state-of-emergency.ts`) are scripted. Everything below is the pack's
  // remaining four modular sets (Ransacked Armory, Sinister Syndicate, Streets of Mayhem, Wrecking Crew) plus
  // Standard II / Expert II, left for the next scripting pass
  // (24041 and 24067 have no ability refs at all — plain-stat cards — and 24053's "Shadow of the Past" ref already
  // resolves as a reprint alias via `../reprints.ts`; none of the three are listed below).
  hood: [
    // Beasty Boys (`hood/beasty-boys.ts`): every ref resolves except two genuine gaps (the module's own docblock).
    "24014.beast-mode-forced-interrupt",
    "24016.mandrill-constant",
    // Brothers Grimm (`hood/brothers-grimm.ts`): every ref resolves; no genuine gap found.
    // Crossfire's Crew (`hood/crossfire-crew.ts`): every ref resolves except two genuine gaps (the module's own
    // docblock) — Out for Blood's own "repeat this effect" and Controller's "increase that amount" (Beast Mode's
    // same gap).
    "24023.when-revealed",
    "24023.boost",
    "24024.controller-forced-interrupt",
    "24029.when-revealed",
    "24029.boost",
    "24030.when-revealed",
    "24031.when-revealed",
    "24032.when-revealed",
    "24032.boost",
    // Mister Hyde (`hood/mister-hyde.ts`): every ref resolves; no genuine gap found.
    "24037.flamethrower-constant",
    "24037.flamethrower-constant-2",
    "24038.holoshield-generator-constant",
    "24038.holoshield-generator-constant-2",
    "24039.jetpack-constant",
    "24039.jetpack-forced-interrupt",
    "24040.tech-gauntlets-constant",
    "24040.tech-gauntlets-constant-2",
    "24040.tech-gauntlets-constant-3",
    "24042.when-revealed",
    "24043.beetle-forced-response",
    "24043.boost",
    "24044.boomerang-forced-response",
    "24044.boost",
    "24045.shocker-forced-response",
    "24045.boost",
    "24046.speed-demon-forced-interrupt",
    "24046.boost",
    "24047.white-rabbit-forced-interrupt",
    "24047.boost",
    "24048.when-revealed-alter-ego",
    "24048.when-revealed-hero",
    "24049a.formidable-foe-constant",
    "24049b.formidable-foe-constant",
    "24050.when-revealed",
    "24050.boost",
    "24051.when-revealed-alter-ego",
    "24051.when-revealed-hero",
    "24052.when-revealed",
    "24052.boost",
    "24054.when-revealed-hero",
    "24054.boost",
    // State of Emergency (`hood/state-of-emergency.ts`): every ref resolves except two genuine gaps (the module's
    // own docblock) — Feisty Heist's "highest-cost card from your hand" and Citywide Crisis's own re-triggered
    // "When Revealed" ability.
    "24055.when-revealed",
    "24059.when-revealed",
    "24059.boost",
    "24060.when-revealed",
    "24060.back-alley-enclave-constant",
    "24061.when-revealed",
    "24061.secret-lair-constant",
    "24061.secret-lair-constant-2",
    "24062.when-revealed",
    "24062.sewer-tunnels-constant",
    "24063.when-revealed",
    "24063.warehouse-district-constant",
    "24064.top-talent-constant",
    "24065.wrecker-constant",
    "24066.bulldozer-constant",
    "24068.thunderball-forced-response",
    "24069.when-revealed",
    "24069.boost",
    "24070.when-revealed",
  ],
};

const PACKS: ReadonlyArray<{ readonly code: string; readonly cards: readonly AnyCard[] }> = [
  { code: "nebu", cards: NEBU_CARDS },
  { code: "warm", cards: WARM_CARDS },
  { code: "valk", cards: VALK_CARDS },
  { code: "vision", cards: VISION_CARDS },
  { code: "mts", cards: MTS_CARDS },
  { code: "hood", cards: HOOD_CARDS },
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
    { code: "valk", registry: VALK_ABILITIES },
    { code: "vision", registry: VISION_ABILITIES },
    { code: "mts", registry: MTS_ABILITIES },
    { code: "hood", registry: HOOD_ABILITIES },
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

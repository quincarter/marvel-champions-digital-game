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
  // Children of Thanos (21125–21128), a modular set Thanos also recommends, stay skipped below for whichever
  // scenario pass scripts the latter.
  mts: [
    "21125.boost",
    "21126.proxima-midnight-constant",
    "21126.boost",
    "21127.boost",
    "21128.when-defeated",
    "21136a.hela-constant",
    "21136a.hela-constant-2",
    "21136b.hela-constant",
    "21136b.hela-forced-response",
    "21137a.hela-constant",
    "21137a.hela-constant-2",
    "21137b.hela-constant",
    "21137b.hela-forced-response",
    "21138a.setup",
    "21138b.odins-torment-forced-interrupt",
    "21139a.odin-constant",
    "21139a.odin-constant-2",
    "21139b.odin-constant",
    "21139b.odin-constant-2",
    "21139b.odin-forced-interrupt",
    "21140.when-defeated",
    "21141.when-defeated",
    "21142.when-defeated",
    "21143.garm-constant",
    "21143.garm-constant-2",
    "21144.skurge-constant",
    "21144.skurge-constant-2",
    "21144.skurge-constant-3",
    "21145.nidhogg-constant",
    "21145.nidhogg-constant-2",
    "21145.nidhogg-constant-3",
    "21146.nightsword-constant",
    "21146.boost",
    "21147.helas-crown-forced-response",
    "21147.boost",
    "21148.helas-cloak-constant",
    "21148.boost",
    "21149.when-revealed",
    "21149.boost",
    "21150.when-revealed-alter-ego",
    "21150.when-revealed-hero",
    "21151.when-revealed",
    "21151.boost",
    "21152.when-revealed",
    "21153.fallen-warrior-constant",
    "21153.when-revealed",
    "21154.when-revealed",
    "21155.when-revealed",
    "21156.laufey-forced-response",
    "21158.frozen-constant",
    "21158.frozen-action",
    "21159.unnatural-storm-constant",
    "21159.when-revealed",
    "21160.loki-constant",
    "21160.when-defeated",
    "21161.when-defeated",
    "21162.when-defeated",
    "21163.when-defeated",
    "21164.loki-constant",
    "21164.when-defeated",
    "21165a.setup",
    "21165b.all-hail-king-loki-forced-interrupt",
    "21165b.all-hail-king-loki-constant",
    "21166.when-defeated",
    "21167.when-defeated",
    "21168.when-defeated",
    "21169.when-defeated",
    "21170.lokis-staff-response",
    "21170.boost",
    "21171.lokis-crown-response",
    "21171.boost",
    "21172.lokis-cape-forced-response",
    "21172.lokis-cape-response",
    "21173.master-of-illusions-forced-interrupt",
    "21174.when-revealed-alter-ego",
    "21174.when-revealed-hero",
    "21175.when-revealed",
    "21175.boost",
    "21176.when-revealed",
    "21176.boost",
    "21177.when-revealed",
    "21178.beguiled-constant",
    "21178.when-revealed",
    "21179.seduced-constant",
    "21179.seduced-action",
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
  // hood: the villain (24001-24003), the main scheme (24004-24006) and The Hood's own encounter set (24007-24013)
  // are scripted (`hood/hood.ts`). Everything below is the pack's nine modular sets (Beasty Boys, Brothers Grimm,
  // Crossfire's Crew, Mister Hyde, Ransacked Armory, Sinister Syndicate, State of Emergency, Streets of Mayhem,
  // Wrecking Crew) plus Standard II / Expert II, left for the next scripting pass on this pack (24041 and 24067
  // have no ability refs at all — plain-stat cards — and 24053's "Shadow of the Past" ref already resolves as a
  // reprint alias via `../reprints.ts`; none of the three are listed below).
  hood: [
    "24014.beast-mode-forced-interrupt",
    "24015.griffin-forced-response",
    "24015.when-defeated",
    "24016.mandrill-constant",
    "24016.when-revealed",
    "24017.when-revealed",
    "24017.boost",
    "24018.brothers-grimm-forced-interrupt",
    "24018.boost",
    "24019.blackbird-pellets-forced-response",
    "24020.corrosive-egg-bomb-forced-response",
    "24021.paralytic-stardust-forced-response",
    "24022.unbreakable-thread-forced-response",
    "24023.when-revealed",
    "24023.boost",
    "24024.controller-forced-interrupt",
    "24025.when-revealed",
    "24025.boost",
    "24026.crossfire-forced-interrupt",
    "24027.mister-fear-constant",
    "24027.boost",
    "24028.when-revealed",
    "24029.when-revealed",
    "24029.boost",
    "24030.when-revealed",
    "24031.when-revealed",
    "24032.when-revealed",
    "24032.boost",
    "24033.when-revealed",
    "24033.self-experimentation-forced-interrupt",
    "24034.when-revealed",
    "24034.when-defeated",
    "24035.when-revealed",
    "24036.when-revealed",
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
    "24055.when-revealed",
    "24056.when-revealed",
    "24057.when-revealed",
    "24058.when-revealed",
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

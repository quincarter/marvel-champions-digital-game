/**
 * Coverage for every wave 3 (cycle 2) pack (docs/phase7-wave3-scripting.md "Progress"): which packs are fully
 * scripted, which are in progress, which are not started, and — for a pack that isn't started — that anything
 * which happens to resolve anyway is accounted for entirely by `reprints.ts`'s automatic reprint aliasing, never
 * a stray hand-scripted id. Modeled directly on `../wave2/coverage.test.ts`.
 */
import { DRAX_CARDS, GAM_CARDS, GMW_CARDS, RON_CARDS, STLD_CARDS, VNM_CARDS, type AnyCard } from "@mc/content";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { WAVE3_ABILITIES, wave3ReprintPairs } from "./index.js";
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
  stld: "in progress",
  gam: "not started",
  drax: "not started",
  vnm: "not started",
  ron: "not started",
};

/**
 * Ability refs a pack deliberately leaves unscripted (docs/phase7-wave1-scripting.md §4, "missing primitive →
 * record and skip"). Pinned exactly: every other ref must resolve, and each listed ref must still be unresolved.
 * Regenerated programmatically with `MC_REFS_PACKS=gmw pnpm refs` — never hand-typed (docs/card-scripting-
 * process.md).
 */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {
  gmw: [
    // Groot's own kit and obligation/nemesis are fully scripted; Rocket Raccoon's kit and obligation/
    // nemesis are (docs/phase7-wave3-scripting.md). Genuine primitive gaps (module docblocks in
    // `gmw/groot-kit.ts` and `gmw/rocket-kit.ts`): 16006, 16009, 16024 (Groot); 16032, 16033, 16052
    // (Rocket); 16020/16048 (the Team-Up card, printed once per range, same cross-player targeting gap
    // both times). Everything from 16058 on (Brotherhood of Badoon's villain Drang onward) is the first
    // scenario and its modular set — not yet reached this session. Regenerated with
    // `MC_REFS_PACKS=gmw pnpm refs` (docs/card-scripting-process.md) — never hand-typed.
    "16006.we-are-groot-action",
    "16009.lashing-vines-response",
    "16020.flora-and-fauna-constant",
    "16020.flora-and-fauna-action",
    "16024.deft-focus-action",
    "16032.schadenfreude-action",
    "16033.salvage-response",
    "16048.flora-and-fauna-constant",
    "16048.flora-and-fauna-action",
    "16052.booster-boots-interrupt",
    "16058.drang-forced-response",
    "16059.when-revealed",
    "16059.drang-forced-response",
    "16060.when-revealed",
    "16060.drang-forced-response",
    "16061a.setup",
    "16061b.terrestrial-invasion-forced-response",
    "16061b.terrestrial-invasion-constant",
    "16062a.when-revealed",
    "16062b.protect-the-planet-forced-response",
    "16062b.protect-the-planet-constant",
    "16063.charge-up",
    "16064.drangs-spear-constant",
    "16064.drangs-spear-action",
    "16065.badoon-engineer-forced-response",
    "16065.boost",
    "16066.blockade-constant",
    "16067.bombardment-forced-response",
    "16067.bombardment-constant",
    "16068.oppressive-armada-constant",
    "16069.spatial-positioning-constant",
    "16070.collector-forced-interrupt",
    "16071.when-revealed",
    "16071.collector-forced-interrupt",
    "16072.when-revealed",
    "16072.collector-forced-interrupt",
    "16073a.setup",
    "16073b.the-grand-collection-action",
    "16073b.the-grand-collection-constant",
    "16074.biogram-image-forced-interrupt",
    "16074.boost",
    "16076.when-revealed",
    "16076.boost",
    "16077.when-revealed",
    "16077.view-the-cosmos-constant",
    "16077.view-the-cosmos-constant-2",
    "16078.when-revealed-alter-ego",
    "16078.when-revealed-hero",
    "16080a.collector-constant",
    "16080a.collector-forced-interrupt",
    "16080b.collector-constant",
    "16080b.collector-forced-interrupt",
    "16081a.collector-constant",
    "16081a.collector-forced-interrupt",
    "16081b.collector-constant",
    "16081b.collector-forced-interrupt",
    "16082a.setup",
    "16082b.the-missing-milano-forced-interrupt",
    "16083a.when-revealed",
    "16083b.lost-in-the-museum-forced-interrupt",
    "16084a.when-revealed",
    "16084b.the-great-escape-constant",
    "16084b.the-great-escape-constant-2",
    "16085a.this-way",
    "16085b.hold-on-to-your-butts",
    "16085b.museum-ship-constant",
    "16085b.museum-ship-constant-2",
    "16086.when-revealed-alter-ego",
    "16086.when-revealed-hero",
    "16086.boost",
    "16087.when-revealed",
    "16088.nebula-constant",
    "16088.nebula-forced-interrupt",
    "16089.nebula-constant",
    "16089.nebula-forced-interrupt",
    "16090.nebula-constant",
    "16090.nebula-forced-interrupt",
    "16091a.setup",
    "16091b.the-art-of-evasion-constant",
    "16092a.when-revealed",
    "16092b.warp-drive-initiated-constant",
    "16093.nebulas-ship-forced-interrupt",
    "16093.nebulas-ship-constant",
    "16094.cutthroat-ambition-constant",
    "16094.cutthroat-ambition-special",
    "16094.boost",
    "16095.evasive-maneuvering-constant",
    "16095.evasive-maneuvering-special",
    "16095.boost",
    "16096.unyielding-persistence-constant",
    "16096.unyielding-persistence-special",
    "16096.boost",
    "16097.weapon-mastery-constant",
    "16097.weapon-mastery-special",
    "16097.boost",
    "16098.wide-stance-constant",
    "16098.wide-stance-special",
    "16098.boost",
    "16099.when-revealed",
    "16100.when-revealed",
    "16100.boost",
    "16101.when-revealed",
    "16102.when-revealed-alter-ego",
    "16102.when-revealed-hero",
    "16103.ronan-the-accuser-forced-interrupt",
    "16104.when-revealed",
    "16104.ronan-the-accuser-forced-interrupt",
    "16105.when-revealed",
    "16105.ronan-the-accuser-forced-interrupt",
    "16106a.setup",
    "16106b.interception-imminent-constant",
    "16107a.when-revealed",
    "16107b.take-what-is-mine-constant",
    "16108.kree-command-ship-constant",
    "16109.universal-weapon-constant",
    "16109.universal-weapon-action",
    "16109.boost",
    "16110.fanaticism-forced-interrupt",
    "16111.boost",
    "16112.pincer-maneuver-constant",
    "16113.superior-tactics-constant",
    "16113.when-revealed",
    "16114.when-revealed",
    "16114.boost",
    "16115.when-revealed",
    "16116.when-revealed-alter-ego",
    "16116.when-revealed-hero",
    "16116.boost",
    "16117.badoon-assassin-forced-response",
    "16117.boost",
    "16118.badoon-grunt-forced-response",
    "16118.boost",
    "16119.boost",
    "16120.boost",
    "16121.badoon-warlord-constant",
    "16121.boost",
    "16122.cloak-of-hercules-action",
    "16123.obedience-potion-constant",
    "16123.obedience-potion-action",
    "16124.the-beyonders-blazer-action",
    "16125.the-poison-forced-interrupt",
    "16125.the-poison-action",
    "16126.vandarian-power-stone-action",
    "16127.when-defeated",
    "16128.when-defeated",
    "16129.when-defeated",
    "16130.when-defeated",
    "16131.kree-combat-armor-constant",
    "16131.kree-combat-armor-action",
    "16132.boost",
    "16133.boost",
    "16134.boost",
    "16135.when-revealed",
    "16135.boost",
    "16137.starshark-constant",
    "16137.boost",
    "16138.pirate-commander-forced-response",
    "16138.boost",
    "16139.pirate-lackey-forced-response",
    "16139.boost",
    "16140.sound-the-alarms-constant",
    "16140.boost",
    "16141.when-revealed",
    "16142.milano-constant",
    "16142.milano-constant-2",
    "16143.rogue-vessel-forced-interrupt",
    "16143.rogue-vessel-constant",
    "16144.cannonade-constant",
    "16145.when-revealed",
    "16145.blind-side-constant",
    "16145.blind-side-constant-2",
    "16145.blind-side-constant-3",
    "16146.when-revealed",
    "16146.hull-breach-constant",
    "16146.hull-breach-constant-2",
    "16146.hull-breach-constant-3",
    "16147.when-revealed",
    "16147.power-siphon-constant",
    "16147.power-siphon-constant-2",
    "16147.power-siphon-constant-3",
    "16148.when-revealed-alter-ego",
    "16148.when-revealed-hero",
    "16149.power-stone-forced-response",
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
    "16183.boost",
    "16184.when-revealed",
    "16184.boost",
    "16185.when-revealed",
    "16185.boost",
  ],
  stld: [
    // Star-Lord's kit is scripted (docs/phase7-wave3-scripting.md, `wave3/stld/star-lord-kit.ts`). Three genuine
    // primitive gaps (module docblock): 17017 (a "character has an attachment matching X" TargetQuery filter,
    // the mirror of `host`/`hostOfSelf`), 17029 (an optional/"up to" form of `EffectSpec divide`), 17005 (a
    // "play only if you control a named card" restriction — a `constant` ability's rules are only active while
    // its own card is in play, so this can't be a `cannotPlay` constant on the event card itself). His
    // obligation and nemesis set are fully scripted. Regenerated with `MC_REFS_PACKS=stld pnpm refs` — never
    // hand-typed.
    "17005.sliding-shot-constant",
    "17017.target-practice-interrupt",
    "17029.agile-flight-action",
  ],
  gam: [],
  drax: [],
  vnm: [],
  ron: [],
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

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
import { BISHOP_EVENTS } from "./aoa/bishop/events.js";
import { BISHOP_IDENTITY } from "./aoa/bishop/identity.js";
import { BISHOP_OBLIGATION_NEMESIS, BISHOP_OBLIGATION_NEMESIS_SKIPPED } from "./aoa/bishop/obligation-nemesis.js";
import { BISHOP_SUPPORT_UPGRADES_ALLIES } from "./aoa/bishop/support-upgrades-allies.js";
import { APOCALYPSE, APOCALYPSE_SKIPPED } from "./aoa/apocalypse.js";
import { BLUE_MOON } from "./aoa/blue-moon.js";
import { CELESTIAL_TECH, CELESTIAL_TECH_SKIPPED } from "./aoa/celestial-tech.js";
import { CLAN_AKKABA } from "./aoa/clan-akkaba.js";
import { DARK_BEAST, DARK_BEAST_SKIPPED } from "./aoa/dark-beast.js";
import { DARK_RIDERS } from "./aoa/dark-riders.js";
import { DYSTOPIAN_NIGHTMARE } from "./aoa/dystopian-nightmare.js";
import { EN_SABAH_NUR, EN_SABAH_NUR_SKIPPED } from "./aoa/en-sabah-nur.js";
import { FOUR_HORSEMEN, FOUR_HORSEMEN_SKIPPED } from "./aoa/four-horsemen.js";
import { GENOSHA, GENOSHA_SKIPPED } from "./aoa/genosha.js";
import { HOUNDS } from "./aoa/hounds.js";
import { INFINITES } from "./aoa/infinites.js";
import { MAGIK_EVENTS } from "./aoa/magik/events.js";
import { MAGIK_IDENTITY, MAGIK_IDENTITY_SKIPPED } from "./aoa/magik/identity.js";
import { MAGIK_OBLIGATION_NEMESIS, MAGIK_OBLIGATION_NEMESIS_SKIPPED } from "./aoa/magik/obligation-nemesis.js";
import {
  MAGIK_SUPPORT_UPGRADES_ALLIES,
  MAGIK_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./aoa/magik/support-upgrades-allies.js";
import { PRELATES, PRELATES_SKIPPED } from "./aoa/prelates.js";
import { SAVAGE_LAND } from "./aoa/savage-land.js";
import { STANDARD_III, STANDARD_III_SKIPPED } from "./aoa/standard-iii.js";
import { UNUS, UNUS_SKIPPED } from "./aoa/unus.js";
import { AOA_ABILITIES } from "./aoa/index.js";
import { AOA_ASPECT_BASIC, AOA_ASPECT_BASIC_SKIPPED } from "./aoa/aspect-basic.js";
import { AGE_OF_APOCALYPSE, AGE_OF_APOCALYPSE_SKIPPED } from "./aoa/campaign/age-of-apocalypse.js";
import { AOA_BASIC_CAMPAIGN, AOA_BASIC_CAMPAIGN_SKIPPED } from "./aoa/campaign/aoa-basic-campaign.js";
import { AOA_CAMPAIGN, AOA_CAMPAIGN_SKIPPED } from "./aoa/campaign/aoa-campaign.js";
import { AOA_MISSION, AOA_MISSION_SKIPPED } from "./aoa/campaign/aoa-mission.js";
import { OVERSEER, OVERSEER_SKIPPED } from "./aoa/campaign/overseer.js";
import { ICEMAN_ABILITIES } from "./iceman/index.js";
import { ICEMAN_ASPECT_BASIC, ICEMAN_ASPECT_BASIC_SKIPPED } from "./iceman/aspect-basic.js";
import { ICEMAN_EVENTS, ICEMAN_EVENTS_SKIPPED } from "./iceman/iceman/events.js";
import { ICEMAN_IDENTITY } from "./iceman/iceman/identity.js";
import { ICEMAN_OBLIGATION_NEMESIS, ICEMAN_OBLIGATION_NEMESIS_SKIPPED } from "./iceman/iceman/obligation-nemesis.js";
import { SAURON, SAURON_SKIPPED } from "./iceman/sauron.js";
import {
  ICEMAN_SUPPORT_UPGRADES_ALLIES,
  ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./iceman/iceman/support-upgrades-allies.js";
import { ARCADE } from "./jubilee/arcade.js";
import { JUBILEE_ASPECT_BASIC, JUBILEE_ASPECT_BASIC_SKIPPED } from "./jubilee/aspect-basic.js";
import { JUBILEE_ABILITIES } from "./jubilee/index.js";
import { JUBILEE_EVENTS, JUBILEE_EVENTS_SKIPPED } from "./jubilee/jubilee/events.js";
import { JUBILEE_IDENTITY } from "./jubilee/jubilee/identity.js";
import {
  JUBILEE_OBLIGATION_NEMESIS,
  JUBILEE_OBLIGATION_NEMESIS_SKIPPED,
} from "./jubilee/jubilee/obligation-nemesis.js";
import { JUBILEE_SUPPORT_UPGRADES_ALLIES } from "./jubilee/jubilee/support-upgrades-allies.js";
import { MAGNETO_ASPECT_BASIC, MAGNETO_ASPECT_BASIC_SKIPPED } from "./magneto/aspect-basic.js";
import { HELLFIRE, HELLFIRE_SKIPPED } from "./magneto/hellfire.js";
import { MAGNETO_ABILITIES } from "./magneto/index.js";
import { MAGNETO_IDENTITY, MAGNETO_IDENTITY_SKIPPED } from "./magneto/magneto/identity.js";
import {
  MAGNETO_SUPPORT_UPGRADES_ALLIES,
  MAGNETO_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./magneto/magneto/support-upgrades-allies.js";
import { NCRAWLER_ABILITIES } from "./ncrawler/index.js";
import { NCRAWLER_ASPECT_BASIC } from "./ncrawler/aspect-basic.js";
import { CRAZY_GANG } from "./ncrawler/crazy-gang.js";
import { NIGHTCRAWLER_EVENTS, NIGHTCRAWLER_EVENTS_SKIPPED } from "./ncrawler/nightcrawler/events.js";
import { NIGHTCRAWLER_IDENTITY } from "./ncrawler/nightcrawler/identity.js";
import {
  NIGHTCRAWLER_OBLIGATION_NEMESIS,
  NIGHTCRAWLER_OBLIGATION_NEMESIS_SKIPPED,
} from "./ncrawler/nightcrawler/obligation-nemesis.js";
import { NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES } from "./ncrawler/nightcrawler/support-upgrades-allies.js";

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

/**
 * Scripted modules of a pack still marked "not started": the smallest partial state (modeled on wave 7's). Each names the
 * printed ids it covers and its registry; every ref of those cards is registered or in `skipped` with a reason, and the
 * pack's whole registry is exactly the union of these modules. Remove the entry when the pack is marked scripted.
 */
const SCRIPTED_MODULES: Readonly<
  Record<
    string,
    ReadonlyArray<{
      readonly module: string;
      readonly cardIds: readonly string[];
      readonly registry: AbilityRegistry;
      readonly skipped: Readonly<Record<string, string>>;
    }>
  >
> = {
  aoa: [
    { module: "bishop/identity", cardIds: ["45001a", "45001b"], registry: BISHOP_IDENTITY, skipped: {} },
    {
      module: "bishop/events",
      cardIds: ["45007", "45008", "45009"],
      registry: BISHOP_EVENTS,
      skipped: {},
    },
    {
      module: "bishop/support-upgrades-allies",
      cardIds: ["45002", "45003", "45004", "45005", "45006", "45010"],
      registry: BISHOP_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "bishop/obligation-nemesis",
      cardIds: ["45025", "45026", "45027", "45028", "45029"],
      registry: BISHOP_OBLIGATION_NEMESIS,
      skipped: BISHOP_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "aspect-basic",
      cardIds: [
        "45011",
        "45012",
        "45013",
        "45014",
        "45015",
        "45016",
        "45017",
        "45018",
        "45019",
        "45020",
        "45021",
        "45022",
        "45023",
        "45024",
        "45041",
        "45042",
        "45043",
        "45044",
        "45045",
        "45046",
        "45047",
        "45048",
        "45049",
        "45050",
        "45051",
        "45052",
      ],
      registry: AOA_ASPECT_BASIC,
      skipped: AOA_ASPECT_BASIC_SKIPPED,
    },
    {
      module: "blue-moon",
      cardIds: ["45139", "45140", "45141", "45142", "45143", "45144", "45145", "45146"],
      registry: BLUE_MOON,
      skipped: {},
    },
    {
      module: "celestial-tech",
      cardIds: ["45156", "45157", "45158"],
      registry: CELESTIAL_TECH,
      skipped: CELESTIAL_TECH_SKIPPED,
    },
    {
      module: "clan-akkaba",
      cardIds: ["45159", "45160", "45161", "45162", "45163"],
      registry: CLAN_AKKABA,
      skipped: {},
    },
    {
      module: "en-sabah-nur",
      cardIds: ["45147a", "45149", "45150", "45151", "45152", "45153", "45154", "45155", "45184a"],
      registry: EN_SABAH_NUR,
      skipped: EN_SABAH_NUR_SKIPPED,
    },
    {
      module: "dark-riders",
      cardIds: ["45112", "45113", "45114", "45115", "45116", "45117"],
      registry: DARK_RIDERS,
      skipped: {},
    },
    {
      module: "dystopian-nightmare",
      cardIds: ["45072", "45073", "45074"],
      registry: DYSTOPIAN_NIGHTMARE,
      skipped: {},
    },
    {
      module: "hounds",
      cardIds: ["45097", "45098", "45099", "45100"],
      registry: HOUNDS,
      skipped: {},
    },
    {
      module: "infinites",
      cardIds: ["45069", "45070", "45071"],
      registry: INFINITES,
      skipped: {},
    },
    {
      module: "standard-iii",
      cardIds: ["45075a", "45076", "45077", "45078", "45079", "45080"],
      registry: STANDARD_III,
      skipped: STANDARD_III_SKIPPED,
    },
    {
      module: "magik/identity",
      cardIds: ["45030a", "45030b"],
      registry: MAGIK_IDENTITY,
      skipped: MAGIK_IDENTITY_SKIPPED,
    },
    {
      module: "magik/events",
      cardIds: ["45036", "45037", "45038", "45039", "45040"],
      registry: MAGIK_EVENTS,
      skipped: {},
    },
    {
      module: "magik/support-upgrades-allies",
      cardIds: ["45031", "45032", "45033", "45034", "45035"],
      registry: MAGIK_SUPPORT_UPGRADES_ALLIES,
      skipped: MAGIK_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "magik/obligation-nemesis",
      cardIds: ["45053", "45054", "45055", "45056", "45057", "45058"],
      registry: MAGIK_OBLIGATION_NEMESIS,
      skipped: MAGIK_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "four-horsemen",
      cardIds: [
        "45081a",
        "45081b",
        "45082a",
        "45082b",
        "45083a",
        "45083b",
        "45084a",
        "45084b",
        "45085a",
        "45086",
        "45087",
        "45088",
        "45089",
        "45090",
        "45091",
        "45092",
        "45093",
        "45094",
        "45095",
        "45096",
      ],
      registry: FOUR_HORSEMEN,
      skipped: FOUR_HORSEMEN_SKIPPED,
    },
    {
      module: "savage-land",
      cardIds: ["45127", "45128", "45129", "45130", "45131", "45132"],
      registry: SAVAGE_LAND,
      skipped: {},
    },
    {
      module: "genosha",
      cardIds: ["45133", "45134", "45135", "45136", "45137", "45138"],
      registry: GENOSHA,
      skipped: GENOSHA_SKIPPED,
    },
    {
      module: "dark-beast",
      cardIds: ["45118", "45121a", "45122", "45123", "45124", "45125", "45126"],
      registry: DARK_BEAST,
      skipped: DARK_BEAST_SKIPPED,
    },
    {
      module: "unus",
      cardIds: ["45059", "45062a", "45063", "45064", "45065", "45066", "45067", "45068"],
      registry: UNUS,
      skipped: UNUS_SKIPPED,
    },
    {
      module: "prelates",
      cardIds: ["45179b", "45180b", "45181b", "45182b", "45183b"],
      registry: PRELATES,
      skipped: PRELATES_SKIPPED,
    },
    {
      module: "campaign/overseer",
      cardIds: ["45179a", "45180a", "45181a", "45182a", "45183a"],
      registry: OVERSEER,
      skipped: OVERSEER_SKIPPED,
    },
    {
      module: "campaign/aoa-mission",
      cardIds: ["45166a", "45166b", "45167a", "45167b", "45168a", "45168b", "45169a", "45169b", "45170a", "45170b"],
      registry: AOA_MISSION,
      skipped: AOA_MISSION_SKIPPED,
    },
    {
      module: "campaign/age-of-apocalypse",
      cardIds: ["45164", "45165"],
      registry: AGE_OF_APOCALYPSE,
      skipped: AGE_OF_APOCALYPSE_SKIPPED,
    },
    {
      module: "campaign/aoa-basic-campaign",
      cardIds: ["45171a", "45172", "45173", "45174", "45175", "45176"],
      registry: AOA_BASIC_CAMPAIGN,
      skipped: AOA_BASIC_CAMPAIGN_SKIPPED,
    },
    {
      module: "campaign/aoa-campaign",
      cardIds: ["45177", "45178"],
      registry: AOA_CAMPAIGN,
      skipped: AOA_CAMPAIGN_SKIPPED,
    },
    {
      module: "apocalypse",
      cardIds: [
        "45101a",
        "45103a",
        "45104a",
        "45104b",
        "45105a",
        "45105b",
        "45106",
        "45107",
        "45108",
        "45109",
        "45110",
        "45111",
      ],
      registry: APOCALYPSE,
      skipped: APOCALYPSE_SKIPPED,
    },
  ],
  iceman: [
    { module: "iceman/identity", cardIds: ["46001a", "46001b"], registry: ICEMAN_IDENTITY, skipped: {} },
    {
      module: "iceman/aspect-basic",
      cardIds: [
        "46012",
        "46013",
        "46014",
        "46015",
        "46016",
        "46017",
        "46018",
        "46019",
        "46020",
        "46021",
        "46022",
        "46023",
      ],
      registry: ICEMAN_ASPECT_BASIC,
      skipped: ICEMAN_ASPECT_BASIC_SKIPPED,
    },
    {
      module: "iceman/support-upgrades-allies",
      cardIds: ["46002", "46003", "46004", "46005", "46006", "46007", "46008"],
      registry: ICEMAN_SUPPORT_UPGRADES_ALLIES,
      skipped: ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "iceman/events",
      cardIds: ["46009", "46010", "46011"],
      registry: ICEMAN_EVENTS,
      skipped: ICEMAN_EVENTS_SKIPPED,
    },
    {
      module: "iceman/obligation-nemesis",
      cardIds: ["46024", "46025", "46026", "46027", "46028"],
      registry: ICEMAN_OBLIGATION_NEMESIS,
      skipped: ICEMAN_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "iceman/sauron",
      cardIds: ["46029", "46030", "46031", "46032"],
      registry: SAURON,
      skipped: SAURON_SKIPPED,
    },
  ],
  jubilee: [
    { module: "jubilee/identity", cardIds: ["47001a", "47001b"], registry: JUBILEE_IDENTITY, skipped: {} },
    {
      module: "jubilee/events",
      cardIds: ["47006", "47007a", "47007b", "47007c", "47008a", "47008b", "47008c", "47009"],
      registry: JUBILEE_EVENTS,
      skipped: JUBILEE_EVENTS_SKIPPED,
    },
    {
      module: "jubilee/support-upgrades-allies",
      cardIds: ["47002", "47003", "47004", "47005", "47010a", "47010b", "47010c"],
      registry: JUBILEE_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "jubilee/obligation-nemesis",
      cardIds: ["47023", "47024", "47025", "47026", "47027"],
      registry: JUBILEE_OBLIGATION_NEMESIS,
      skipped: JUBILEE_OBLIGATION_NEMESIS_SKIPPED,
    },
    { module: "jubilee/arcade", cardIds: ["47030", "47031", "47032", "47033", "47034"], registry: ARCADE, skipped: {} },
    {
      module: "jubilee/aspect-basic",
      cardIds: [
        "47011",
        "47012",
        "47013",
        "47014",
        "47015",
        "47016",
        "47017",
        "47018",
        "47019",
        "47020",
        "47021",
        "47022",
        "47028",
        "47029",
      ],
      registry: JUBILEE_ASPECT_BASIC,
      skipped: JUBILEE_ASPECT_BASIC_SKIPPED,
    },
  ],
  ncrawler: [
    { module: "nightcrawler/identity", cardIds: ["48001a", "48001b"], registry: NIGHTCRAWLER_IDENTITY, skipped: {} },
    {
      module: "nightcrawler/events",
      cardIds: ["48007", "48008", "48009", "48010", "48011"],
      registry: NIGHTCRAWLER_EVENTS,
      skipped: NIGHTCRAWLER_EVENTS_SKIPPED,
    },
    {
      module: "nightcrawler/support-upgrades-allies",
      cardIds: ["48002", "48003", "48004", "48005", "48006"],
      registry: NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "nightcrawler/obligation-nemesis",
      cardIds: ["48026", "48027", "48028", "48029", "48030"],
      registry: NIGHTCRAWLER_OBLIGATION_NEMESIS,
      skipped: NIGHTCRAWLER_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "aspect-basic",
      cardIds: [
        "48012",
        "48013",
        "48014",
        "48015",
        "48016",
        "48017",
        "48018",
        "48019",
        "48020",
        "48021",
        "48022",
        "48023",
        "48024",
        "48025",
        "48031",
        "48032",
      ],
      registry: NCRAWLER_ASPECT_BASIC,
      skipped: {
        "48012.rogue-action":
          "cost picks another friendly character of any player and deals it damage (dealt, paid even if prevented); no cost does that: docs/phase7-wave8.md §3.74",
      },
    },
    {
      module: "crazy-gang",
      cardIds: ["48033", "48034", "48035", "48036", "48037", "48038"],
      registry: CRAZY_GANG,
      skipped: {},
    },
  ],
  magneto: [
    {
      module: "magneto/identity",
      cardIds: ["49001a", "49001b"],
      registry: MAGNETO_IDENTITY,
      skipped: MAGNETO_IDENTITY_SKIPPED,
    },
    {
      module: "magneto/support-upgrades-allies",
      cardIds: ["49002", "49003", "49004", "49005", "49006", "49007", "49011"],
      registry: MAGNETO_SUPPORT_UPGRADES_ALLIES,
      skipped: MAGNETO_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "aspect-basic",
      cardIds: [
        "49012",
        "49013",
        "49014",
        "49015",
        "49016",
        "49017",
        "49018",
        "49019",
        "49020",
        "49021",
        "49022",
        "49023",
        "49024",
        "49025",
        "49026",
        "49033",
        "49034",
        "49035",
        "49036",
        "49037",
      ],
      registry: MAGNETO_ASPECT_BASIC,
      skipped: MAGNETO_ASPECT_BASIC_SKIPPED,
    },
    {
      module: "hellfire",
      cardIds: ["49038", "49039", "49040", "49041", "49042"],
      registry: HELLFIRE,
      skipped: HELLFIRE_SKIPPED,
    },
  ],
};

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
      const modules = SCRIPTED_MODULES[code] ?? [];
      const scripted = modules.flatMap((m) => Object.keys(m.registry));
      it("is not started: nothing resolves beyond what an earlier wave already scripted and its scripted modules", () => {
        expect(missing).toEqual(allRefs.filter((id) => !scripted.includes(id)));
        expect(
          Object.keys(registry).sort(),
          `${code} is marked not started but its registry holds more than its scripted modules`,
        ).toEqual([...scripted].sort());
      });
      it.each(modules.map((m) => [m.module, m] as const))(
        "scripted module %s: every ref registered or skipped",
        (_, m) => {
          const refs = cards.filter((c) => m.cardIds.includes(c.id as string)).flatMap(abilityRefIds);
          expect(refs.length).toBeGreaterThan(0);
          expect(refs.filter((id) => !(id in m.registry) && !(id in m.skipped))).toEqual([]);
          expect(Object.keys(m.skipped).filter((id) => id in m.registry || !refs.includes(id))).toEqual([]);
          expect(Object.keys(m.registry).filter((id) => !refs.includes(id))).toEqual([]);
        },
      );
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

/** Every ability id a pack's own scripted modules register must be named in a test file of that pack's folder. */
describe("wave 8 pack ability id coverage", () => {
  const rawTestFiles = (import.meta as unknown as ImportMetaEnv).glob("./**/*.test.ts", {
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

  it("every ability id a started pack registers is named in one of its own test files", () => {
    for (const { code, registry } of PACKS.filter(
      (p) => PACK_STATUS[p.code] !== "not started" || p.code in SCRIPTED_MODULES,
    )) {
      const text = packTestText(code);
      const unnamed = Object.keys(registry).filter((id) => !text.includes(id));
      expect(unnamed, `${code} ids registered but not named in any wave8/${code}/**/*.test.ts file`).toEqual([]);
    }
  });
});

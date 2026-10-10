/**
 * Coverage for the wave 9 (cycle 9) packs, modeled on `../wave8/coverage.test.ts`: which packs are scripted, and, for
 * a pack not started, that nothing of it resolves yet. At the scaffold every pack is "not started" and every registry
 * is empty, so this passes; marking a pack scripted switches it to the strict check (every ref registered or in
 * `KNOWN_SKIPPED` with a reason). Starting a pack means: change its `PACK_STATUS` row, add `SCRIPTED_MODULES` entries
 * for its modules while it is partial, and list any `KNOWN_SKIPPED` refs with a reason. A "not started" pack whose
 * registry is not empty fails, so the marker cannot lag behind the scripts.
 */
import { AOS_CARDS, BP_CARDS, FALCON_CARDS, SILK_CARDS, TT_CARDS, WINTER_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { abilityRefIds } from "../ability-refs.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { WAVE9_ABILITIES } from "./index.js";
import { AOS_ABILITIES } from "./aos/index.js";
import { AIM_ABDUCTION, AIM_ABDUCTION_SKIPPED } from "./aos/aim-abduction.js";
import { AIM_SCIENCE, AIM_SCIENCE_SKIPPED } from "./aos/aim-science.js";
import { AOS_ASPECT_BASIC, AOS_ASPECT_BASIC_SKIPPED } from "./aos/aspect-basic.js";
import { BATROC, BATROC_SKIPPED } from "./aos/batroc.js";
import { BATROCS_BRIGADE, BATROCS_BRIGADE_SKIPPED } from "./aos/batrocs-brigade.js";
import { EXECUTIVE_BOARD, EXECUTIVE_BOARD_SKIPPED } from "./aos/executive-board.js";
import { MODOK, MODOK_SKIPPED } from "./aos/modok.js";
import {
  BLACK_WIDOW,
  BLACK_WIDOW_SKIPPED,
  DEFENSES_GRANTED_PREPARATION,
  GOGGLES_GRANTED_PREPARATION,
} from "./aos/black-widow.js";
import { MARIA_HILL_EVENTS, MARIA_HILL_EVENTS_SKIPPED } from "./aos/maria-hill/events.js";
import { MARIA_HILL_IDENTITY, MARIA_HILL_IDENTITY_SKIPPED } from "./aos/maria-hill/identity.js";
import {
  MARIA_HILL_SUPPORT_UPGRADES_ALLIES,
  MARIA_HILL_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./aos/maria-hill/support-upgrades-allies.js";
import {
  MARIA_HILL_OBLIGATION_NEMESIS,
  MARIA_HILL_OBLIGATION_NEMESIS_SKIPPED,
} from "./aos/maria-hill/obligation-nemesis.js";
import { SCIENTIST_SUPREME, SCIENTIST_SUPREME_SKIPPED } from "./aos/scientist-supreme.js";
import { SHIELD, SHIELD_SKIPPED } from "./aos/shield.js";
import { GRAVITATIONAL_PULL, GRAVITATIONAL_PULL_SKIPPED } from "./aos/gravitational-pull.js";
import { HARD_SOUND, HARD_SOUND_SKIPPED } from "./aos/hard-sound.js";
import { SUPERSONIC, SUPERSONIC_SKIPPED } from "./aos/supersonic.js";
import { THE_LEAPER, THE_LEAPER_SKIPPED } from "./aos/the-leaper.js";
import { POWER_OF_THE_ATOM, POWER_OF_THE_ATOM_SKIPPED } from "./aos/power-of-the-atom.js";
import { NICK_FURY_EVENTS, NICK_FURY_EVENTS_SKIPPED } from "./aos/nick-fury/events.js";
import { NICK_FURY_IDENTITY, NICK_FURY_IDENTITY_SKIPPED } from "./aos/nick-fury/identity.js";
import {
  NICK_FURY_OBLIGATION_NEMESIS,
  NICK_FURY_OBLIGATION_NEMESIS_SKIPPED,
} from "./aos/nick-fury/obligation-nemesis.js";
import {
  NICK_FURY_SUPPORT_UPGRADES_ALLIES,
  NICK_FURY_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./aos/nick-fury/support-upgrades-allies.js";
import { PALE_LITTLE_SPIDER, PALE_LITTLE_SPIDER_SKIPPED } from "./aos/pale-little-spider.js";
import { THUNDERBOLTS, THUNDERBOLTS_SKIPPED } from "./aos/thunderbolts.js";
import { BP_ASPECT_BASIC, BP_ASPECT_BASIC_SKIPPED } from "./bp/aspect-basic.js";
import { BLACK_PANTHER_EVENTS, BLACK_PANTHER_EVENTS_SKIPPED } from "./bp/black-panther/events.js";
import { BLACK_PANTHER_IDENTITY, BLACK_PANTHER_IDENTITY_SKIPPED } from "./bp/black-panther/identity.js";
import {
  BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES,
  BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./bp/black-panther/support-upgrades-allies.js";
import {
  BLACK_PANTHER_OBLIGATION_NEMESIS,
  BLACK_PANTHER_OBLIGATION_NEMESIS_SKIPPED,
} from "./bp/black-panther/obligation-nemesis.js";
import { EXTREME_RISK, EXTREME_RISK_SKIPPED } from "./bp/extreme-risk.js";
import { BP_ABILITIES } from "./bp/index.js";
import {
  FALCON_ASPECT_BASIC,
  FALCON_ASPECT_BASIC_SKIPPED,
  FLIGHT_SQUADRON_GRANTED_RESPONSE,
  SPECTRUM_GRANTED_RESPONSE,
} from "./falcon/aspect-basic.js";
import { FALCON_ABILITIES } from "./falcon/index.js";
import { FALCON_EVENTS, FALCON_EVENTS_SKIPPED } from "./falcon/falcon/events.js";
import { FALCON_IDENTITY, FALCON_IDENTITY_SKIPPED } from "./falcon/falcon/identity.js";
import { FALCON_OBLIGATION_NEMESIS, FALCON_OBLIGATION_NEMESIS_SKIPPED } from "./falcon/falcon/obligation-nemesis.js";
import {
  FALCON_SUPPORT_UPGRADES_ALLIES,
  FALCON_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./falcon/falcon/support-upgrades-allies.js";
import { SILK_ASPECT_BASIC, SILK_ASPECT_BASIC_SKIPPED } from "./silk/aspect-basic.js";
import { GROWING_STRONG, GROWING_STRONG_SKIPPED } from "./silk/growing-strong.js";
import { SILK_ABILITIES } from "./silk/index.js";
import { SILK_EVENTS, SILK_EVENTS_SKIPPED } from "./silk/silk/events.js";
import { SILK_IDENTITY, SILK_IDENTITY_SKIPPED } from "./silk/silk/identity.js";
import { SILK_OBLIGATION_NEMESIS, SILK_OBLIGATION_NEMESIS_SKIPPED } from "./silk/silk/obligation-nemesis.js";
import {
  SILK_SUPPORT_UPGRADES_ALLIES,
  SILK_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./silk/silk/support-upgrades-allies.js";
import { TT_ABILITIES } from "./tt/index.js";
import { WINTER_ASPECT_BASIC, WINTER_ASPECT_BASIC_SKIPPED } from "./winter/aspect-basic.js";
import { WINTER_ABILITIES } from "./winter/index.js";
import { WINTER_SOLDIER_EVENTS, WINTER_SOLDIER_EVENTS_SKIPPED } from "./winter/winter-soldier/events.js";
import { WINTER_SOLDIER_IDENTITY, WINTER_SOLDIER_IDENTITY_SKIPPED } from "./winter/winter-soldier/identity.js";
import {
  WINTER_SOLDIER_OBLIGATION_NEMESIS,
  WINTER_SOLDIER_OBLIGATION_NEMESIS_SKIPPED,
} from "./winter/winter-soldier/obligation-nemesis.js";
import {
  WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES,
  WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./winter/winter-soldier/support-upgrades-allies.js";

describe("wave 9 ability registry", () => {
  it("includes every wave 8 (Core through cycle 8) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE8_ABILITIES)) expect(WAVE9_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  aos: "not started",
  bp: "not started",
  silk: "not started",
  falcon: "not started",
  winter: "not started",
  tt: "not started",
};

/** Refs a started pack deliberately leaves unscripted, each with its written reason. Pinned exactly. */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

/**
 * Scripted modules of a pack still marked "not started": the smallest partial state (modeled on wave 8's). Each names the
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
      /** Registry entries listed on no card: an ability a rule grants (Night Vision Goggles 50070) or a quoted one a card gives itself (Flight Squadron 53020). */
      readonly registryOnly?: readonly string[];
    }>
  >
> = {
  // Agents of S.H.I.E.L.D. is scripted module by module; the pack stays "not started" until every module is in.
  aos: [
    {
      module: "maria-hill/identity",
      cardIds: ["50001a"],
      registry: MARIA_HILL_IDENTITY,
      skipped: MARIA_HILL_IDENTITY_SKIPPED,
    },
    {
      module: "maria-hill/events",
      cardIds: ["50003", "50004", "50005", "50006", "50007"],
      registry: MARIA_HILL_EVENTS,
      skipped: MARIA_HILL_EVENTS_SKIPPED,
    },
    {
      module: "maria-hill/support-upgrades-allies",
      cardIds: ["50002", "50008", "50009", "50010", "50011"],
      registry: MARIA_HILL_SUPPORT_UPGRADES_ALLIES,
      skipped: MARIA_HILL_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "maria-hill/obligation-nemesis",
      cardIds: ["50029", "50030", "50031", "50032", "50033"],
      registry: MARIA_HILL_OBLIGATION_NEMESIS,
      skipped: MARIA_HILL_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "aspect-basic",
      cardIds: [
        ...Array.from({ length: 17 }, (_, i) => String(50012 + i)),
        ...Array.from({ length: 12 }, (_, i) => String(50047 + i)),
      ],
      registry: AOS_ASPECT_BASIC,
      skipped: AOS_ASPECT_BASIC_SKIPPED,
    },
    {
      module: "aim-abduction",
      cardIds: ["50080", "50081", "50082"],
      registry: AIM_ABDUCTION,
      skipped: AIM_ABDUCTION_SKIPPED,
    },
    {
      module: "aim-science",
      cardIds: ["50083", "50084", "50085"],
      registry: AIM_SCIENCE,
      skipped: AIM_SCIENCE_SKIPPED,
    },
    {
      module: "black-widow",
      cardIds: [
        "50064",
        "50067a",
        "50068",
        "50069",
        "50070",
        "50071",
        "50072",
        "50073",
        "50074",
        "50075",
        "50076",
        "50077",
        "50078",
        "50079",
      ],
      registry: BLACK_WIDOW,
      skipped: BLACK_WIDOW_SKIPPED,
      registryOnly: [GOGGLES_GRANTED_PREPARATION, DEFENSES_GRANTED_PREPARATION],
    },
    {
      module: "batroc",
      cardIds: ["50086a", "50087a", "50090a", "50091", "50092", "50093", "50094", "50095", "50096", "50097"],
      registry: BATROC,
      skipped: BATROC_SKIPPED,
    },
    {
      module: "modok",
      cardIds: [
        "50103a",
        "50104a",
        "50105a",
        "50105b",
        "50106a",
        "50106b",
        "50107a",
        "50107b",
        "50108a",
        "50108b",
        "50109",
        "50110",
        "50111",
        "50112",
        "50113",
        "50114",
        "50115",
        "50116",
        "50117",
        "50118",
        "50119",
        "50120",
        "50121",
        "50122",
        "50123",
        "50124",
      ],
      registry: MODOK,
      skipped: MODOK_SKIPPED,
    },
    {
      module: "batrocs-brigade",
      cardIds: ["50098", "50099", "50100", "50101", "50102"],
      registry: BATROCS_BRIGADE,
      skipped: BATROCS_BRIGADE_SKIPPED,
    },
    {
      module: "executive-board",
      cardIds: ["50181a", "50181b", "50182a", "50182b", "50183a", "50183b", "50184a", "50184b", "50184c"],
      registry: EXECUTIVE_BOARD,
      skipped: EXECUTIVE_BOARD_SKIPPED,
    },
    {
      module: "thunderbolts",
      cardIds: ["50129a", "50130a", "50131a", "50132", "50133", "50134", "50135", "50136", "50137", "50138"],
      registry: THUNDERBOLTS,
      skipped: THUNDERBOLTS_SKIPPED,
    },
    {
      module: "gravitational-pull",
      cardIds: ["50139", "50140", "50141", "50142"],
      registry: GRAVITATIONAL_PULL,
      skipped: GRAVITATIONAL_PULL_SKIPPED,
    },
    {
      module: "hard-sound",
      cardIds: ["50143", "50144", "50145", "50146", "50147"],
      registry: HARD_SOUND,
      skipped: HARD_SOUND_SKIPPED,
    },
    {
      module: "nick-fury/identity",
      cardIds: ["50034a"],
      registry: NICK_FURY_IDENTITY,
      skipped: NICK_FURY_IDENTITY_SKIPPED,
    },
    {
      module: "nick-fury/events",
      cardIds: ["50037", "50038", "50039"],
      registry: NICK_FURY_EVENTS,
      skipped: NICK_FURY_EVENTS_SKIPPED,
    },
    {
      module: "nick-fury/obligation-nemesis",
      cardIds: ["50059", "50060", "50061", "50062", "50063"],
      registry: NICK_FURY_OBLIGATION_NEMESIS,
      skipped: NICK_FURY_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "nick-fury/support-upgrades-allies",
      cardIds: ["50035a", "50036", "50040", "50041", "50042", "50043", "50044", "50045", "50046"],
      registry: NICK_FURY_SUPPORT_UPGRADES_ALLIES,
      skipped: NICK_FURY_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "pale-little-spider",
      cardIds: ["50148", "50149", "50150", "50151"],
      registry: PALE_LITTLE_SPIDER,
      skipped: PALE_LITTLE_SPIDER_SKIPPED,
    },
    {
      module: "power-of-the-atom",
      cardIds: ["50152", "50153", "50154", "50155"],
      registry: POWER_OF_THE_ATOM,
      skipped: POWER_OF_THE_ATOM_SKIPPED,
    },
    {
      module: "scientist-supreme",
      cardIds: ["50125", "50126", "50127", "50128"],
      registry: SCIENTIST_SUPREME,
      skipped: SCIENTIST_SUPREME_SKIPPED,
    },
    {
      module: "shield",
      cardIds: ["50178", "50179", "50180"],
      registry: SHIELD,
      skipped: SHIELD_SKIPPED,
    },
    {
      module: "supersonic",
      cardIds: ["50156", "50157", "50158", "50159", "50160"],
      registry: SUPERSONIC,
      skipped: SUPERSONIC_SKIPPED,
    },
    {
      module: "the-leaper",
      cardIds: ["50161", "50162", "50163", "50164"],
      registry: THE_LEAPER,
      skipped: THE_LEAPER_SKIPPED,
    },
  ],
  bp: [
    {
      module: "aspect-basic",
      cardIds: [
        "51014",
        "51015",
        "51016",
        "51017",
        "51018",
        "51019",
        "51020",
        "51021",
        "51022",
        "51023",
        "51024",
        "51025",
        "51026",
        "51027",
        "51028",
        "51029",
        "51030",
        "51036",
        "51037",
        "51038",
      ],
      registry: BP_ASPECT_BASIC,
      skipped: BP_ASPECT_BASIC_SKIPPED,
    },
    {
      module: "black-panther/identity",
      cardIds: ["51001a"],
      registry: BLACK_PANTHER_IDENTITY,
      skipped: BLACK_PANTHER_IDENTITY_SKIPPED,
    },
    {
      module: "black-panther/events",
      cardIds: ["51003", "51004", "51005", "51006"],
      registry: BLACK_PANTHER_EVENTS,
      skipped: BLACK_PANTHER_EVENTS_SKIPPED,
    },
    {
      module: "black-panther/support-upgrades-allies",
      cardIds: ["51002", "51007", "51008", "51009", "51010", "51011", "51012", "51013"],
      registry: BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES,
      skipped: BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "black-panther/obligation-nemesis",
      cardIds: ["51031", "51032", "51033", "51034", "51035"],
      registry: BLACK_PANTHER_OBLIGATION_NEMESIS,
      skipped: BLACK_PANTHER_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "extreme-risk",
      cardIds: ["51039", "51040", "51041", "51042"],
      registry: EXTREME_RISK,
      skipped: EXTREME_RISK_SKIPPED,
    },
  ],
  silk: [
    {
      module: "silk/aspect-basic",
      cardIds: [
        "52013",
        "52014",
        "52015",
        "52016",
        "52017",
        "52018",
        "52019",
        "52020",
        "52021",
        "52022",
        "52023",
        "52024",
        "52025",
        "52026",
        "52027",
        "52032",
        "52033",
        "52034",
      ],
      registry: SILK_ASPECT_BASIC,
      skipped: SILK_ASPECT_BASIC_SKIPPED,
    },
    {
      module: "silk/identity",
      cardIds: ["52001a"],
      registry: SILK_IDENTITY,
      skipped: SILK_IDENTITY_SKIPPED,
    },
    {
      module: "silk/events",
      cardIds: ["52002", "52003", "52004", "52005"],
      registry: SILK_EVENTS,
      skipped: SILK_EVENTS_SKIPPED,
    },
    {
      module: "silk/support-upgrades-allies",
      cardIds: ["52006", "52007", "52008", "52009", "52010", "52011", "52012"],
      registry: SILK_SUPPORT_UPGRADES_ALLIES,
      skipped: SILK_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "silk/obligation-nemesis",
      cardIds: ["52028", "52029", "52030", "52031"],
      registry: SILK_OBLIGATION_NEMESIS,
      skipped: SILK_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "silk/growing-strong",
      cardIds: ["52035", "52036", "52037", "52038"],
      registry: GROWING_STRONG,
      skipped: GROWING_STRONG_SKIPPED,
    },
  ],
  falcon: [
    {
      module: "falcon/aspect-basic",
      cardIds: [
        "53014",
        "53015",
        "53016",
        "53017",
        "53018",
        "53019",
        "53020",
        "53021",
        "53022",
        "53023",
        "53024",
        "53025",
        "53026",
        "53027",
        "53028",
        "53034",
        "53035",
        "53036",
        "53037",
      ],
      registry: FALCON_ASPECT_BASIC,
      skipped: FALCON_ASPECT_BASIC_SKIPPED,
      registryOnly: [FLIGHT_SQUADRON_GRANTED_RESPONSE, SPECTRUM_GRANTED_RESPONSE],
    },
    {
      module: "falcon/events",
      cardIds: ["53003", "53004", "53005"],
      registry: FALCON_EVENTS,
      skipped: FALCON_EVENTS_SKIPPED,
    },
    {
      module: "falcon/identity",
      cardIds: ["53001a"],
      registry: FALCON_IDENTITY,
      skipped: FALCON_IDENTITY_SKIPPED,
    },
    {
      module: "falcon/obligation-nemesis",
      cardIds: ["53029", "53030", "53031", "53032", "53033"],
      registry: FALCON_OBLIGATION_NEMESIS,
      skipped: FALCON_OBLIGATION_NEMESIS_SKIPPED,
    },
    {
      module: "falcon/support-upgrades-allies",
      cardIds: ["53002", "53006", "53007", "53008", "53009", "53010", "53011", "53012", "53013"],
      registry: FALCON_SUPPORT_UPGRADES_ALLIES,
      skipped: FALCON_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
  ],
  winter: [
    {
      module: "aspect-basic",
      cardIds: [
        "54012",
        "54013",
        "54014",
        "54015",
        "54016",
        "54017",
        "54018",
        "54019",
        "54020",
        "54021",
        "54022",
        "54023",
        "54024",
        "54025",
        "54026",
        "54032",
        "54033",
      ],
      registry: WINTER_ASPECT_BASIC,
      skipped: WINTER_ASPECT_BASIC_SKIPPED,
    },
    {
      module: "winter-soldier/identity",
      cardIds: ["54001a"],
      registry: WINTER_SOLDIER_IDENTITY,
      skipped: WINTER_SOLDIER_IDENTITY_SKIPPED,
    },
    {
      module: "winter-soldier/events",
      cardIds: ["54004", "54005", "54006"],
      registry: WINTER_SOLDIER_EVENTS,
      skipped: WINTER_SOLDIER_EVENTS_SKIPPED,
    },
    {
      module: "winter-soldier/support-upgrades-allies",
      cardIds: ["54002", "54003", "54007", "54008", "54009", "54010", "54011"],
      registry: WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES,
      skipped: WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
    {
      module: "winter-soldier/obligation-nemesis",
      cardIds: ["54027", "54028", "54029", "54030", "54031"],
      registry: WINTER_SOLDIER_OBLIGATION_NEMESIS,
      skipped: WINTER_SOLDIER_OBLIGATION_NEMESIS_SKIPPED,
    },
  ],
};

const PACKS: ReadonlyArray<{
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly registry: AbilityRegistry;
}> = [
  { code: "aos", cards: AOS_CARDS, registry: AOS_ABILITIES },
  { code: "bp", cards: BP_CARDS, registry: BP_ABILITIES },
  { code: "silk", cards: SILK_CARDS, registry: SILK_ABILITIES },
  { code: "falcon", cards: FALCON_CARDS, registry: FALCON_ABILITIES },
  { code: "winter", cards: WINTER_CARDS, registry: WINTER_ABILITIES },
  { code: "tt", cards: TT_CARDS, registry: TT_ABILITIES },
];

describe("wave 9 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs this suite checks (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards, registry }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const missing = allRefs.filter((id) => !(id in WAVE9_ABILITIES));

    if (PACK_STATUS[code] === "not started") {
      const modules = SCRIPTED_MODULES[code] ?? [];
      const scripted = modules.flatMap((m) => Object.keys(m.registry));
      it("is not started: nothing resolves beyond what an earlier wave already scripted and its scripted modules", () => {
        // Refs an earlier wave already registered resolve (Silk's Quick Quip 52034 was scripted in wave 5, ahead of its pack).
        expect(missing).toEqual(allRefs.filter((id) => !(id in WAVE8_ABILITIES) && !scripted.includes(id)));
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
          expect(Object.keys(m.registry).filter((id) => !refs.includes(id) && !m.registryOnly?.includes(id))).toEqual(
            [],
          );
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
describe("wave 9 pack ability id coverage", () => {
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
      expect(unnamed, `${code} ids registered but not named in any wave9/${code}/**/*.test.ts file`).toEqual([]);
    }
  });
});

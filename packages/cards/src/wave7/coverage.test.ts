/**
 * Coverage for the wave 7 (cycle 7) packs, modeled on `../wave6/coverage.test.ts`: which packs are scripted, and, for
 * a pack not started, that nothing of it resolves yet. At the scaffold every pack is "not started" and every registry
 * is empty, so this passes; marking a pack scripted switches it to the strict check (every ref registered or in
 * `KNOWN_SKIPPED` with a reason). Starting a pack means: change its `PACK_STATUS` row and list any `KNOWN_SKIPPED` refs
 * with a reason. A "not started" pack whose registry is not empty fails, so the marker cannot lag behind the scripts.
 */
import { ANGEL_CARDS, DEADPOOL_CARDS, NEXT_EVOL_CARDS, PSYLOCKE_CARDS, X23_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { WAVE6_ABILITIES } from "../wave6/index.js";
import { WAVE7_ABILITIES } from "./index.js";
import { ANGEL_ABILITIES } from "./angel/index.js";
import { ANGEL_EVENTS } from "./angel/events.js";
import { ANGEL_IDENTITY } from "./angel/identity.js";
import { ANGEL_OBLIGATION_NEMESIS } from "./angel/obligation-nemesis.js";
import { ANGEL_PACK_CARDS } from "./angel/pack-cards.js";
import { ANGEL_SUPPORT_UPGRADES_ALLIES } from "./angel/support-upgrades-allies.js";
import { DEADPOOL_ABILITIES } from "./deadpool/index.js";
import { DEADPOOL_IDENTITY } from "./deadpool/identity.js";
import { DREADPOOL } from "./deadpool/dreadpool.js";
import { DEADPOOL_EVENTS } from "./deadpool/events.js";
import { DEADPOOL_PACK_CARDS } from "./deadpool/pack-cards.js";
import { DEADPOOL_SUPPORT_UPGRADES_ALLIES } from "./deadpool/support-upgrades-allies.js";
import { DEADPOOL_OBLIGATION_NEMESIS } from "./deadpool/obligation-nemesis.js";
import { NEXT_EVOL_ABILITIES } from "./next_evol/index.js";
import { CABLE_EVENTS } from "./next_evol/cable/events.js";
import { CABLE_IDENTITY } from "./next_evol/cable/identity.js";
import { DOMINO_EVENTS } from "./next_evol/domino/events.js";
import { NEXT_EVOL_PRECON_DOMINO_DECK } from "./next_evol/precon-domino-deck.js";
import { DOMINO_IDENTITY } from "./next_evol/domino/identity.js";
import { DOMINO_OBLIGATION_NEMESIS } from "./next_evol/domino/obligation-nemesis.js";
import { DOMINO_SUPPORT_UPGRADES_ALLIES } from "./next_evol/domino/support-upgrades-allies.js";
import { CABLE_SUPPORT_UPGRADES_ALLIES } from "./next_evol/cable/support-upgrades-allies.js";
import { CABLE_OBLIGATION_NEMESIS } from "./next_evol/cable/obligation-nemesis.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "./next_evol/precon-cable-deck.js";
import { EXTREME_MEASURES } from "./next_evol/extreme-measures.js";
import { FLIGHT } from "./next_evol/flight.js";
import { BLACK_TOM_CASSIDY } from "./next_evol/black-tom-cassidy.js";
import { NEXT_EVOL_CAMPAIGN_CARDS } from "./next_evol/campaign.js";
import { HOPE_SUMMERS } from "./next_evol/hope-summers.js";
import { JUGGERNAUT } from "./next_evol/juggernaut.js";
import { MARAUDERS } from "./next_evol/marauders.js";
import { MILITARY_GRADE } from "./next_evol/military-grade.js";
import { MISTER_SINISTER } from "./next_evol/mister-sinister.js";
import { MORLOCK_SIEGE } from "./next_evol/morlock-siege.js";
import { MUTANT_INSURRECTION } from "./next_evol/mutant-insurrection.js";
import { MUTANT_SLAYERS } from "./next_evol/mutant-slayers.js";
import { NASTY_BOYS } from "./next_evol/nasty-boys.js";
import { ON_THE_RUN } from "./next_evol/on-the-run.js";
import { STRYFE } from "./next_evol/stryfe.js";
import { SUPER_STRENGTH } from "./next_evol/super-strength.js";
import { TELEPATHY } from "./next_evol/telepathy.js";
import { PSYLOCKE_ABILITIES } from "./psylocke/index.js";
import { PSYLOCKE_EVENTS } from "./psylocke/events.js";
import { PSYLOCKE_IDENTITY } from "./psylocke/identity.js";
import { PSYLOCKE_PACK_CARDS } from "./psylocke/pack-cards.js";
import { PSYLOCKE_OBLIGATION_NEMESIS } from "./psylocke/obligation-nemesis.js";
import { PSYLOCKE_SUPPORT_UPGRADES_ALLIES } from "./psylocke/support-upgrades-allies.js";
import { X23_ABILITIES } from "./x23/index.js";
import { X23_IDENTITY } from "./x23/identity.js";
import { X23_SUPPORT_UPGRADES_ALLIES } from "./x23/support-upgrades-allies.js";
import { X23_EVENTS } from "./x23/events.js";
import { X23_OBLIGATION_NEMESIS } from "./x23/obligation-nemesis.js";
import { X23_PACK_CARDS } from "./x23/pack-cards.js";
import { abilityRefIds } from "../ability-refs.js";

describe("wave 7 ability registry", () => {
  it("includes every wave 6 (Core through cycle 6) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE6_ABILITIES)) expect(WAVE7_ABILITIES[id], id).toBe(definition);
  });
});

const PACK_STATUS: Readonly<Record<string, "scripted" | "in progress" | "not started">> = {
  next_evol: "not started",
  psylocke: "not started",
  angel: "not started",
  x23: "not started",
  deadpool: "not started",
};

/** Refs a started pack deliberately leaves unscripted, each with its written reason. Pinned exactly. */
const KNOWN_SKIPPED: Readonly<Record<string, readonly string[]>> = {};

/**
 * Scripted modules of a pack still marked "not started": the smallest partial state. Each names the printed ids it
 * covers and its registry; every ref of those cards is registered or in `skipped` with a reason, and the pack's whole
 * registry is exactly the union of these modules. Remove the entry when the pack is marked scripted.
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
  next_evol: [
    {
      module: "cable/identity",
      cardIds: ["40001a", "40001b"],
      registry: CABLE_IDENTITY,
      skipped: {},
    },
    {
      module: "domino/identity",
      cardIds: ["40037a", "40037b"],
      registry: DOMINO_IDENTITY,
      skipped: {},
    },
    {
      module: "domino/events",
      cardIds: ["40040", "40041", "40042", "40043"],
      registry: DOMINO_EVENTS,
      skipped: {},
    },
    {
      module: "precon-domino-deck",
      cardIds: [...Array.from({ length: 15 }, (_, i) => `400${50 + i}`), "40204"],
      registry: NEXT_EVOL_PRECON_DOMINO_DECK,
      skipped: {},
    },
    {
      module: "precon-cable-deck",
      cardIds: Array.from({ length: 17 }, (_, i) => `400${14 + i}`),
      registry: NEXT_EVOL_PRECON_CABLE_DECK,
      skipped: {},
    },
    {
      module: "cable/events",
      cardIds: ["40002", "40003", "40004", "40005"],
      registry: CABLE_EVENTS,
      skipped: {},
    },
    {
      module: "domino/support-upgrades-allies",
      cardIds: ["40038", "40039", "40044", "40045", "40046", "40047", "40048", "40049"],
      registry: DOMINO_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "cable/support-upgrades-allies",
      cardIds: ["40006", "40007", "40008", "40009", "40010", "40011", "40012", "40013"],
      registry: CABLE_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "cable/obligation-nemesis",
      cardIds: ["40031", "40032", "40033", "40034", "40035", "40036"],
      registry: CABLE_OBLIGATION_NEMESIS,
      skipped: {},
    },
    {
      module: "domino/obligation-nemesis",
      cardIds: ["40065", "40066", "40067", "40068", "40069"],
      registry: DOMINO_OBLIGATION_NEMESIS,
      skipped: {},
    },
    {
      module: "marauders",
      cardIds: ["40070", "40071", "40072", "40073", "40074", "40075", "40076"].flatMap((n) => [`${n}a`, `${n}b`]),
      registry: MARAUDERS,
      skipped: {},
    },
    {
      module: "morlock-siege",
      cardIds: [
        "40077a",
        "40079",
        "40080",
        "40081a",
        ...["2", "3", "4", "5", "6", "7", "8", "9"].map((n) => `4008${n}`),
      ],
      registry: MORLOCK_SIEGE,
      skipped: {},
    },
    {
      module: "juggernaut",
      cardIds: [
        "40118",
        "40119",
        "40120",
        "40121a",
        "40122a",
        ...["3", "4", "5", "6", "7", "8", "9"].map((n) => `4012${n}`),
      ],
      registry: JUGGERNAUT,
      skipped: {},
    },
    {
      module: "hope-summers",
      cardIds: ["40130", "40131"],
      registry: HOPE_SUMMERS,
      skipped: {},
    },
    {
      module: "flight",
      cardIds: ["40151", "40152", "40153", "40154"],
      registry: FLIGHT,
      skipped: {},
    },
    {
      module: "super-strength",
      cardIds: ["40155", "40156", "40157", "40158"],
      registry: SUPER_STRENGTH,
      skipped: {},
    },
    {
      module: "telepathy",
      cardIds: ["40159", "40160", "40161", "40162"],
      registry: TELEPATHY,
      skipped: {},
    },
    {
      module: "military-grade",
      cardIds: ["40090", "40091", "40092", "40093"],
      registry: MILITARY_GRADE,
      skipped: {},
    },
    {
      module: "extreme-measures",
      cardIds: ["40180", "40181", "40182", "40183", "40184"],
      registry: EXTREME_MEASURES,
      skipped: {},
    },
    {
      module: "mutant-insurrection",
      cardIds: ["40185", "40186", "40187", "40188", "40189"],
      registry: MUTANT_INSURRECTION,
      skipped: {},
    },
    {
      module: "mister-sinister",
      cardIds: ["40136", "40139a", ...["4", "5", "6", "7", "8", "9"].map((n) => `4014${n}`), "40150"],
      registry: MISTER_SINISTER,
      skipped: {},
    },
    {
      module: "mutant-slayers",
      cardIds: ["40094", "40095", "40096", "40097", "40098", "40099", "40100", "40101", "40102"],
      registry: MUTANT_SLAYERS,
      skipped: {},
    },
    {
      module: "nasty-boys",
      cardIds: ["40112", "40113", "40114", "40115", "40116", "40117"],
      registry: NASTY_BOYS,
      skipped: {},
    },
    {
      module: "black-tom-cassidy",
      cardIds: ["40132", "40133", "40134", "40135"],
      registry: BLACK_TOM_CASSIDY,
      skipped: {},
    },
    {
      module: "on-the-run",
      cardIds: ["40103a", "40105a", ...["6", "7", "8", "9"].map((n) => `4010${n}`), "40110", "40111"],
      registry: ON_THE_RUN,
      skipped: {},
    },
    {
      module: "campaign",
      cardIds: [
        ...["0", "1", "2", "3", "4", "5"].flatMap((n) => [`4019${n}a`, `4019${n}b`]),
        "40196",
        "40197",
        "40198",
        "40199",
        "40200",
        "40201",
        "40202",
        "40203",
      ],
      registry: NEXT_EVOL_CAMPAIGN_CARDS,
      skipped: {},
    },
    {
      module: "stryfe",
      cardIds: [
        "40163",
        "40166a",
        "40168a",
        "40168b",
        ...["69", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79"].map((n) => `401${n}`),
      ],
      registry: STRYFE,
      skipped: {},
    },
  ],
  deadpool: [
    {
      module: "deadpool/identity",
      cardIds: ["44001a", "44001b"],
      registry: DEADPOOL_IDENTITY,
      skipped: {},
    },
    {
      module: "deadpool/dreadpool",
      cardIds: ["44037", "44038", "44039", "44040", "44041", "44042"],
      registry: DREADPOOL,
      skipped: {},
    },
    {
      module: "deadpool/events",
      cardIds: [
        "44003",
        "44004",
        "44005",
        "44006",
        "44012",
        "44017",
        "44018",
        "44019",
        "44020",
        "44021",
        "44022",
        "44023",
      ],
      registry: DEADPOOL_EVENTS,
      skipped: {},
    },
    {
      module: "deadpool/pack-cards",
      cardIds: [
        "44031",
        "44043",
        "44044",
        "44045",
        "44046",
        "44047",
        "44048",
        "44049",
        "44050",
        "44051",
        "44052",
        "44053",
        "44054",
        "44055",
        "44056",
        "44057",
        "44058",
      ],
      registry: DEADPOOL_PACK_CARDS,
      skipped: {},
    },
    {
      module: "deadpool/support-upgrades-allies",
      cardIds: [
        "44002",
        "44007",
        "44008",
        "44009",
        "44010",
        "44011",
        "44013",
        "44014",
        "44015",
        "44016",
        "44024",
        "44025",
        "44026",
        "44027",
        "44028",
        "44029",
        "44030",
      ],
      registry: DEADPOOL_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "deadpool/obligation-nemesis",
      cardIds: ["44032", "44033", "44034", "44035", "44036"],
      registry: DEADPOOL_OBLIGATION_NEMESIS,
      skipped: {},
    },
  ],
  x23: [
    {
      module: "x23/identity",
      cardIds: ["43001a", "43001b"],
      registry: X23_IDENTITY,
      skipped: {},
    },
    {
      module: "x23/support-upgrades-allies",
      cardIds: [
        "43002",
        "43003",
        "43008",
        "43009",
        "43010",
        "43011",
        "43012",
        "43013",
        "43014",
        "43015",
        "43019",
        "43020",
        "43025",
        "43026",
        "43027",
      ],
      registry: X23_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "x23/events",
      cardIds: ["43004", "43005", "43006", "43007", "43016", "43017", "43038", "43040"],
      registry: X23_EVENTS,
      skipped: {},
    },
    {
      module: "x23/pack-cards",
      cardIds: ["43018", "43021", "43034", "43035", "43036", "43037", "43039"],
      registry: X23_PACK_CARDS,
      skipped: {},
    },
    {
      module: "x23/obligation-nemesis",
      cardIds: ["43028", "43029", "43030", "43031", "43032", "43033"],
      registry: X23_OBLIGATION_NEMESIS,
      skipped: {},
    },
  ],
  angel: [
    {
      module: "angel/identity",
      cardIds: ["42001a", "42001b", "42001c"],
      registry: ANGEL_IDENTITY,
      skipped: {},
    },
    {
      module: "angel/events",
      cardIds: ["42003", "42004", "42005", "42006", "42007", "42014", "42015", "42016", "42021"],
      registry: ANGEL_EVENTS,
      skipped: {},
    },
    {
      module: "angel/support-upgrades-allies",
      cardIds: [
        "42002",
        "42008",
        "42009",
        "42010",
        "42011",
        "42012",
        "42013",
        "42017",
        "42018",
        "42019",
        "42020",
        "42022",
        "42023",
      ],
      registry: ANGEL_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "angel/obligation-nemesis",
      cardIds: ["42024", "42025", "42026", "42027", "42028"],
      registry: ANGEL_OBLIGATION_NEMESIS,
      skipped: {},
    },
    {
      module: "angel/pack-cards",
      cardIds: ["42029", "42030", "42031", "42032"],
      registry: ANGEL_PACK_CARDS,
      skipped: {},
    },
  ],
  psylocke: [
    {
      module: "psylocke/identity",
      cardIds: ["41001a", "41001b"],
      registry: PSYLOCKE_IDENTITY,
      skipped: {},
    },
    {
      module: "psylocke/support-upgrades-allies",
      cardIds: [
        "41002a",
        "41002b",
        "41003",
        "41008",
        "41009",
        "41010",
        "41011",
        "41012",
        "41013",
        "41016",
        "41017",
        "41018",
        "41021",
        "41022",
        "41023",
        "41024",
      ],
      registry: PSYLOCKE_SUPPORT_UPGRADES_ALLIES,
      skipped: {},
    },
    {
      module: "psylocke/events",
      cardIds: ["41004", "41005", "41006", "41007", "41014", "41015", "41019", "41020"],
      registry: PSYLOCKE_EVENTS,
      skipped: {},
    },
    {
      module: "psylocke/pack-cards",
      cardIds: ["41030", "41031", "41032", "41033"],
      registry: PSYLOCKE_PACK_CARDS,
      skipped: {},
    },
    {
      module: "psylocke/obligation-nemesis",
      cardIds: ["41025", "41026", "41027", "41028", "41029"],
      registry: PSYLOCKE_OBLIGATION_NEMESIS,
      skipped: {},
    },
  ],
};

const PACKS: ReadonlyArray<{
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly registry: AbilityRegistry;
}> = [
  { code: "next_evol", cards: NEXT_EVOL_CARDS, registry: NEXT_EVOL_ABILITIES },
  { code: "psylocke", cards: PSYLOCKE_CARDS, registry: PSYLOCKE_ABILITIES },
  { code: "angel", cards: ANGEL_CARDS, registry: ANGEL_ABILITIES },
  { code: "x23", cards: X23_CARDS, registry: X23_ABILITIES },
  { code: "deadpool", cards: DEADPOOL_CARDS, registry: DEADPOOL_ABILITIES },
];

describe("wave 7 pack ability coverage", () => {
  it("PACK_STATUS covers exactly the packs this suite checks (no pack silently unchecked)", () => {
    expect(new Set(PACKS.map((p) => p.code))).toEqual(new Set(Object.keys(PACK_STATUS)));
  });

  describe.each(PACKS)("$code", ({ code, cards, registry }) => {
    const allRefs = cards.flatMap(abilityRefIds);
    const missing = allRefs.filter((id) => !(id in WAVE7_ABILITIES));

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

/** Every ability id a started pack's own registry holds must be named in a test file of that pack's folder. */
describe("wave 7 pack ability id coverage", () => {
  const rawTestFiles = (import.meta as unknown as ImportMetaEnv).glob("./**/*.test.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  interface ImportMetaEnv {
    readonly glob: (pattern: string, opts: object) => unknown;
  }
  /**
   * `next_evol` owns the box's whole folder; each hero pack owns its own. A hero pack's folder is its code, so
   * `./psylocke/...` is psylocke's.
   */
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
      expect(
        unnamed,
        `${code} ability ids registered but not named in any wave7/${code}/**/*.test.ts file:\n${unnamed.join("\n")}`,
      ).toEqual([]);
    }
  });
});

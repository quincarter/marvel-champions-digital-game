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
import { DYSTOPIAN_NIGHTMARE } from "./aoa/dystopian-nightmare.js";
import { HOUNDS } from "./aoa/hounds.js";
import { AOA_ABILITIES } from "./aoa/index.js";
import { ICEMAN_ABILITIES } from "./iceman/index.js";
import { ICEMAN_IDENTITY } from "./iceman/iceman/identity.js";
import {
  ICEMAN_SUPPORT_UPGRADES_ALLIES,
  ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./iceman/iceman/support-upgrades-allies.js";
import { ARCADE } from "./jubilee/arcade.js";
import { JUBILEE_ABILITIES } from "./jubilee/index.js";
import { JUBILEE_IDENTITY } from "./jubilee/jubilee/identity.js";
import { HELLFIRE, HELLFIRE_SKIPPED } from "./magneto/hellfire.js";
import { MAGNETO_ABILITIES } from "./magneto/index.js";
import { NCRAWLER_ABILITIES } from "./ncrawler/index.js";
import { NCRAWLER_ASPECT_BASIC } from "./ncrawler/aspect-basic.js";
import { NIGHTCRAWLER_IDENTITY } from "./ncrawler/nightcrawler/identity.js";

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
  ],
  iceman: [
    { module: "iceman/identity", cardIds: ["46001a", "46001b"], registry: ICEMAN_IDENTITY, skipped: {} },
    {
      module: "iceman/support-upgrades-allies",
      cardIds: ["46002", "46003", "46004", "46005", "46006", "46007", "46008"],
      registry: ICEMAN_SUPPORT_UPGRADES_ALLIES,
      skipped: ICEMAN_SUPPORT_UPGRADES_ALLIES_SKIPPED,
    },
  ],
  jubilee: [
    { module: "jubilee/identity", cardIds: ["47001a", "47001b"], registry: JUBILEE_IDENTITY, skipped: {} },
    { module: "jubilee/arcade", cardIds: ["47030", "47031", "47032", "47033", "47034"], registry: ARCADE, skipped: {} },
  ],
  ncrawler: [
    { module: "nightcrawler/identity", cardIds: ["48001a", "48001b"], registry: NIGHTCRAWLER_IDENTITY, skipped: {} },
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
  ],
  magneto: [
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

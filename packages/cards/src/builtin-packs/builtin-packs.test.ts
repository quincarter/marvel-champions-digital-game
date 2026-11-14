import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  WAVE6_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
  WAVE8_STARTER_DECKS,
  WAVE9_STARTER_DECKS,
  WAVE10_STARTER_DECKS,
  WAVE11_ENCOUNTER_SETS,
  WAVE11_SCENARIOS,
  WAVE11_STARTER_DECKS,
} from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CORE_ABILITIES } from "../core/index.js";
import { CORE_BUILTIN_PACK } from "../core/pack.js";
import { PLAYABLE_ENCOUNTER_SETS, PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { WAVE1_ABILITIES, WAVE1_BUILTIN_PACKS, WAVE1_REPRINT_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES, WAVE2_BUILTIN_PACKS, WAVE2_REPRINT_ABILITIES } from "../wave2/index.js";
import { WAVE3_ABILITIES, WAVE3_BUILTIN_PACKS, WAVE3_REPRINT_ABILITIES } from "../wave3/index.js";
import { WAVE4_ABILITIES, WAVE4_BUILTIN_PACKS } from "../wave4/index.js";
import { WAVE4_REPRINT_ABILITIES } from "../wave4/reprints.js";
import { WAVE5_ABILITIES, WAVE5_BUILTIN_PACKS } from "../wave5/index.js";
import { SILK_QUICK_QUIP } from "../wave5/silk/quick-quip.js";
import { WAVE6_ABILITIES, WAVE6_BUILTIN_PACKS } from "../wave6/index.js";
import { WAVE7_ABILITIES, WAVE7_BUILTIN_PACKS } from "../wave7/index.js";
import { WAVE8_ABILITIES, WAVE8_BUILTIN_PACKS } from "../wave8/index.js";
import { WAVE9_ABILITIES, WAVE9_BUILTIN_PACKS } from "../wave9/index.js";
import { WAVE10_ABILITIES, WAVE10_BUILTIN_PACKS } from "../wave10/index.js";
import { WAVE11_ABILITIES, WAVE11_BUILTIN_PACKS } from "../wave11/index.js";
import { builtinPackProblems, defineBuiltinPack, ownScriptsOf, scriptRefsOf, type BuiltinPack } from "./define.js";
import { BUILTIN_PACKS } from "./index.js";

const PRODUCTS = new Set(BUILTIN_PACKS.map((pack) => pack.manifest.id));
const ids = (records: readonly { readonly id: unknown }[]): string[] =>
  records.map((record) => String(record.id)).sort();
const NONE: AbilityRegistry = {};

/** Wave 3 starts from every earlier script, as `wave3/index.ts` does. */
const EARLIER_ABILITIES: AbilityRegistry = { ...WAVE1_ABILITIES, ...WAVE2_ABILITIES };

/** A wave: the registry it builds, the layers in the order it merges them, its reprint aliases and its packs. */
interface Wave {
  readonly registry: AbilityRegistry;
  readonly layers: readonly AbilityRegistry[];
  readonly aliases: AbilityRegistry;
  readonly packs: readonly BuiltinPack[];
}

/** The usual shape: the earlier layer, the wave's reprint aliases, then each pack's own scripts. */
const wave = (
  registry: AbilityRegistry,
  earlier: AbilityRegistry,
  aliases: AbilityRegistry,
  packs: readonly BuiltinPack[],
): Wave => ({ registry, aliases, packs, layers: [earlier, aliases, ...packs.map((p) => ownScriptsOf(p, aliases))] });

const WAVES: readonly (readonly [string, Wave])[] = [
  ["wave 1", wave(WAVE1_ABILITIES, CORE_ABILITIES, WAVE1_REPRINT_ABILITIES, WAVE1_BUILTIN_PACKS)],
  ["wave 2", wave(WAVE2_ABILITIES, CORE_ABILITIES, WAVE2_REPRINT_ABILITIES, WAVE2_BUILTIN_PACKS)],
  ["wave 3", wave(WAVE3_ABILITIES, EARLIER_ABILITIES, WAVE3_REPRINT_ABILITIES, WAVE3_BUILTIN_PACKS)],
  ["wave 4", wave(WAVE4_ABILITIES, WAVE3_ABILITIES, WAVE4_REPRINT_ABILITIES, WAVE4_BUILTIN_PACKS)],
  // Silk's Quick Quip (a wave 9 card) is merged after wave 5's packs, ahead of its own pack
  // (docs/builtin-content-packs.md).
  [
    "wave 5",
    {
      ...wave(WAVE5_ABILITIES, WAVE4_ABILITIES, NONE, WAVE5_BUILTIN_PACKS),
      layers: [WAVE4_ABILITIES, ...WAVE5_BUILTIN_PACKS.map((p) => p.abilities), SILK_QUICK_QUIP],
    },
  ],
  ["wave 6", wave(WAVE6_ABILITIES, WAVE5_ABILITIES, NONE, WAVE6_BUILTIN_PACKS)],
  ["wave 7", wave(WAVE7_ABILITIES, WAVE6_ABILITIES, NONE, WAVE7_BUILTIN_PACKS)],
  ["wave 8", wave(WAVE8_ABILITIES, WAVE7_ABILITIES, NONE, WAVE8_BUILTIN_PACKS)],
  // The silk pack holds Quick Quip too; wave 5 merged it already, so wave 9 leaves it out of the silk layer.
  [
    "wave 9",
    {
      ...wave(WAVE9_ABILITIES, WAVE8_ABILITIES, NONE, WAVE9_BUILTIN_PACKS),
      layers: [WAVE8_ABILITIES, ...WAVE9_BUILTIN_PACKS.map((p) => ownScriptsOf(p, SILK_QUICK_QUIP))],
    },
  ],
  ["wave 10", wave(WAVE10_ABILITIES, WAVE9_ABILITIES, NONE, WAVE10_BUILTIN_PACKS)],
  ["wave 11", wave(WAVE11_ABILITIES, WAVE10_ABILITIES, NONE, WAVE11_BUILTIN_PACKS)],
];

describe("built-in packs", () => {
  it("lists Core, then each wave's products in merge order", () => {
    expect(BUILTIN_PACKS.map((pack) => pack.manifest.id)).toEqual([
      "core",
      ...["cap", "thor", "msm", "hlk", "bkw", "drs", "gob", "twc"],
      ...["trors", "toafk", "ant", "wsp", "qsv", "scw"],
      ...["gmw", "gam", "stld", "drax", "vnm", "ron"],
      ...["nebu", "warm", "vision", "mts", "valk", "hood"],
      ...["sm", "nova", "ironheart", "spiderham", "spdr"],
      ...["mut_gen", "cyclops", "phoenix", "wolv", "storm", "gambit", "rogue", "mojo"],
      ...["next_evol", "psylocke", "angel", "x23", "deadpool"],
      ...["aoa", "iceman", "jubilee", "ncrawler", "magneto"],
      ...["aos", "bp", "silk", "falcon", "winter", "tt"],
      ...["cw", "synthezoid", "wonder_man", "hercules"],
      ...["shadowland", "jj", "luke_cage", "fne", "elektra", "iron_fist"],
    ]);
  });

  it.each(BUILTIN_PACKS.map((pack) => [pack.manifest.id, pack] as const))("%s holds together", (_, pack) => {
    expect(builtinPackProblems(pack)).toEqual([]);
  });

  it("covers every playable card of their products once, as the same records", () => {
    const fromPacks = BUILTIN_PACKS.flatMap((pack) => pack.cards);
    expect(new Set(fromPacks).size).toBe(fromPacks.length);
    expect(new Set(fromPacks)).toEqual(new Set(PLAYABLE_CARDS.filter((card) => PRODUCTS.has(card.setCode))));
    expect(CORE_BUILTIN_PACK.cards).toBe(CORE_CARDS);
  });

  // Wave 11's scenarios and sets aren't in the playable pool's records: its scenarios are built from its own
  // (`wave11/setup.ts`), so its content records are the other source.
  it("covers every playable scenario and encounter set of their products once, by id", () => {
    const scenarios = BUILTIN_PACKS.flatMap((pack) => pack.scenarios);
    expect(new Set(ids(scenarios)).size).toBe(scenarios.length);
    const playableScenarios = [...PLAYABLE_SCENARIO_RECORDS, ...WAVE11_SCENARIOS];
    expect(ids(scenarios)).toEqual([...new Set(ids(playableScenarios.filter((s) => PRODUCTS.has(s.packCode))))]);
    const sets = BUILTIN_PACKS.flatMap((pack) => pack.encounterSets);
    expect(new Set(ids(sets)).size).toBe(sets.length);
    const playableSets = [...PLAYABLE_ENCOUNTER_SETS, ...WAVE11_ENCOUNTER_SETS].filter((set) =>
      set.packCodes.some((code) => PRODUCTS.has(code)),
    );
    expect(ids(sets)).toEqual([...new Set(ids(playableSets))]);
  });

  it("covers every precon of Core and waves 1 to 11 once, by id", () => {
    const decks = BUILTIN_PACKS.flatMap((pack) => pack.decks);
    expect(new Set(ids(decks)).size).toBe(decks.length);
    const all = [
      ...[CORE_STARTER_DECKS, WAVE1_STARTER_DECKS, WAVE2_STARTER_DECKS, WAVE3_STARTER_DECKS, WAVE4_STARTER_DECKS],
      ...[WAVE5_STARTER_DECKS, WAVE6_STARTER_DECKS, WAVE7_STARTER_DECKS, WAVE8_STARTER_DECKS, WAVE9_STARTER_DECKS],
      ...[WAVE10_STARTER_DECKS, WAVE11_STARTER_DECKS],
    ].flat();
    expect(ids(decks)).toEqual([...new Set(ids(all))]);
  });

  // A script no card names passes `defineBuiltinPack` by its card code (a rule grants it), so a script left behind by a
  // renamed ref would too: each one is listed here, and a new one has to be added on purpose.
  it("hold no script that no card names, except the ones a rule grants", () => {
    const named = new Set(BUILTIN_PACKS.flatMap((pack) => pack.cards.flatMap(scriptRefsOf)));
    const unnamed = BUILTIN_PACKS.flatMap((pack) => Object.keys(pack.abilities).filter((id) => !named.has(id)));
    expect(unnamed).toEqual([
      // Nebula's Ship's guard, granted by GMW Balanced's `gainsAbility` rule (`campaigns/gmw-balanced.ts`).
      "16093.balanced-evasion-guard",
      // Abilities AoS and Falcon cards grant to another card (`wave9/aos/black-widow.ts`,
      // `wave9/falcon/aspect-basic.ts`).
      "50070.night-vision-goggles-granted-preparation",
      "50074.automated-defenses-granted-preparation",
      "53018.spectrum-granted-response",
      "53020.flight-squadron-granted-response",
      // Fear No Evil's granted Boost and When Defeated (`wave11/modules.ts` `registryOnly`).
      "60097.granted-boost",
      "60142b.granted-when-defeated",
    ]);
  });

  it("is where the Core registry comes from", () => {
    expect(CORE_ABILITIES).toBe(CORE_BUILTIN_PACK.abilities);
  });

  it("together hold every script of the wave 11 pool (every wave), as the same definitions, each in one pack", () => {
    const fromPacks = BUILTIN_PACKS.flatMap((pack) => Object.entries(pack.abilities));
    expect(new Set(fromPacks.map(([id]) => id)).size).toBe(fromPacks.length);
    expect(fromPacks.map(([id]) => id).sort()).toEqual(Object.keys(WAVE11_ABILITIES).sort());
    for (const [id, definition] of fromPacks) expect(WAVE11_ABILITIES[id]).toBe(definition);
  });

  describe.each(WAVES)("%s", (_, { registry, layers, aliases, packs }) => {
    it("gives each reprint alias to the product holding its card", () => {
      const placed = packs.flatMap((pack) => Object.keys(pack.abilities).filter((id) => Object.hasOwn(aliases, id)));
      expect(placed.sort()).toEqual(Object.keys(aliases).sort());
    });

    it("builds its registry from its packs, in the order the wave merges them", () => {
      expect(Object.keys(registry)).toEqual(layers.flatMap((layer) => Object.keys(layer)));
      for (const layer of layers) {
        for (const [id, definition] of Object.entries(layer)) expect(registry[id]).toBe(definition);
      }
    });
  });
});

describe("defineBuiltinPack", () => {
  const capCard = WAVE1_BUILTIN_PACKS[0]!.cards[0]!;
  const coreScript = Object.entries(CORE_ABILITIES)[0]!;

  it("refuses another product's card, a script for no card of the pack, and a manifest id or name that isn't its product's", () => {
    const broken: BuiltinPack = {
      ...CORE_BUILTIN_PACK,
      manifest: { ...CORE_BUILTIN_PACK.manifest, id: "kore", name: "Kore Set" },
      cards: [...CORE_CARDS, capCard],
      abilities: { "99999.nobody": coreScript[1] },
    };
    const problems = builtinPackProblems(broken);
    expect(problems).toContain("manifest id kore is not its product's code core");
    expect(problems).toContain(
      `manifest name "Kore Set" is not its product's name "${CORE_BUILTIN_PACK.manifest.product.name}"`,
    );
    expect(problems).toContain(`card ${capCard.id} is from cap, not kore`);
    expect(problems).toContain("ability 99999.nobody is not on any kore card");
    expect(() => defineBuiltinPack(broken)).toThrow(/built-in pack kore:/);
  });

  it("counts a separated identity's other sides and its alter-ego card number as the identity's own", () => {
    const spdr = BUILTIN_PACKS.find((pack) => pack.manifest.id === "spdr")!;
    const identity = spdr.cards.find((card) => card.type === "hero_identity" && card.separatedIdentity)!;
    const refs = scriptRefsOf(identity);
    expect(refs.filter((id) => id.startsWith("31002b."))).not.toEqual([]);
    expect(builtinPackProblems(spdr)).toEqual([]);
  });

  it("refuses a Core script in a wave 1 product", () => {
    const cap = WAVE1_BUILTIN_PACKS[0]!;
    const pack: BuiltinPack = { ...cap, abilities: { ...cap.abilities, [coreScript[0]]: coreScript[1] } };
    expect(builtinPackProblems(pack)).toEqual([`ability ${coreScript[0]} is not on any cap card`]);
  });
});

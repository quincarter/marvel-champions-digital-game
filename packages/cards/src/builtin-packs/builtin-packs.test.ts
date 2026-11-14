import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
} from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CORE_ABILITIES } from "../core/index.js";
import { CORE_BUILTIN_PACK } from "../core/pack.js";
import { PLAYABLE_ENCOUNTER_SETS, PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { WAVE1_ABILITIES, WAVE1_BUILTIN_PACKS, WAVE1_REPRINT_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES, WAVE2_BUILTIN_PACKS, WAVE2_REPRINT_ABILITIES } from "../wave2/index.js";
import { WAVE3_ABILITIES, WAVE3_BUILTIN_PACKS, WAVE3_REPRINT_ABILITIES } from "../wave3/index.js";
import { abilityRefIds } from "../ability-refs.js";
import { builtinPackProblems, defineBuiltinPack, ownScriptsOf, type BuiltinPack } from "./define.js";
import { BUILTIN_PACKS } from "./index.js";

const PRODUCTS = new Set(BUILTIN_PACKS.map((pack) => pack.manifest.id));
const ids = (records: readonly { readonly id: unknown }[]): string[] =>
  records.map((record) => String(record.id)).sort();

/** Wave 3 starts from every earlier script, as `wave3/index.ts` does. */
const EARLIER_ABILITIES: AbilityRegistry = { ...WAVE1_ABILITIES, ...WAVE2_ABILITIES };

/** Each wave: the registry it builds, the layers ahead of its packs, its reprint aliases and its packs. */
const WAVES = [
  ["wave 1", WAVE1_ABILITIES, [CORE_ABILITIES], WAVE1_REPRINT_ABILITIES, WAVE1_BUILTIN_PACKS],
  ["wave 2", WAVE2_ABILITIES, [CORE_ABILITIES], WAVE2_REPRINT_ABILITIES, WAVE2_BUILTIN_PACKS],
  ["wave 3", WAVE3_ABILITIES, [EARLIER_ABILITIES], WAVE3_REPRINT_ABILITIES, WAVE3_BUILTIN_PACKS],
] as const satisfies readonly (readonly [
  string,
  AbilityRegistry,
  readonly AbilityRegistry[],
  AbilityRegistry,
  readonly BuiltinPack[],
])[];

describe("built-in packs", () => {
  it("lists Core, then waves 1, 2 and 3's products in merge order", () => {
    expect(BUILTIN_PACKS.map((pack) => pack.manifest.id)).toEqual([
      "core",
      ...["cap", "thor", "msm", "hlk", "bkw", "drs", "gob", "twc"],
      ...["trors", "toafk", "ant", "wsp", "qsv", "scw"],
      ...["gmw", "gam", "stld", "drax", "vnm", "ron"],
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

  it("covers every playable scenario and encounter set of their products once, by id", () => {
    const scenarios = BUILTIN_PACKS.flatMap((pack) => pack.scenarios);
    expect(new Set(ids(scenarios)).size).toBe(scenarios.length);
    expect(ids(scenarios)).toEqual(ids(PLAYABLE_SCENARIO_RECORDS.filter((s) => PRODUCTS.has(s.packCode))));
    const sets = BUILTIN_PACKS.flatMap((pack) => pack.encounterSets);
    expect(new Set(ids(sets)).size).toBe(sets.length);
    const playableSets = PLAYABLE_ENCOUNTER_SETS.filter((set) => set.packCodes.some((code) => PRODUCTS.has(code)));
    expect(ids(sets)).toEqual(ids(playableSets));
  });

  it("covers every precon of Core and waves 1 to 3 once, by id", () => {
    const decks = BUILTIN_PACKS.flatMap((pack) => pack.decks);
    expect(new Set(ids(decks)).size).toBe(decks.length);
    expect(ids(decks)).toEqual(
      ids([...CORE_STARTER_DECKS, ...WAVE1_STARTER_DECKS, ...WAVE2_STARTER_DECKS, ...WAVE3_STARTER_DECKS]),
    );
  });

  // A script no card names passes `defineBuiltinPack` by its card code (a rule grants it), so a script left behind by a
  // renamed ref would too: each one is listed here, and a new one has to be added on purpose.
  it("hold no script that no card names, except the ones a rule grants", () => {
    const named = new Set(BUILTIN_PACKS.flatMap((pack) => pack.cards.flatMap(abilityRefIds)));
    const unnamed = BUILTIN_PACKS.flatMap((pack) => Object.keys(pack.abilities).filter((id) => !named.has(id)));
    // Nebula's Ship's guard, granted by GMW Balanced's `gainsAbility` rule (`campaigns/gmw-balanced.ts`).
    expect(unnamed).toEqual(["16093.balanced-evasion-guard"]);
  });

  it("is where the Core registry comes from", () => {
    expect(CORE_ABILITIES).toBe(CORE_BUILTIN_PACK.abilities);
  });

  it("together hold every script of the wave 3 pool, which takes in waves 1 and 2, each in one pack", () => {
    const fromPacks = BUILTIN_PACKS.flatMap((pack) => Object.entries(pack.abilities));
    expect(new Set(fromPacks.map(([id]) => id)).size).toBe(fromPacks.length);
    expect(fromPacks.map(([id]) => id).sort()).toEqual(Object.keys(WAVE3_ABILITIES).sort());
    for (const [id, definition] of fromPacks) expect(WAVE3_ABILITIES[id]).toBe(definition);
  });

  describe.each(WAVES)("%s", (_, registry, earlier, aliases, packs) => {
    it("gives each reprint alias to the product holding its card", () => {
      const placed = packs.flatMap((pack) => Object.keys(pack.abilities).filter((id) => Object.hasOwn(aliases, id)));
      expect(placed.sort()).toEqual(Object.keys(aliases).sort());
    });

    it("builds its registry as the earlier layers, then the reprint aliases, then each pack's own scripts", () => {
      const layers = [...earlier, aliases, ...packs.map((pack) => ownScriptsOf(pack, aliases))];
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

  it("refuses another product's card, a script for no card of the pack, and a manifest that isn't its product", () => {
    const broken: BuiltinPack = {
      ...CORE_BUILTIN_PACK,
      manifest: { ...CORE_BUILTIN_PACK.manifest, id: "kore" },
      cards: [...CORE_CARDS, capCard],
      abilities: { "99999.nobody": coreScript[1] },
    };
    const problems = builtinPackProblems(broken);
    expect(problems).toContain("manifest id kore is not its product's code core");
    expect(problems).toContain(`card ${capCard.id} is from cap, not kore`);
    expect(problems).toContain("ability 99999.nobody is not on any kore card");
    expect(() => defineBuiltinPack(broken)).toThrow(/built-in pack kore:/);
  });

  it("refuses a Core script in a wave 1 product", () => {
    const cap = WAVE1_BUILTIN_PACKS[0]!;
    const pack: BuiltinPack = { ...cap, abilities: { ...cap.abilities, [coreScript[0]]: coreScript[1] } };
    expect(builtinPackProblems(pack)).toEqual([`ability ${coreScript[0]} is not on any cap card`]);
  });
});

import {
  CORE_CARDS,
  CORE_ENCOUNTER_SETS,
  CORE_SCENARIOS,
  CORE_STARTER_DECKS,
  WAVE1_CARDS,
  WAVE1_ENCOUNTER_SETS,
  WAVE1_SCENARIOS,
  WAVE1_STARTER_DECKS,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import { CORE_ABILITIES } from "../core/index.js";
import { CORE_BUILTIN_PACK } from "../core/pack.js";
import { WAVE1_ABILITIES, WAVE1_BUILTIN_PACKS, WAVE1_REPRINT_ABILITIES } from "../wave1/index.js";
import { builtinPackProblems, defineBuiltinPack, type BuiltinPack } from "./define.js";
import { BUILTIN_PACKS } from "./index.js";

describe("built-in packs", () => {
  it("lists Core, then wave 1's eight products in merge order", () => {
    expect(BUILTIN_PACKS.map((pack) => pack.manifest.id)).toEqual([
      "core",
      "cap",
      "thor",
      "msm",
      "hlk",
      "bkw",
      "drs",
      "gob",
      "twc",
    ]);
  });

  it.each(BUILTIN_PACKS.map((pack) => [pack.manifest.id, pack] as const))("%s holds together", (_, pack) => {
    expect(builtinPackProblems(pack)).toEqual([]);
  });

  it("covers every card of the wave 1 pool once, as the same records", () => {
    const fromPacks = BUILTIN_PACKS.flatMap((pack) => pack.cards);
    expect(new Set(fromPacks).size).toBe(fromPacks.length);
    expect(new Set(fromPacks)).toEqual(new Set(WAVE1_CARDS));
    expect(CORE_BUILTIN_PACK.cards).toBe(CORE_CARDS);
  });

  it.each([
    ["scenarios", [...CORE_SCENARIOS, ...WAVE1_SCENARIOS], (pack: BuiltinPack) => pack.scenarios],
    ["encounter sets", [...CORE_ENCOUNTER_SETS, ...WAVE1_ENCOUNTER_SETS], (pack: BuiltinPack) => pack.encounterSets],
    ["precons", [...CORE_STARTER_DECKS, ...WAVE1_STARTER_DECKS], (pack: BuiltinPack) => pack.decks],
  ] as const)("covers every Core and wave 1 record of %s once, by id", (_, expected, of) => {
    const ids = BUILTIN_PACKS.flatMap((pack) => of(pack).map((record) => record.id as string));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(expected.map((record) => record.id as string).sort());
  });

  it("together hold every wave 1 script, as the same definitions, each in one pack", () => {
    const fromPacks = BUILTIN_PACKS.flatMap((pack) => Object.entries(pack.abilities));
    expect(new Set(fromPacks.map(([id]) => id)).size).toBe(fromPacks.length);
    expect(fromPacks.map(([id]) => id).sort()).toEqual(Object.keys(WAVE1_ABILITIES).sort());
    for (const [id, definition] of fromPacks) expect(WAVE1_ABILITIES[id]).toBe(definition);
  });

  it("gives each reprint alias to the product holding its card", () => {
    const placed = WAVE1_BUILTIN_PACKS.flatMap((pack) =>
      Object.keys(pack.abilities).filter((id) => Object.hasOwn(WAVE1_REPRINT_ABILITIES, id)),
    );
    expect(placed.sort()).toEqual(Object.keys(WAVE1_REPRINT_ABILITIES).sort());
  });

  it("is where the Core registry comes from", () => {
    expect(CORE_ABILITIES).toBe(CORE_BUILTIN_PACK.abilities);
  });

  it("builds the wave 1 registry as Core, then the reprint aliases, then each pack's own scripts", () => {
    const own = (pack: BuiltinPack) =>
      Object.fromEntries(Object.entries(pack.abilities).filter(([id]) => !Object.hasOwn(WAVE1_REPRINT_ABILITIES, id)));
    const layers = [CORE_ABILITIES, WAVE1_REPRINT_ABILITIES, ...WAVE1_BUILTIN_PACKS.map(own)];
    expect(Object.keys(WAVE1_ABILITIES)).toEqual(layers.flatMap((layer) => Object.keys(layer)));
    for (const layer of layers) {
      for (const [id, definition] of Object.entries(layer)) expect(WAVE1_ABILITIES[id]).toBe(definition);
    }
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

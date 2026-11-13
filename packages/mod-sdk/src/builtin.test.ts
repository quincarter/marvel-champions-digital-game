import { BUILTIN_PACKS, CORE_BUILTIN_PACK, type BuiltinPack } from "@mc/cards";
import { describe, expect, it } from "vitest";
import { validateBuiltinPack } from "./builtin.js";
import { customContentOfPacks, gameDepsWithPacks, type PackGameContent } from "./game.js";
import { splitIssues } from "./validate.js";

describe("built-in packs through the SDK", () => {
  it.each(BUILTIN_PACKS.map((pack) => [pack.manifest.id, pack] as const))("%s passes the SDK's checks", (_, pack) => {
    const { defects } = splitIssues(validateBuiltinPack(pack));
    expect(defects).toEqual([]);
  });

  it("are the shape the SDK's game helpers take", () => {
    const asPackContent: readonly PackGameContent[] = BUILTIN_PACKS;
    const content = customContentOfPacks(asPackContent);
    expect(content.cards).toHaveLength(BUILTIN_PACKS.reduce((n, pack) => n + pack.cards.length, 0));
    const deps = gameDepsWithPacks({ abilities: {} }, asPackContent);
    expect(Object.keys(deps.abilities)).toHaveLength(
      BUILTIN_PACKS.reduce((n, pack) => n + Object.keys(pack.abilities).length, 0),
    );
  });

  it("reports a broken built-in pack", () => {
    const [id, definition] = Object.entries(CORE_BUILTIN_PACK.abilities)[0]!;
    const broken: BuiltinPack = {
      ...CORE_BUILTIN_PACK,
      abilities: { ...CORE_BUILTIN_PACK.abilities, [id]: { ...definition, trigger: () => undefined } as never },
    };
    const { defects } = splitIssues(validateBuiltinPack(broken, { baseAbilities: {} }));
    expect(defects.some((issue) => issue.path === `abilities/${id}`)).toBe(true);
  });

  it("lists a card whose ability nobody has scripted apart from defects", () => {
    const [id] = Object.keys(CORE_BUILTIN_PACK.abilities);
    const rest = Object.fromEntries(Object.entries(CORE_BUILTIN_PACK.abilities).filter(([key]) => key !== id));
    const { unscripted, defects } = splitIssues(
      validateBuiltinPack({ ...CORE_BUILTIN_PACK, abilities: rest }, { baseAbilities: {} }),
    );
    expect(defects).toEqual([]);
    expect(unscripted.map((issue) => issue.message)).toContain(`ability "${id}" is not scripted`);
  });
});

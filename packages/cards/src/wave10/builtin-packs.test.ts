import { describe, expect, it } from "vitest";
import { mergeRegistries } from "../dsl/index.js";
import { WAVE9_ABILITIES } from "../wave9/index.js";
import { WAVE10_ABILITIES, WAVE10_BUILTIN_PACKS } from "./index.js";
import { WAVE10_MODULES } from "./modules.js";

describe("wave 10 built-in packs", () => {
  it("put every module in the pack of its product folder", () => {
    const ids = new Set(WAVE10_BUILTIN_PACKS.map((pack) => pack.manifest.id));
    expect(WAVE10_MODULES.map((module) => module.group.split("/")[0]).filter((product) => !ids.has(product!))).toEqual(
      [],
    );
  });

  it("merge to the module list's registry, in the same key order", () => {
    const fromModules = mergeRegistries(WAVE9_ABILITIES, ...WAVE10_MODULES.map((module) => module.registry));
    expect(Object.keys(WAVE10_ABILITIES)).toEqual(Object.keys(fromModules));
    for (const [id, definition] of Object.entries(fromModules)) expect(WAVE10_ABILITIES[id]).toBe(definition);
  });
});

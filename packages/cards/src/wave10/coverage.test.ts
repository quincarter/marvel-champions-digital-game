/**
 * Coverage for the wave 10 (Civil War, `cw`) modules, modeled on `../wave9/coverage.test.ts`. Every ability ref of every
 * `cw` card is either registered by its own module or in that module's `_SKIPPED` map with a written reason; a scaffold
 * module has an empty registry and every ref skipped ("wave 10 scripting in progress: <module>"). A module agent fills
 * its registry and deletes its own `_SKIPPED` lines; nothing here changes.
 */
import { CW_CARDS, HERCULES_CARDS, SYNTHEZOID_CARDS, WONDER_MAN_CARDS } from "@mc/content";
import { abilityRefIds } from "../ability-refs.js";
import { WAVE9_ABILITIES } from "../wave9/index.js";
import { CARD_GROUPS } from "./card-groups.js";
import { WAVE10_ABILITIES } from "./index.js";
import { WAVE10_MODULES } from "./modules.js";

const WAVE10_PACK_CARDS = [...CW_CARDS, ...SYNTHEZOID_CARDS, ...WONDER_MAN_CARDS, ...HERCULES_CARDS];

describe("wave 10 ability registry", () => {
  it("includes every wave 9 (Core through cycle 9) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE9_ABILITIES)) expect(WAVE10_ABILITIES[id], id).toBe(definition);
  });

  it("holds every module's registry and nothing else", () => {
    const own = Object.keys(WAVE10_ABILITIES).filter((id) => !(id in WAVE9_ABILITIES));
    expect(own.sort()).toEqual(WAVE10_MODULES.flatMap((m) => Object.keys(m.registry)).sort());
  });
});

describe("wave 10 module ability coverage", () => {
  it.each(WAVE10_MODULES.map((m) => [m.group, m] as const))("%s: every ref registered or skipped", (group, m) => {
    const refs = WAVE10_PACK_CARDS.filter((c) => CARD_GROUPS[group]!.includes(c.id as string)).flatMap(abilityRefIds);
    expect(refs.filter((id) => !(id in m.registry) && !(id in m.skipped))).toEqual([]);
    expect(Object.keys(m.skipped).filter((id) => id in m.registry || !refs.includes(id))).toEqual([]);
    expect(Object.keys(m.registry).filter((id) => !refs.includes(id) && !m.registryOnly?.includes(id))).toEqual([]);
    for (const [id, reason] of Object.entries(m.skipped)) expect(reason.length, `${id} reason`).toBeGreaterThan(20);
  });

  it("every cw, wonder_man and hercules ability ref resolves, except its documented skips", () => {
    const refs = WAVE10_PACK_CARDS.flatMap(abilityRefIds);
    const skipped = WAVE10_MODULES.flatMap((m) => Object.keys(m.skipped));
    const missing = refs.filter((id) => !(id in WAVE10_ABILITIES));
    expect(missing.filter((id) => !skipped.includes(id))).toEqual([]);
    expect(missing).toHaveLength(skipped.length);
  });
});

/** Every ability id a module registers must be named in a test file of the wave's module folders. */
describe("wave 10 ability id coverage", () => {
  const rawTestFiles = (import.meta as unknown as ImportMetaEnv).glob(
    ["./cw/**/*.test.ts", "./synthezoid/**/*.test.ts", "./wonder_man/**/*.test.ts", "./hercules/**/*.test.ts"],
    {
      query: "?raw",
      import: "default",
      eager: true,
    },
  ) as Record<string, string>;
  interface ImportMetaEnv {
    readonly glob: (pattern: string | string[], opts: object) => unknown;
  }

  it("every ability id a module registers is named in one of the wave 10 test files", () => {
    const text = Object.values(rawTestFiles).join("\n");
    const unnamed = WAVE10_MODULES.flatMap((m) => Object.keys(m.registry)).filter((id) => !text.includes(id));
    expect(unnamed, "ids registered but not named in any wave10/**/*.test.ts file").toEqual([]);
  });
});

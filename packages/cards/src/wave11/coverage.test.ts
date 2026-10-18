/**
 * Coverage for the wave 11 hero-pack modules (`jj`, `luke_cage`, and the `fne` player half), modeled on
 * `../wave10/coverage.test.ts`. Every
 * ability
 * ref of every card is either registered by its own module or in that module's `_SKIPPED` map with a written reason; a
 * scaffold module has every ref skipped ("wave 11 scripting in progress: <module>") except its reprint aliases. A
 * module
 * agent fills its registry and deletes its own `_SKIPPED` lines; nothing here changes.
 */
import { FNE_CARDS, JJ_CARDS, LUKE_CAGE_CARDS } from "@mc/content";
import { abilityRefIds } from "../ability-refs.js";
import { WAVE10_ABILITIES } from "../wave10/index.js";
import { CARD_GROUPS, isFnePlayerHalfId } from "./card-groups.js";
import { WAVE11_ABILITIES } from "./index.js";
import { WAVE11_MODULES } from "./modules.js";

// Fear No Evil: the player half (60001a to 60064); its encounter cards (60065 on) get their own modules later.
const WAVE11_PACK_CARDS = [
  ...JJ_CARDS,
  ...LUKE_CAGE_CARDS,
  ...FNE_CARDS.filter((c) => isFnePlayerHalfId(c.id as string)),
];

describe("wave 11 ability registry", () => {
  it("includes every wave 10 (Core through cycle 10) script, the same definition object", () => {
    for (const [id, definition] of Object.entries(WAVE10_ABILITIES)) expect(WAVE11_ABILITIES[id], id).toBe(definition);
  });

  it("holds every module's registry and nothing else", () => {
    const own = Object.keys(WAVE11_ABILITIES).filter((id) => !(id in WAVE10_ABILITIES));
    expect(own.sort()).toEqual(WAVE11_MODULES.flatMap((m) => Object.keys(m.registry)).sort());
  });
});

describe("wave 11 module ability coverage", () => {
  it.each(WAVE11_MODULES.map((m) => [m.group, m] as const))("%s: every ref registered or skipped", (group, m) => {
    const refs = WAVE11_PACK_CARDS.filter((c) => CARD_GROUPS[group]!.includes(c.id as string)).flatMap(abilityRefIds);
    expect(refs.filter((id) => !(id in m.registry) && !(id in m.skipped))).toEqual([]);
    expect(Object.keys(m.skipped).filter((id) => id in m.registry || !refs.includes(id))).toEqual([]);
    expect(Object.keys(m.registry).filter((id) => !refs.includes(id) && !m.registryOnly?.includes(id))).toEqual([]);
    for (const [id, reason] of Object.entries(m.skipped)) expect(reason.length, `${id} reason`).toBeGreaterThan(20);
  });

  it("every jj, luke_cage and fne player-half ability ref resolves, except its documented skips", () => {
    const refs = WAVE11_PACK_CARDS.flatMap(abilityRefIds);
    const skipped = WAVE11_MODULES.flatMap((m) => Object.keys(m.skipped));
    const missing = refs.filter((id) => !(id in WAVE11_ABILITIES));
    expect(missing.filter((id) => !skipped.includes(id))).toEqual([]);
    expect(missing).toHaveLength(skipped.length);
  });
});

interface ImportMetaGlob {
  readonly glob: (pattern: string | string[], opts: object) => unknown;
}
const joined = (files: unknown): string => Object.values(files as Record<string, string>).join("\n");

/** Every ability id a module registers must be named in a test file of its pack folder. */
describe("wave 11 ability id coverage", () => {
  const textOf: Readonly<Record<string, string>> = {
    jj: joined(
      (import.meta as unknown as ImportMetaGlob).glob("./jj/**/*.test.ts", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
    ),
    luke_cage: joined(
      (import.meta as unknown as ImportMetaGlob).glob("./luke_cage/**/*.test.ts", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
    ),
    fne: joined(
      (import.meta as unknown as ImportMetaGlob).glob("./fne/**/*.test.ts", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
    ),
  };

  it("every ability id a module registers is named in a test file of its pack folder", () => {
    const unnamed = WAVE11_MODULES.flatMap((m) =>
      Object.keys(m.registry).filter((id) => !textOf[m.group.split("/")[0]!]!.includes(`"${id}"`)),
    );
    expect(unnamed, "ids registered but not named in any test file of their pack folder").toEqual([]);
  });
});

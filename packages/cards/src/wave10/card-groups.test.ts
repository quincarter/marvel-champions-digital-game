/**
 * Every wave 10 card belongs to exactly one scripting module. `CARD_GROUPS` (module path to card ids) is checked against
 * the emitted data, against the modules on disk, and against each module's header list, so a card cannot be left out,
 * listed twice or filed under the wrong pack unnoticed.
 */
import { CW_CARDS, HERCULES_CARDS, SYNTHEZOID_CARDS, WONDER_MAN_CARDS } from "@mc/content";
import { CARD_GROUPS } from "./card-groups.js";
import { WAVE10_MODULES } from "./modules.js";

const PACK_PREFIX: Readonly<Record<string, string>> = { cw: "56", synthezoid: "57", wonder_man: "58", hercules: "59" };

describe("wave 10 card groups", () => {
  it("holds every cw, wonder_man and hercules card in exactly one group", () => {
    const seen = new Map<string, string[]>();
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      for (const id of ids) seen.set(id, [...(seen.get(id) ?? []), group]);
    }
    const twice = [...seen].filter(([, groups]) => groups.length > 1).map(([id, groups]) => `${id}: ${groups}`);
    expect(twice).toEqual([]);
    expect([...seen.keys()].sort()).toEqual(
      [...CW_CARDS, ...SYNTHEZOID_CARDS, ...WONDER_MAN_CARDS, ...HERCULES_CARDS].map((card) => card.id).sort(),
    );
    expect(CW_CARDS).toHaveLength(190);
    expect(SYNTHEZOID_CARDS).toHaveLength(75);
    expect(WONDER_MAN_CARDS).toHaveLength(34);
    expect(HERCULES_CARDS).toHaveLength(45);
  });

  it("files each card under its pack folder and in that pack's id range", () => {
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      const prefix = PACK_PREFIX[group.split("/")[0]!];
      expect(prefix, group).toBeDefined();
      for (const id of ids) expect(id.startsWith(prefix!), `${id} in ${group}`).toBe(true);
    }
  });

  it("has one module file per group, wired into modules.ts, with a header listing exactly its ids", () => {
    const sources = (
      import.meta as unknown as { glob: (p: string | string[], o: object) => Record<string, string> }
    ).glob(["./cw/**/*.ts", "./synthezoid/**/*.ts", "./wonder_man/**/*.ts", "./hercules/**/*.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(WAVE10_MODULES.map((m) => m.group).sort()).toEqual(Object.keys(CARD_GROUPS).sort());
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      const text = sources[`./${group}.ts`];
      expect(text, `module ${group}.ts exists`).toBeDefined();
      const listed = [...text!.matchAll(/^ \* - (\S+) /gm)].map((m) => m[1]);
      expect(listed, group).toEqual([...ids]);
    }
  });
});

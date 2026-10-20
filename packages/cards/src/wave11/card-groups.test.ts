/**
 * Every wave 11 hero-pack card belongs to exactly one scripting module. `CARD_GROUPS` (module path to card ids) is
 * checked
 * against the emitted data, against the modules on disk, and against each module's header list.
 */
import { FNE_CARDS, JJ_CARDS, LUKE_CAGE_CARDS, SHADOWLAND_CARDS } from "@mc/content";
import { CARD_GROUPS } from "./card-groups.js";
import { WAVE11_MODULES } from "./modules.js";

const PACK_PREFIX: Readonly<Record<string, string>> = { jj: "61", luke_cage: "62", fne: "60", shadowland: "65" };

describe("wave 11 card groups", () => {
  it("holds every jj, luke_cage, fne and shadowland card in exactly one group", () => {
    const seen = new Map<string, string[]>();
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      for (const id of ids) seen.set(id, [...(seen.get(id) ?? []), group]);
    }
    const twice = [...seen].filter(([, groups]) => groups.length > 1).map(([id, groups]) => `${id}: ${groups}`);
    expect(twice).toEqual([]);
    expect([...seen.keys()].sort()).toEqual(
      [...JJ_CARDS, ...LUKE_CAGE_CARDS, ...FNE_CARDS, ...SHADOWLAND_CARDS].map((card) => card.id as string).sort(),
    );
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
    ).glob(["./jj/**/*.ts", "./luke_cage/**/*.ts", "./fne/**/*.ts", "./shadowland/**/*.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(WAVE11_MODULES.map((m) => m.group).sort()).toEqual(Object.keys(CARD_GROUPS).sort());
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      const text = sources[`./${group}.ts`];
      expect(text, `module ${group}.ts exists`).toBeDefined();
      const listed = [...text!.matchAll(/^ \* - (\S+) /gm)].map((m) => m[1]);
      expect(listed, group).toEqual([...ids]);
    }
  });
});

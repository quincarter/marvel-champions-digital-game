/**
 * Every wave 8 card belongs to exactly one scripting module. `CARD_GROUPS` (module path to card ids) is checked against
 * the emitted data, against the modules on disk, and against each module's header list, so a card cannot be left out,
 * listed twice or filed under the wrong pack unnoticed.
 */
import { CORE_CARDS, WAVE8_CARDS } from "@mc/content";
import { CARD_GROUPS } from "./card-groups.js";

const NON_CORE = WAVE8_CARDS.filter((card) => !CORE_CARDS.some((core) => core.id === card.id));
const PACK_PREFIX: Record<string, string> = { aoa: "45", iceman: "46", jubilee: "47", ncrawler: "48", magneto: "49" };

describe("wave 8 card groups", () => {
  it("holds every non-Core wave 8 card in exactly one group", () => {
    const seen = new Map<string, string[]>();
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      for (const id of ids) seen.set(id, [...(seen.get(id) ?? []), group]);
    }
    const twice = [...seen].filter(([, groups]) => groups.length > 1).map(([id, groups]) => `${id}: ${groups}`);
    expect(twice).toEqual([]);
    expect([...seen.keys()].sort()).toEqual(NON_CORE.map((card) => card.id).sort());
    expect(NON_CORE).toHaveLength(346);
  });

  it("files each card under its own pack's folder", () => {
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      const pack = group.split("/")[0]!;
      for (const id of ids) expect(id.startsWith(PACK_PREFIX[pack]!), `${id} in ${group}`).toBe(true);
    }
  });

  it("has one module file per group, and a header listing exactly its ids", () => {
    const sources = (import.meta as unknown as { glob: (p: string, o: object) => Record<string, string> }).glob(
      "./**/*.ts",
      { query: "?raw", import: "default", eager: true },
    );
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      const text = sources[`./${group}.ts`];
      expect(text, `module ${group}.ts exists`).toBeDefined();
      const listed = [...text!.matchAll(/^ \* - (\S+) /gm)].map((m) => m[1]);
      expect(listed, group).toEqual([...ids]);
    }
  });
});

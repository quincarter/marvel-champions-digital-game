/**
 * Every wave 9 card belongs to exactly one scripting module. `CARD_GROUPS` (module path to card ids) is checked against
 * the emitted data, against the modules on disk, and against each module's header list, so a card cannot be left out,
 * listed twice or filed under the wrong pack unnoticed.
 */
import { AOS_CARDS, BP_CARDS, FALCON_CARDS, SILK_CARDS, TT_CARDS, WAVE9_CARDS, WINTER_CARDS } from "@mc/content";
import { CARD_GROUPS } from "./card-groups.js";

const PACK_CARDS: Record<string, readonly { id: string }[]> = {
  aos: AOS_CARDS,
  bp: BP_CARDS,
  silk: SILK_CARDS,
  falcon: FALCON_CARDS,
  winter: WINTER_CARDS,
  tt: TT_CARDS,
};
const PACK_PREFIX: Record<string, string> = { aos: "50", bp: "51", silk: "52", falcon: "53", winter: "54", tt: "55" };
const OWN = Object.values(PACK_CARDS).flat();

describe("wave 9 card groups", () => {
  it("holds every wave 9 card in exactly one group", () => {
    const seen = new Map<string, string[]>();
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      for (const id of ids) seen.set(id, [...(seen.get(id) ?? []), group]);
    }
    const twice = [...seen].filter(([, groups]) => groups.length > 1).map(([id, groups]) => `${id}: ${groups}`);
    expect(twice).toEqual([]);
    expect([...seen.keys()].sort()).toEqual(OWN.map((card) => card.id).sort());
    expect(OWN).toHaveLength(196 + 42 + 38 + 42 + 37 + 63);
    expect(WAVE9_CARDS.filter((card) => OWN.some((own) => own.id === card.id))).toHaveLength(OWN.length);
  });

  it("files each card under its own pack's folder", () => {
    for (const [group, ids] of Object.entries(CARD_GROUPS)) {
      const pack = group.split("/")[0]!;
      for (const id of ids) expect(id.startsWith(PACK_PREFIX[pack]!), `${id} in ${group}`).toBe(true);
      for (const id of ids)
        expect(
          PACK_CARDS[pack]!.some((card) => card.id === id),
          `${id} in ${pack}`,
        ).toBe(true);
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

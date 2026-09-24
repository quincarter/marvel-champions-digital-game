/**
 * The data-only pool (PLAN.md Phase 7): packs beyond Core/wave 1/cycle 1 that normalize cleanly and are wired
 * for the deck builder to show, but are not playable yet (no ability scripts exist for them in `@mc/cards`).
 * See docs/phase7-wave2-data.md for the full 56-pack survey and what's left for the other ~41 packs.
 */
import { validateCard, type AnyCard, type HeroIdentityCard } from "../schema/index.js";
import {
  DATA_ONLY_CARDS,
  DATA_ONLY_ENCOUNTER_SETS,
  BP_CARDS,
  BP_PACK,
  CYCLOPS_CARDS,
  CYCLOPS_PACK,
  GAMBIT_CARDS,
  GAMBIT_PACK,
  NEBU_CARDS,
  NEBU_PACK,
  WARM_CARDS,
  WARM_PACK,
  VISION_CARDS,
  VISION_PACK,
  NCRAWLER_CARDS,
  NCRAWLER_PACK,
  MAGNETO_CARDS,
  MAGNETO_PACK,
  WINTER_CARDS,
  WINTER_PACK,
  FALCON_CARDS,
  FALCON_PACK,
  NOVA_CARDS,
  NOVA_PACK,
  SILK_CARDS,
  SILK_PACK,
  SPDR_CARDS,
  SPDR_PACK,
  ROGUE_CARDS,
  ROGUE_PACK,
  WOLV_CARDS,
  WOLV_PACK,
  HOOD_CARDS,
  HOOD_PACK,
  IRONHEART_CARDS,
  IRONHEART_PACK,
  ICEMAN_CARDS,
  ICEMAN_PACK,
  WONDER_MAN_CARDS,
  WONDER_MAN_PACK,
  X23_CARDS,
  X23_PACK,
  VALK_CARDS,
  VALK_PACK,
  DEADPOOL_CARDS,
  DEADPOOL_PACK,
  SPIDERHAM_CARDS,
  SPIDERHAM_PACK,
  MOJO_CARDS,
  MOJO_PACK,
  ANGEL_CARDS,
  ANGEL_PACK,
  STORM_CARDS,
  STORM_PACK,
  PSYLOCKE_CARDS,
  PSYLOCKE_PACK,
  JUBILEE_CARDS,
  JUBILEE_PACK,
  MTS_CARDS,
  MTS_PACK,
} from "./index.js";
import { CORE_CARDS } from "./core/index.js";
import { WAVE1_CARDS } from "./index.js";
import { WAVE2_CARDS } from "./index.js";

const PACKS: readonly {
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly pack: { readonly cycleId: string; readonly releaseDate?: string };
}[] = [
  { code: "bp", cards: BP_CARDS, pack: BP_PACK },
  { code: "cyclops", cards: CYCLOPS_CARDS, pack: CYCLOPS_PACK },
  { code: "gambit", cards: GAMBIT_CARDS, pack: GAMBIT_PACK },
  { code: "nebu", cards: NEBU_CARDS, pack: NEBU_PACK },
  { code: "warm", cards: WARM_CARDS, pack: WARM_PACK },
  { code: "vision", cards: VISION_CARDS, pack: VISION_PACK },
  { code: "ncrawler", cards: NCRAWLER_CARDS, pack: NCRAWLER_PACK },
  { code: "magneto", cards: MAGNETO_CARDS, pack: MAGNETO_PACK },
  { code: "winter", cards: WINTER_CARDS, pack: WINTER_PACK },
  { code: "falcon", cards: FALCON_CARDS, pack: FALCON_PACK },
  { code: "nova", cards: NOVA_CARDS, pack: NOVA_PACK },
  { code: "silk", cards: SILK_CARDS, pack: SILK_PACK },
  { code: "spdr", cards: SPDR_CARDS, pack: SPDR_PACK },
  { code: "rogue", cards: ROGUE_CARDS, pack: ROGUE_PACK },
  { code: "wolv", cards: WOLV_CARDS, pack: WOLV_PACK },
  { code: "hood", cards: HOOD_CARDS, pack: HOOD_PACK },
  { code: "ironheart", cards: IRONHEART_CARDS, pack: IRONHEART_PACK },
  { code: "iceman", cards: ICEMAN_CARDS, pack: ICEMAN_PACK },
  { code: "wonder_man", cards: WONDER_MAN_CARDS, pack: WONDER_MAN_PACK },
  { code: "x23", cards: X23_CARDS, pack: X23_PACK },
  { code: "valk", cards: VALK_CARDS, pack: VALK_PACK },
  { code: "deadpool", cards: DEADPOOL_CARDS, pack: DEADPOOL_PACK },
  { code: "spiderham", cards: SPIDERHAM_CARDS, pack: SPIDERHAM_PACK },
  { code: "mojo", cards: MOJO_CARDS, pack: MOJO_PACK },
  { code: "angel", cards: ANGEL_CARDS, pack: ANGEL_PACK },
  { code: "storm", cards: STORM_CARDS, pack: STORM_PACK },
  { code: "psylocke", cards: PSYLOCKE_CARDS, pack: PSYLOCKE_PACK },
  { code: "jubilee", cards: JUBILEE_CARDS, pack: JUBILEE_PACK },
  { code: "mts", cards: MTS_CARDS, pack: MTS_PACK },
];

describe("data-only pool — integrity", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = DATA_ONLY_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("29 packs, no duplicate ids, and DATA_ONLY_CARDS is exactly their concatenation", () => {
    expect(PACKS).toHaveLength(29);
    const ids = DATA_ONLY_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DATA_ONLY_CARDS.length).toBe(PACKS.reduce((n, p) => n + p.cards.length, 0));
  });

  it("no data-only card id collides with Core, wave 1 or wave 2 (cycle 1)", () => {
    const known = new Set([...CORE_CARDS, ...WAVE1_CARDS, ...WAVE2_CARDS].map((c) => c.id as string));
    for (const c of DATA_ONLY_CARDS) expect(known.has(c.id as string), c.id as string).toBe(false);
  });

  it.each(PACKS.map((p) => [p.code, p] as const))(
    "%s: every card belongs to its own pack, and the pack has a real release date",
    (code, pack) => {
      for (const c of pack.cards) expect(c.setCode, c.id as string).toBe(code);
      expect(pack.pack.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  it("cycle grouping matches the Hall of Heroes card database navigation (https://hallofheroeslcg.com/browse/)", () => {
    const cycleOf = (code: string) => PACKS.find((p) => p.code === code)?.pack.cycleId;
    // Cycle 3 (Guardians of the Galaxy) has moved entirely out of this pool: The Galaxy's Most Wanted, Star-Lord,
    // Gamora, Drax and Venom are now `WAVE3_CARDS` (wave3.test.ts), and Ronan (a promo, not cycle 3) moved with
    // them since all six are scripted together (docs/phase7-wave3.md).
    // Cycle 4: Nebula, The Mad Titan's Shadow, War Machine, Vision, The Hood, Valkyrie.
    for (const code of ["nebu", "mts", "warm", "vision", "hood", "valk"]) expect(cycleOf(code), code).toBe("cycle4");
    // Cycle 6 (X-Men): Cyclops, Gambit, Wolverine, Rogue, Mojo Mania, Storm (Phoenix is not in this pool yet —
    // blocked, see curation/phoenix.ts).
    for (const code of ["cyclops", "gambit", "wolv", "rogue", "mojo", "storm"])
      expect(cycleOf(code), code).toBe("cycle6");
    // Cycle 7: X-23, Deadpool, Angel, Psylocke.
    for (const code of ["x23", "deadpool", "angel", "psylocke"]) expect(cycleOf(code), code).toBe("cycle7");
    // Cycle 8: Nightcrawler, Magneto, Iceman, Jubilee.
    for (const code of ["ncrawler", "magneto", "iceman", "jubilee"]) expect(cycleOf(code), code).toBe("cycle8");
    // Cycle 9: Black Panther/Shuri, Silk, Winter Soldier, Falcon (Trickster Takeover is not in this pool yet).
    for (const code of ["bp", "silk", "winter", "falcon"]) expect(cycleOf(code), code).toBe("cycle9");
    // Cycle 5: Nova, SP//dr, Ironheart, Spider-Ham.
    for (const code of ["nova", "spdr", "ironheart", "spiderham"]) expect(cycleOf(code), code).toBe("cycle5");
    // Cycle 10: Wonder Man (Hercules/Fear No Evil are not in this pool yet).
    expect(cycleOf("wonder_man")).toBe("cycle10");
  });

  it("every hero-pack identity carries a real name (no dangling/placeholder faces)", () => {
    for (const c of DATA_ONLY_CARDS) {
      if (c.type !== "hero_identity") continue;
      const identity = c as HeroIdentityCard;
      expect(identity.hero.faceName.length, identity.id as string).toBeGreaterThan(0);
      expect(identity.alterEgo.faceName.length, identity.id as string).toBeGreaterThan(0);
    }
  });

  it("registers encounter sets for every pack, with no duplicate ids", () => {
    const ids = DATA_ONLY_ENCOUNTER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(PACKS.length);
  });
});

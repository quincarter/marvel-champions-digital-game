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
  WINTER_CARDS,
  WINTER_PACK,
  FALCON_CARDS,
  FALCON_PACK,
  SILK_CARDS,
  SILK_PACK,
  WONDER_MAN_CARDS,
  WONDER_MAN_PACK,
  PHOENIX_CARDS,
} from "./index.js";
import { CORE_CARDS } from "./core/index.js";
import { WAVE1_CARDS } from "./index.js";
import { WAVE2_CARDS } from "./index.js";
import { WAVE3_CARDS } from "./index.js";
import { WAVE4_CARDS } from "./index.js";
import { WAVE5_CARDS } from "./index.js";
import { WAVE6_CARDS } from "./index.js";
import { WAVE7_CARDS } from "./index.js";
import { WAVE8_CARDS } from "./index.js";

const PACKS: readonly {
  readonly code: string;
  readonly cards: readonly AnyCard[];
  readonly pack: { readonly cycleId: string; readonly releaseDate?: string };
}[] = [
  { code: "bp", cards: BP_CARDS, pack: BP_PACK },
  { code: "winter", cards: WINTER_CARDS, pack: WINTER_PACK },
  { code: "falcon", cards: FALCON_CARDS, pack: FALCON_PACK },
  { code: "silk", cards: SILK_CARDS, pack: SILK_PACK },
  { code: "wonder_man", cards: WONDER_MAN_CARDS, pack: WONDER_MAN_PACK },
];

describe("data-only pool — integrity", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = DATA_ONLY_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter(
      (f) => f.errors.length > 0,
    );
    expect(failures).toEqual([]);
  });

  it("five packs, no duplicate ids, and DATA_ONLY_CARDS is exactly their concatenation", () => {
    expect(PACKS).toHaveLength(5);
    const ids = DATA_ONLY_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DATA_ONLY_CARDS.length).toBe(PACKS.reduce((n, p) => n + p.cards.length, 0));
  });

  it("no data-only card id collides with Core, wave 1, wave 2 (cycle 1), wave 3 (cycle 2), wave 4 (cycle 3), wave 5 (cycle 4), wave 6 (cycle 6), wave 7 (cycle 7) or wave 8 (cycle 8)", () => {
    const known = new Set(
      [
        ...CORE_CARDS,
        ...WAVE1_CARDS,
        ...WAVE2_CARDS,
        ...WAVE3_CARDS,
        ...WAVE4_CARDS,
        ...WAVE5_CARDS,
        ...WAVE6_CARDS,
        ...WAVE7_CARDS,
        ...WAVE8_CARDS,
      ].map((c) => c.id as string),
    );
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
    // Cycle 4 has also moved entirely out of this pool: Nebula, The Mad Titan's Shadow, War Machine, Vision,
    // The Hood and Valkyrie are now `WAVE4_CARDS` (wave4.test.ts), scripted together (docs/phase7-wave4.md).
    // Cycle 4 (the rest): Sinister Motives, Nova, Ironheart, Spider-Ham and SP//dr are now `WAVE5_CARDS`
    // (wave5.test.ts), scripted together (docs/phase7-wave5.md). Silk, also cycle 4, stays in this pool until its
    // own kit is scripted (this pool's own header comment above).
    // Cycle 6 (X-Men) has moved entirely out of this pool: Mutant Genesis, Cyclops, Phoenix, Wolverine, Storm,
    // MojoMania, Gambit and Rogue are now `WAVE6_CARDS` (wave6.test.ts, docs/phase7-wave6.md).
    // Cycle 7 (NeXt Evolution, X-23, Deadpool, Angel, Psylocke) has moved entirely out of this pool: they are now
    // `WAVE7_CARDS` (wave7.test.ts, docs/phase7-wave7.md).
    // Cycle 8 (Age of Apocalypse, Nightcrawler, Magneto, Iceman, Jubilee) has moved entirely out of this pool: they are
    // now `WAVE8_CARDS` (wave8.test.ts, docs/phase7-wave8.md).
    // Cycle 9: Black Panther/Shuri, Silk, Winter Soldier, Falcon (Trickster Takeover is not in this pool yet).
    for (const code of ["bp", "silk", "winter", "falcon"]) expect(cycleOf(code), code).toBe("cycle9");
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

  it("phoenix: Burning Hunger (34028) carries the text curated from its scan, printed equal to current", () => {
    const card = PHOENIX_CARDS.find((c) => c.name === "Burning Hunger");
    expect(card?.type).toBe("obligation");
    if (card?.type !== "obligation") return;
    expect(card.text.printed).toMatch(
      /^Give to the Jean Grey player\.\nWhen Revealed: If you have the UNLEASHED trait/,
    );
    expect(card.text.printed).toMatch(/this card gains surge\. Discard this card\.$/);
    expect(card.text.current).toBe(card.text.printed);
  });
});

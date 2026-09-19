/**
 * The data-only pool (PLAN.md Phase 7): packs beyond Core/wave 1/cycle 1 that normalize cleanly and are wired
 * for the deck builder to show, but are not playable yet (no ability scripts exist for them in `@mc/cards`).
 * See docs/phase7-wave2-data.md for the full 56-pack survey and what's left for the other ~41 packs.
 */
import {
  validateCard,
  type AnyCard,
  type HeroIdentityCard,
} from "../schema/index.js";
import {
  DATA_ONLY_CARDS,
  DATA_ONLY_ENCOUNTER_SETS,
  BP_CARDS,
  BP_PACK,
  CYCLOPS_CARDS,
  CYCLOPS_PACK,
  GAMBIT_CARDS,
  GAMBIT_PACK,
  DRAX_CARDS,
  DRAX_PACK,
  GAM_CARDS,
  GAM_PACK,
  STLD_CARDS,
  STLD_PACK,
  VNM_CARDS,
  VNM_PACK,
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
  RON_CARDS,
  RON_PACK,
} from "./index.js";
import { CORE_CARDS } from "./core/index.js";
import { WAVE1_CARDS } from "./index.js";
import { WAVE2_CARDS } from "./index.js";

const PACKS: readonly { readonly code: string; readonly cards: readonly AnyCard[]; readonly pack: { readonly cycleId: string; readonly releaseDate?: string } }[] = [
  { code: "bp", cards: BP_CARDS, pack: BP_PACK },
  { code: "cyclops", cards: CYCLOPS_CARDS, pack: CYCLOPS_PACK },
  { code: "gambit", cards: GAMBIT_CARDS, pack: GAMBIT_PACK },
  { code: "drax", cards: DRAX_CARDS, pack: DRAX_PACK },
  { code: "gam", cards: GAM_CARDS, pack: GAM_PACK },
  { code: "stld", cards: STLD_CARDS, pack: STLD_PACK },
  { code: "vnm", cards: VNM_CARDS, pack: VNM_PACK },
  { code: "nebu", cards: NEBU_CARDS, pack: NEBU_PACK },
  { code: "warm", cards: WARM_CARDS, pack: WARM_PACK },
  { code: "vision", cards: VISION_CARDS, pack: VISION_PACK },
  { code: "ncrawler", cards: NCRAWLER_CARDS, pack: NCRAWLER_PACK },
  { code: "magneto", cards: MAGNETO_CARDS, pack: MAGNETO_PACK },
  { code: "winter", cards: WINTER_CARDS, pack: WINTER_PACK },
  { code: "falcon", cards: FALCON_CARDS, pack: FALCON_PACK },
  { code: "ron", cards: RON_CARDS, pack: RON_PACK },
];

describe("data-only pool — integrity", () => {
  it("every emitted card passes validateCard()", () => {
    const failures = DATA_ONLY_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors }))
      .filter((f) => f.errors.length > 0);
    expect(failures).toEqual([]);
  });

  it("15 packs, no duplicate ids, and DATA_ONLY_CARDS is exactly their concatenation", () => {
    expect(PACKS).toHaveLength(15);
    const ids = DATA_ONLY_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DATA_ONLY_CARDS.length).toBe(PACKS.reduce((n, p) => n + p.cards.length, 0));
  });

  it("no data-only card id collides with Core, wave 1 or wave 2 (cycle 1)", () => {
    const known = new Set([...CORE_CARDS, ...WAVE1_CARDS, ...WAVE2_CARDS].map((c) => c.id as string));
    for (const c of DATA_ONLY_CARDS) expect(known.has(c.id as string), c.id as string).toBe(false);
  });

  it.each(PACKS.map((p) => [p.code, p] as const))("%s: every card belongs to its own pack, and the pack has a real release date", (code, pack) => {
    for (const c of pack.cards) expect(c.setCode, c.id as string).toBe(code);
    expect(pack.pack.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("cycle grouping matches the Hall of Heroes card database navigation (https://hallofheroeslcg.com/browse/)", () => {
    const cycleOf = (code: string) => PACKS.find((p) => p.code === code)?.pack.cycleId;
    // Cycle 3 (Guardians of the Galaxy): Star-Lord, Gamora, Drax, Venom.
    for (const code of ["stld", "gam", "drax", "vnm"]) expect(cycleOf(code), code).toBe("cycle3");
    // Cycle 4: Nebula, War Machine, Vision (The Hood and Valkyrie are not in this pool yet).
    for (const code of ["nebu", "warm", "vision"]) expect(cycleOf(code), code).toBe("cycle4");
    // Cycle 6 (X-Men): Cyclops, Gambit (Phoenix/Mojo/Wolverine/Storm/Rogue are not in this pool yet).
    for (const code of ["cyclops", "gambit"]) expect(cycleOf(code), code).toBe("cycle6");
    // Cycle 8: Nightcrawler, Magneto (Iceman/Jubilee are not in this pool yet).
    for (const code of ["ncrawler", "magneto"]) expect(cycleOf(code), code).toBe("cycle8");
    // Cycle 9: Black Panther/Shuri, Winter Soldier, Falcon (Silk/Trickster Takeover are not in this pool yet).
    for (const code of ["bp", "winter", "falcon"]) expect(cycleOf(code), code).toBe("cycle9");
    // Ronan is a Print and Play promotional release, not part of any numbered cycle.
    expect(cycleOf("ron")).toBe("promo");
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

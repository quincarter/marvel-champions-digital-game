import { describe, expect, it } from "vitest";
import { CORE_CARDS, DATA_ONLY_CARDS, WAVE1_CARDS, WAVE2_CARDS, WAVE3_CARDS, WAVE4_CARDS } from "../data/index.js";
import { abilityId, starIconAbilityMismatch, validateMinionCard, validateSideSchemeCard } from "./index.js";
import type {
  AnyCard,
  AttachmentCard,
  EnvironmentCard,
  MinionCard,
  ObligationCard,
  SideSchemeCard,
  TreacheryCard,
} from "./index.js";

/** The card types a boost area can appear on (docs/phase7-wave2-data.md Part 8) — the ones `starIcon` was added to. */
type EncounterSideCard =
  | TreacheryCard
  | MinionCard
  | AttachmentCard
  | ObligationCard
  | EnvironmentCard
  | SideSchemeCard;

/**
 * docs/phase7-wave2-data.md Part 8: `starIcon?: boolean` (`encounter-cards.ts`, `schemes.ts`) records a printed
 * boost-area star (RRG 1.8 "Boost, Boost Icon") separately from the `boostIcons` pip count — a card's `starIcon`
 * must never be derived from what happens to be scripted (`packages/engine/src/defend-preview.ts`'s
 * module-private `hasBoostAbility` is exactly the derivation this field replaces for printed-data purposes).
 */

const ENCOUNTER_SIDE_TYPES = new Set(["treachery", "minion", "attachment", "obligation", "environment", "side_scheme"]);

/**
 * `WAVE1_CARDS`, `WAVE2_CARDS`, `WAVE3_CARDS` and `WAVE4_CARDS` each already include `CORE_CARDS` (`data/index.ts`),
 * so a plain concatenation of all six pools would count every Core card five times over. De-duplicate by id
 * instead of picking one "canonical" pool, since that is exactly the shape `data-only.test.ts`'s own "no
 * data-only id collides with Core/wave 1/wave 2/wave 3/wave 4" test already assumes elsewhere.
 */
function allEncounterSideCards(): readonly EncounterSideCard[] {
  const byId = new Map<string, AnyCard>();
  for (const c of [...CORE_CARDS, ...WAVE1_CARDS, ...WAVE2_CARDS, ...WAVE3_CARDS, ...WAVE4_CARDS, ...DATA_ONLY_CARDS]) {
    byId.set(c.id as string, c);
  }
  return [...byId.values()].filter((c): c is EncounterSideCard => ENCOUNTER_SIDE_TYPES.has(c.type));
}

describe("starIcon", () => {
  it("boostErrors rejects a non-boolean starIcon", () => {
    const minion: MinionCard = {
      id: "99999" as MinionCard["id"],
      type: "minion",
      name: "Fixture Minion",
      setCode: "core" as MinionCard["setCode"],
      cycleId: "cycle1" as MinionCard["cycleId"],
      collectorNumber: "999",
      quantityInSet: 1,
      unique: false,
      encounterSetIds: [],
      boostIcons: 0,
      // @ts-expect-error — deliberately wrong shape, exercising the runtime check
      starIcon: "yes",
      traits: [],
      keywords: [],
      text: { printed: "Boost: Nothing.", current: "Boost: Nothing." },
      abilities: [],
      atk: 1,
      sch: 1,
      hp: 1,
    };
    expect(validateMinionCard(minion).errors).toEqual(["minion starIcon must be a boolean when present"]);
  });

  it("starIcon absent, or explicitly true/false, is valid", () => {
    const base: Omit<MinionCard, "starIcon"> = {
      id: "99998" as MinionCard["id"],
      type: "minion",
      name: "Fixture Minion",
      setCode: "core" as MinionCard["setCode"],
      cycleId: "cycle1" as MinionCard["cycleId"],
      collectorNumber: "998",
      quantityInSet: 1,
      unique: false,
      encounterSetIds: [],
      boostIcons: 0,
      traits: [],
      keywords: [],
      text: { printed: "No text.", current: "No text." },
      abilities: [],
      atk: 1,
      sch: 1,
      hp: 1,
    };
    expect(validateMinionCard(base).errors).toEqual([]);
    expect(validateMinionCard({ ...base, starIcon: true }).errors).toEqual([]);
    expect(validateMinionCard({ ...base, starIcon: false }).errors).toEqual([]);
  });

  it("also validated on side schemes, the one encounter-side type outside EncounterCardCommon", () => {
    const sideScheme: SideSchemeCard = {
      id: "99997" as SideSchemeCard["id"],
      type: "side_scheme",
      name: "Fixture Side Scheme",
      setCode: "core" as SideSchemeCard["setCode"],
      cycleId: "cycle1" as SideSchemeCard["cycleId"],
      collectorNumber: "997",
      quantityInSet: 1,
      unique: false,
      encounterSetIds: [],
      startingThreat: { base: 1, perPlayer: 0 },
      icons: [],
      boostIcons: 0,
      // @ts-expect-error — deliberately wrong shape, exercising the runtime check
      starIcon: 1,
      traits: [],
      keywords: [],
      text: { printed: "No text.", current: "No text." },
      abilities: [],
    };
    expect(validateSideSchemeCard(sideScheme).errors).toEqual(["side scheme starIcon must be a boolean when present"]);
  });

  it("starIconAbilityMismatch flags a starIcon/.boost-ref disagreement in either direction", () => {
    expect(starIconAbilityMismatch({ starIcon: true, abilities: [] }, "fixture")).toBe(
      'fixture has starIcon: true but no ".boost" ability ref',
    );
    expect(starIconAbilityMismatch({ starIcon: false, abilities: [{ id: abilityId("01234.boost") }] }, "fixture")).toBe(
      'fixture has a ".boost" ability ref but starIcon is not true',
    );
    expect(
      starIconAbilityMismatch({ starIcon: true, abilities: [{ id: abilityId("01234.boost") }] }, "fixture"),
    ).toBeNull();
    expect(starIconAbilityMismatch({ abilities: [] }, "fixture")).toBeNull();
  });

  it('every encounter-side card\'s starIcon agrees with whether it carries a ".boost" ability ref (docs/phase7-wave2-data.md Part 8)', () => {
    const mismatches = allEncounterSideCards()
      .map((c) => starIconAbilityMismatch(c, c.id as string))
      .filter((m): m is string => m !== null);
    expect(mismatches).toEqual([]);
  });

  it("exactly 214 encounter-side cards across Core/wave 1/wave 2/data-only pools carry starIcon: true (docs/phase7-wave2-data.md Part 8's backfill, cross-checked 703/703 against MarvelCDB's boost_star; +30 from gmw, wave3 §5; +25 from mts, docs/phase7-wave4.md §1)", () => {
    const starred = allEncounterSideCards().filter((c) => (c as { starIcon?: boolean }).starIcon === true);
    expect(starred).toHaveLength(214);
  });

  it("Slipping Sanity (15023, scw) itself has no star icon — its text refers to stars on OTHER discarded cards, not its own boost area", () => {
    const slippingSanity = allEncounterSideCards().find((c) => c.id === ("15023" as AnyCard["id"]));
    expect(slippingSanity).toBeDefined();
    expect((slippingSanity as { starIcon?: boolean } | undefined)?.starIcon).toBeUndefined();
  });
});

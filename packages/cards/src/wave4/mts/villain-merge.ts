/**
 * TEMPORARY, content-pipeline workaround — delete this whole file (and its two import sites in `tower-defense.ts`
 * and `tower-defense-setup.ts`) once `@mc/content` emits Proxima Midnight and Corvus Glaive as combined multi-stage
 * `VillainCard`s the way Ebony Maw's own villain record already is (flagged to `card-data-pipeline`, 2026-09-25).
 *
 * **The gap this papers over:** `MTS_CARDS` emits Proxima Midnight and Corvus Glaive as three separate single-stage
 * `VillainCard`s apiece (21092/21093/21094, 21095/21096/21097), because `normalizeVillains` cannot combine
 * same-numbered stages into one card when two villains share the `tower_defense` `card_set_code` (docs/phase7-wave4.md
 * §1.6's own `villainCardCodes` disambiguation note — the same shape wave 2's Kang/Sinister Six precedent uses).
 * Unlike Kang, Tower Defense's own villains genuinely do advance stage-to-stage by ordinary defeat (MC21 p. 10,
 * "Villain Deck: Corvus Glaive (I), Corvus Glaive (II), Proxima Midnight (I), Proxima Midnight (II)"; RRG 1.8
 * `VillainSide`'s own docblock, "After a villain stage is defeated, the next stage of the villain deck enters play"),
 * which the landed engine primitive (`defeatVillainStage`, `villain-mutual-protection.test.ts`'s own synthetic
 * `stubVillain` with two `stages`) implements only *within one `VillainCard`'s own `sides[0].stages`* — it cannot
 * chain from one `CardId` to another.
 *
 * `mergeVillainStages` re-packages the three official per-stage records (hp/atk/sch/text/traits/keywords/abilities/
 * image, copied verbatim, not re-authored) into the single multi-stage `VillainCard` shape Ebony Maw's own villain
 * record already uses, purely as scenario-setup wiring in `@mc/cards` — no `@mc/content` edit, no new card text, no
 * engine change. Kept in its own file, isolated from every other Tower Defense ability script, so the eventual
 * deletion is a clean subtraction rather than surgery inside a larger file.
 */
import { cardId, type AnyCard, type CardId, type VillainCard, type VillainStage } from "@mc/content";
import { WAVE4_CARDS } from "../cards.js";

/** Combines several single-stage `VillainCard`s (same title, in stage order) into one multi-stage `VillainCard`,
 * keeping every stage's printed fields (hp/atk/sch/text/traits/keywords/abilities/image) verbatim. */
function mergeVillainStages(pool: readonly AnyCard[], stageCardIds: readonly CardId[]): VillainCard {
  const found = stageCardIds.map((id) => {
    const card = pool.find((c) => c.id === id);
    if (!card || card.type !== "villain") throw new Error(`${id} is not a villain card`);
    return card;
  });
  const [first] = found;
  if (!first) throw new Error("no stages to merge");
  const stages: VillainStage[] = found.map((card) => {
    const stage = card.sides[0].stages[0];
    if (!stage) throw new Error(`${card.id} has no stage`);
    return stage;
  });
  const [firstStage, ...restStages] = stages;
  if (!firstStage) throw new Error("no stages to merge");
  return { ...first, sides: [{ side: "A", name: first.name, stages: [firstStage, ...restStages] }] };
}

const PROXIMA_STAGE_IDS: readonly CardId[] = [cardId("21092"), cardId("21093"), cardId("21094")];
const CORVUS_STAGE_IDS: readonly CardId[] = [cardId("21095"), cardId("21096"), cardId("21097")];

/** Proxima Midnight I/II/III, merged into one three-stage `VillainCard` (id `21092`). */
export const PROXIMA_MIDNIGHT: VillainCard = mergeVillainStages(WAVE4_CARDS, PROXIMA_STAGE_IDS);
/** Corvus Glaive I/II/III, merged the same way (id `21095`). */
export const CORVUS_GLAIVE: VillainCard = mergeVillainStages(WAVE4_CARDS, CORVUS_STAGE_IDS);

const SPLIT_STAGE_IDS: ReadonlySet<CardId> = new Set([...PROXIMA_STAGE_IDS, ...CORVUS_STAGE_IDS]);

/** `WAVE4_CARDS` with Proxima Midnight/Corvus Glaive's six split per-stage records replaced by the two merged cards
 * above. Used as the Tower Defense scenario's own `GameSetupConfig.cards`. */
export const TOWER_DEFENSE_CARDS: readonly AnyCard[] = [
  ...WAVE4_CARDS.filter((card) => !SPLIT_STAGE_IDS.has(card.id)),
  PROXIMA_MIDNIGHT,
  CORVUS_GLAIVE,
];

/** Villain cards set aside at setup, found by name via the main scheme's own "Setup"/"When Revealed" abilities
 * (MC21 p. 10-11): the environment and the Focused Defense attachment are scenario furniture, not shuffled into
 * the encounter deck like an ordinary treachery/minion, even though both carry `encounterSetIds: [tower_defense]`. */
export const TOWER_DEFENSE_SET_ASIDE_IDS: readonly CardId[] = [cardId("21100a"), cardId("21101")];

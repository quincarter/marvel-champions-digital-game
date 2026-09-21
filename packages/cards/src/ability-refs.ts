/**
 * Every ability ref id a card carries, across every card shape.
 *
 * Single-sourced here because two things need the same answer and must never disagree: the per-wave
 * `coverage.test.ts` files, which assert that exactly the expected refs are unresolved, and
 * `tools/refs-report.test.ts`, which prints the list those tests are pinned to. When they were separate
 * copies the pinned lists drifted from reality (see `wave2/coverage.test.ts`'s own header comment).
 *
 * The shapes that are not just `card.abilities`:
 * - a hero identity carries them on its hero face, its alter-ego face and any additional hero forms;
 * - a villain carries them per side, per stage;
 * - a main scheme carries them per stage, on the A side and the stage itself;
 * - anything double-sided (a campaign upgrade pair, an encounter card's flip side) carries its other
 *   face's on `flipSide` rather than on the card (docs/phase7-wave2.md §1.5).
 */
import type { AnyCard } from "@mc/content";

export function abilityRefIds(card: AnyCard): string[] {
  switch (card.type) {
    case "hero_identity":
      return [
        ...card.hero.abilities,
        ...card.alterEgo.abilities,
        ...(card.additionalHeroForms ?? []).flatMap((face) => face.abilities),
      ].map((ref) => ref.id);
    case "villain":
      return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities.map((ref) => ref.id)));
    case "main_scheme":
      return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities].map((ref) => ref.id));
    default: {
      const own = "abilities" in card ? card.abilities.map((ref) => ref.id) : [];
      const flip = "flipSide" in card && card.flipSide ? card.flipSide.abilities.map((ref) => ref.id) : [];
      return [...own, ...flip];
    }
  }
}

/** Every ref id in a set of cards, de-duplicated, in first-seen order. */
export const allAbilityRefIds = (cards: readonly AnyCard[]): string[] => [
  ...new Set(cards.flatMap((card) => abilityRefIds(card))),
];

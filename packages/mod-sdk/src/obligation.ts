import {
  cards,
  changeForm,
  chooseOne,
  exhaust,
  exists,
  isHero,
  moveCards,
  option,
  query,
  self,
  whenRevealed,
  you,
  yourIdentity,
  type ChoiceOption,
  type EffectArg,
} from "@mc/cards";
import type { AbilityDefinition } from "@mc/engine";

/**
 * The shared shape of the base game's obligations (`packages/cards/src/core/obligations.ts`, which `@mc/cards` does not
 * export, so a pack cannot import it): "Give to the [alter-ego] player. You may flip to alter-ego form. Choose one:
 * • Exhaust [alter-ego] → remove [this] from the game. • [alternative]. Discard this obligation."
 *
 * `obligation.test.ts` checks the output is deep-equal to the base game's own `obligation(...)`, so the two cannot
 * drift apart silently. If `@mc/cards` ever exports its helper, this file goes away.
 */
const mayFlipToAlterEgo = chooseOne(
  option("Flip to alter-ego form", { when: isHero() }, changeForm(you, "alterEgo")),
  option("Stay in hero form", { when: isHero() }),
);

const exhaustAlterEgoToRemove = (alterEgo: string): ChoiceOption =>
  option(
    `Exhaust ${alterEgo} → remove this obligation from the game`,
    { when: exists(query("alterEgo", { controller: "you", exhausted: false })) },
    exhaust(yourIdentity),
    moveCards(cards(self), "removedFromGame"),
  );

export const packObligation = (
  alterEgo: string,
  alternative: { readonly label: string; readonly effects: readonly EffectArg[] },
): AbilityDefinition =>
  whenRevealed(
    mayFlipToAlterEgo,
    chooseOne(
      exhaustAlterEgoToRemove(alterEgo),
      option(alternative.label, ...alternative.effects, moveCards(cards(self), "discard")),
    ),
  );

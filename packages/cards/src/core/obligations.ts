import type { EffectArg, ChoiceOption } from "../dsl/index.js";
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
} from "../dsl/index.js";
import type { AbilityDefinition } from "@mc/engine";

/**
 * The Core obligations share one shape (current Core text):
 *   "Give to the [alter-ego] player. You may flip to alter-ego form. Choose:
 *    • Exhaust [alter-ego] → remove [this] from the game.
 *    • [alternative]. Discard this obligation."
 * The engine gives the obligation to its hero's player, who resolves it as
 * "you" (RRG "Obligation"). The flip is a card effect, so it doesn't use the
 * player's once-per-round form change (RRG "Form, Change Form").
 */

/**
 * "You may flip to alter-ego form." Only offered in hero form. Exported (additive, no behavior change) so a pack
 * whose obligation's own options don't match the shared `obligation()` shape — Struggle for Control (`vnm` 20023):
 * "Exhaust Flash Thompson **and take 2 damage** → discard this obligation", not the shared "→ remove this
 * obligation from the game" — can still reuse the flip choice instead of re-deriving it.
 */
export const mayFlipToAlterEgo = chooseOne(
  option("Flip to alter-ego form", { when: isHero() }, changeForm(you, "alterEgo")),
  option("Stay in hero form", { when: isHero() }),
);

/**
 * "Exhaust [alter-ego] → remove [this] from the game." The exhaust is a cost:
 * it's only choosable while your identity is a ready alter-ego (RRG "Cost").
 */
const exhaustAlterEgoToRemove = (alterEgo: string): ChoiceOption =>
  option(
    `Exhaust ${alterEgo} → remove this obligation from the game`,
    { when: exists(query("alterEgo", { controller: "you", exhausted: false })) },
    exhaust(yourIdentity),
    moveCards(cards(self), "removedFromGame"),
  );

/** "Discard this obligation." (to the encounter discard pile) */
export const discardThisObligation = moveCards(cards(self), "discard");

export const obligation = (
  alterEgo: string,
  alternative: { readonly label: string; readonly effects: readonly EffectArg[] },
): AbilityDefinition =>
  whenRevealed(
    mayFlipToAlterEgo,
    chooseOne(
      exhaustAlterEgoToRemove(alterEgo),
      option(alternative.label, ...alternative.effects, discardThisObligation),
    ),
  );

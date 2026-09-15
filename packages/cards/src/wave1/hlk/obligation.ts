import { cards, changeForm, defineAbilities, discardFromHand, exhaust, ifThen, isAlterEgo, moveCards, self, whenRevealed, yourIdentity } from "../../dsl/index.js";

/**
 * Inner Demons (10025), Hulk's obligation. Unlike Core's shared "give to the alter-ego player, you may flip,
 * choose: exhaust to remove / an alternative, discard this obligation" shape (`../../core/obligations.js`'s
 * `obligation()`), this one is a *mandatory* flip with no "remove from game" option, and both branches discard the
 * obligation — genuinely different, so it's scripted by hand rather than forced through the shared helper
 * (docs/phase7-wave1-scripting.md §1).
 */
export const HLK_OBLIGATION = defineAbilities({
  // Give to the Bruce Banner player (engine default: an obligation resolves as "you" for its hero's own player).
  // Change form (flip your identity) — mandatory, unlike Core's "you may flip": `changeForm(you)` with no `to`
  // flips to whichever form isn't current.
  // • If you are Bruce Banner, discard 2 cards from your hand. Discard this obligation.
  // • If you are Hulk, exhaust your hero. Discard this obligation.
  "10025.obligation": whenRevealed(
    changeForm(),
    ifThen(
      isAlterEgo(),
      [discardFromHand(2), moveCards(cards(self), "discard")],
      [exhaust(yourIdentity), moveCards(cards(self), "discard")],
    ),
  ),
});

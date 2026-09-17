import type { AbilityRegistry } from "@mc/engine";
import { discardThisObligation } from "../../core/obligations.js";
import { afterNextCardPlayed, cards, changeForm, chooseOne, exhaust, exists, increaseNextCardCost, isHero, moveCards, option, query, self, whenRevealed, you, yourIdentity } from "../../dsl/index.js";

/**
 * Physical Toll (09027), Doctor Strange's obligation. Printed text: "Give to the Stephen Strange player. You may
 * flip to alter-ego form. Choose: • Exhaust Stephen Strange → remove Physical Toll from the game. • The next event
 * you play costs 3 additional resources. Discard this obligation after you play an event."
 *
 * The "exhaust to remove" branch is the ordinary shape every other wave 1 obligation uses (`../../core/
 * obligations.js`'s `obligation()` helper), but the alternative branch isn't: choosing it does **not** discard the
 * obligation immediately the way Core's shared shape does — it stays in play, still increasing the cost of every
 * event this player would play, until the *next* event they actually play, at which point it discards itself. That
 * needed a lasting cost change with no phase/round bound (RRG 1.8 "Lasting Effects", p. 26 — a round bound would
 * silently stop applying, and never discard the obligation, if the player simply doesn't play an event that
 * round). Landed with the wave B primitives batch (docs/phase7-wave1-scripting.md §6) as `LastingDuration
 * .untilCardPlayed` (`increaseNextCardCost(..., "untilPlayed", ...)`) and `afterNextCardPlayed(...)`, its
 * discard-on-consumption sibling — both are lasting effects registered once, when this single `whenRevealed`
 * ability resolves, not separate triggered abilities, so the card's one printed ability ref is enough; the two-ref
 * split this doc comment used to propose turned out to be unnecessary.
 */
export const DRS_OBLIGATION: AbilityRegistry = {
  "09027.obligation": whenRevealed(
    chooseOne(option("Flip to alter-ego form", { when: isHero() }, changeForm(you, "alterEgo")), option("Stay in hero form", { when: isHero() })),
    chooseOne(
      option(
        "Exhaust Stephen Strange → remove this obligation from the game",
        { when: exists(query("alterEgo", { controller: "you", exhausted: false })) },
        exhaust(yourIdentity),
        moveCards(cards(self), "removedFromGame"),
      ),
      option(
        "The next event you play costs 3 additional resources. Discard this obligation after you play an event.",
        increaseNextCardCost(you, 3, "untilPlayed", query("event")),
        afterNextCardPlayed(you, query("event"), discardThisObligation),
      ),
    ),
  ),
};

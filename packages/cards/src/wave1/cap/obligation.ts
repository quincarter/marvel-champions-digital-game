import { discardFromHand, handCountOf, scaled } from "../../dsl/index.js";
import { defineAbilities } from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

/**
 * Man Out of Time (03026), Captain America's obligation. Reuses Core's `obligation()` helper (`../../core/
 * obligations.js`) — it has no Core-content dependency of its own, only the DSL, so wave 1 shares it rather than
 * duplicating the "give to the alter-ego player / you may flip / choose" shape.
 */
export const CAP_OBLIGATION = defineAbilities({
  // • Exhaust Steve Rogers → remove Man Out of Time from the game. (Shared `obligation()` shape.)
  // • Discard half of the cards in your hand, rounded down. Discard this obligation.
  "03026.obligation": obligation("Steve Rogers", {
    label: "Discard half of the cards in your hand, rounded down",
    effects: [discardFromHand(scaled(handCountOf(), { divide: { by: 2, round: "down" } }))],
  }),
});

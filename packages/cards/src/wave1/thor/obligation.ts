import { cards, defineAbilities, moveCards, named, query, stun, you, yourIdentity, zone } from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";
import { cardName } from "../names.js";

const MJOLNIR_NAME = cardName("06009");

/**
 * Odin's Anger (06026), Thor's obligation. Reuses Core's `obligation()` helper (`../../core/obligations.js`) —
 * every wave 1 obligation follows Core's "give to the alter-ego player / you may flip / choose: exhaust to remove /
 * an alternative, discard this obligation" shape (docs/phase7-wave1.md §2.1).
 *
 * "Discard Mjolnir from your hand or from play": Mjolnir is unique (deckLimit 1) so at most one instance exists.
 * `named(...)` only resolves a card in play; the hand-zone search only resolves a card in hand — since Mjolnir can
 * be in at most one of those two places at a time, running both unconditionally is exact, not an approximation:
 * whichever zone doesn't hold it selects zero cards and no-ops (and if Mjolnir is in the deck or already discarded,
 * both no-op, which is correct — there is nothing to discard).
 */
export const THOR_OBLIGATION = defineAbilities({
  "06026.obligation": obligation("Odinson", {
    label: "Discard Mjolnir from your hand or from play. You are stunned.",
    effects: [
      moveCards(cards(named(MJOLNIR_NAME)), "discard"),
      moveCards(zone("hand", you, { filter: query("upgrade", { name: MJOLNIR_NAME }) }), "discard"),
      stun(yourIdentity),
    ],
  }),
});

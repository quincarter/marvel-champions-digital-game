import type { AbilityRegistry } from "@mc/engine";
import {
  andThen,
  bindTargets,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  eventPlayer,
  eventTarget,
  fromAnyAspect,
  ifThen,
  interrupt,
  moveCards,
  on,
  query,
  response,
  self,
  shuffleDeck,
  tuckCards,
  tuckedCount,
  tuckedUnder,
  tuckedUnderRef,
  valueAtLeast,
  you,
  zone,
} from "../../../dsl/index.js";

/** "An aspect or basic event" (RRG 1.8 "Classifications", p. 12): the five aspects (Pool too) or basic. */
export const ASPECT_OR_BASIC_EVENT = query("event", {
  anyAspect: [...fromAnyAspect, "basic"],
});

/**
 * Wave 11 scripting module `fne/echo/identity` (docs/phase7-wave11.md section 3.9, 8.4 line 6).
 *
 * Cards (1):
 * - 60037a Echo (hero_identity)
 *
 * The identity card's other face is 60037b Maya Lopez (alter ego).
 *
 * **60037a.watch-and-learn** (hero face): "Response: After a player plays an aspect or basic event, tuck that event
 * under here from that player's discard pile. Then, if there are more than 3 tucked cards here, discard all but 3 of
 * those cards." Any player's play, optional. The event is bound when played and tucked only if it sits in the discard
 * pile of the player who played it (`zone("discard", eventPlayer)`): a borrowed event (Study the Tape) goes to its
 * owner's pile, not the player's, so nothing is tucked (ruling August 13, 2026 (1) answer 2). A stunned Echo's attack
 * event was still played, so the Response is offered (August 13, 2026 (1) answer 1). `notPlayedVia` Photographic
 * Reflexes: "You cannot trigger Echo's 'Watch and Learn' ability for that event." The discard is "Then" text (RRG 1.8,
 * p. 44), so it needs the tuck to have resolved; Echo's controller keeps the 3 they choose and the rest go to their
 * owners' discard piles (RRG 1.8 "Tuck", p. 45).
 *
 * **60037b.practice-makes-perfect** (alter-ego face): "Interrupt: When you change to hero form, search your deck for
 * an aspect or basic event and add it to your hand. (Shuffle.)" Heard before the identity turns (`formChanging`).
 * Compulsory when such an event is in the deck; the deck is shuffled afterwards (RRG 1.8 "Search", p. 39).
 */
export const FNE_ECHO_IDENTITY: AbilityRegistry = defineAbilities({
  "60037a.watch-and-learn": response(
    { ...on.cardPlayed(ASPECT_OR_BASIC_EVENT), notPlayedVia: query("event", { name: "Photographic Reflexes" }) },
    bindTargets("played", eventTarget),
    tuckCards(zone("discard", eventPlayer, { filter: { inSlot: "played" } }), self),
    andThen(
      ifThen(valueAtLeast(tuckedCount(), 4), [
        chooseCards("kept", tuckedUnder(self), { min: 3, max: 3 }),
        moveCards(cards(tuckedUnderRef(self), { excluding: chosen("kept") }), "discard"),
      ]),
    ),
  ),
  "60037b.practice-makes-perfect": interrupt(
    on.youWouldChangeIdentityForm("hero"),
    chooseCards("found", zone("deck", you, { filter: ASPECT_OR_BASIC_EVENT }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_ECHO_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};

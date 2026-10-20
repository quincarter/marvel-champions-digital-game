import type { AbilityRegistry } from "@mc/engine";
import { ASPECT_OR_BASIC_EVENT } from "./identity.js";
import {
  action,
  cards,
  chooseCards,
  choosePlayer,
  chosen,
  chosenPlayer,
  constant,
  defineAbilities,
  identityOf,
  inHand,
  playableTucked,
  query,
  takeIntoHand,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `fne/echo/events` (docs/phase7-wave11.md section 3.9, 8.4 line 7).
 *
 * Cards (4):
 * - 60040a Photographic Reflexes (event)
 * - 60040b Photographic Reflexes (event)
 * - 60040c Photographic Reflexes (event)
 * - 60041 Study the Tape (event)
 *
 * **60040a/b/c.photographic-reflexes-constant** (the three records share one script): "[star] If you are in hero form,
 * you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your hand.
 * Reduce the cost to play that event by 2. You cannot trigger Echo's 'Watch and Learn' ability for that event." A
 * constant on the card while it is in the hand: a permission to play any event tucked under your identity (hero form
 * only), the discard being paid with the play, for 2 less. The played event follows the usual rules for the play (an
 * Action in its player's turn, a Response when its condition occurs; MC60 FAQ p. 26) and goes to its owner's discard
 * pile. The star cost marks this text, and the card is never played itself (RRG 1.8 "Star Icon", p. 40, "Event",
 * p. 18). The Watch and Learn exclusion is on that ability's own pattern (`notPlayedVia`, identity module).
 *
 * **60041.study-the-tape-action** (Action): "Search any player's discard pile for 1 aspect event, 1 basic event, or 1
 * copy of Photographic Reflexes and add that card to your hand." The player is chosen first; the card goes to Echo's
 * player's hand and stays its owner's (`keepOwner`): played, or discarded from that hand, it goes to its owner's
 * discard pile, so Watch and Learn cannot tuck it (August 13, 2026 (1) answer 2). Compulsory when a card is found.
 */
export const FNE_ECHO_EVENTS: AbilityRegistry = defineAbilities({
  "60040a.photographic-reflexes-constant": reflexes(),
  "60040b.photographic-reflexes-constant": reflexes(),
  "60040c.photographic-reflexes-constant": reflexes(),
  "60041.study-the-tape-action": action(
    choosePlayer("pile"),
    chooseCards(
      "found",
      zone("discard", chosenPlayer("pile"), {
        filter: {
          anyOf: [ASPECT_OR_BASIC_EVENT, query("event", { name: "Photographic Reflexes" })],
        },
      }),
      { min: 1, max: 1 },
    ),
    takeIntoHand(cards(chosen("found")), you, { keepOwner: true }),
  ),
});

function reflexes() {
  return inHand(
    constant(
      playableTucked({
        under: identityOf(you),
        cards: { categories: ["event"] },
        costReduction: 2,
        form: "hero",
        discardSelfFromHand: true,
        // "Reduce the cost to play that event": Make the Call's chosen ally included (August 26, 2026 - Ruling 1).
        reducesAbilityCost: true,
      }),
    ),
  );
}

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. None.
 */
export const FNE_ECHO_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};

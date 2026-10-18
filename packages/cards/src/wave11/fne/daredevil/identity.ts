import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  constant,
  defineAbilities,
  forcedInterrupt,
  on,
  playFromSeparateDeck,
  query,
  replaceLeaveDestination,
} from "../../../dsl/index.js";

const SENSE = trait("SENSE");
const SENSE_DECK = "Sense";

/** "When a Sense upgrade would leave play, place it on the bottom of the Sense deck instead." (both faces) */
const senseUpgradeLeaves = () =>
  forcedInterrupt(
    on.leavesPlay(query("upgrade", { trait: SENSE })),
    replaceLeaveDestination({ separateDeck: SENSE_DECK, at: "bottom" }),
  );

/**
 * Wave 11 scripting module `fne/daredevil/identity` (docs/phase7-wave11.md §3.1 to §3.3, §8.4 line 1).
 *
 * Cards (1):
 * - 60001a Daredevil (hero_identity)
 *
 * The identity card's other face is 60001b Matt Murdock (alter ego).
 *
 * **60001a.superhuman-senses** (hero face): "Action: Play the top card of the Sense deck as if it were in your hand
 * (paying its cost)." A play (RRG 1.8 "Play, Put Into Play", p. 32): cost, form, max and unique apply, and an upgrade's
 * host is asked when it has several. Required, so the action is not offered while the top card cannot be played and
 * paid for. The next card becomes the top one; the deck is in fixed order (`fixedOrder`) and never shuffled.
 *
 * **60001a.daredevil-forced-interrupt** and **60001b.matt-murdock-forced-interrupt** (the printed Forced Interrupt on
 * both faces, MC60 p. 26): "When a Sense upgrade would leave play, place it on the bottom of the Sense deck instead."
 * A replacement ("would ... instead", RRG 1.8 p. 37 and p. 48): the upgrade is not discarded, so nothing hears a
 * discard
 * and no further interrupt answers that leaving; a cost that discards it is still paid; an upgrade leaving with its
 * host goes too. "A Sense upgrade" is an upgrade with the Sense trait (every Sense card is one, 60002 to 60006).
 *
 * **60001b.matt-murdock-constant**: "Matt Murdock begins the game with a Sense deck." Setup builds the deck from the
 * identity's `separateDecks` (data), so the ref is an empty constant, as for `58001b.simon-williams-constant`.
 */
export const FNE_DAREDEVIL_IDENTITY: AbilityRegistry = defineAbilities({
  "60001a.superhuman-senses": action(playFromSeparateDeck(SENSE_DECK, "top", { asIfInHand: true })),
  "60001a.daredevil-forced-interrupt": senseUpgradeLeaves(),
  "60001b.matt-murdock-constant": constant(),
  "60001b.matt-murdock-forced-interrupt": senseUpgradeLeaves(),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_DAREDEVIL_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};

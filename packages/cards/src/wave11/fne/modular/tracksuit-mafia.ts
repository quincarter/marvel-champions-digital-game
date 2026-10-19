import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  actingCharacter,
  addAccelerationToken,
  after,
  cards,
  chooseCards,
  chosen,
  confuse,
  defineAbilities,
  discardEncounterUntil,
  eventPlayer,
  eventSource,
  exists,
  forcedResponse,
  giveBoostCard,
  ifThen,
  named,
  on,
  query,
  refMatches,
  revealCard,
  self,
  setDefeatDestination,
  stun,
  tuckCards,
  tuckedUnder,
  whenDefeated,
  whenRevealed,
} from "../../../dsl/index.js";

const TRACKSUIT_MINION = query("minion", { trait: trait("TRACKSUIT") });
const MAFIA = "Tracksuit Mafia";
/** "The Tracksuit Mafia side scheme" in play. */
const MAFIA_IN_PLAY = query("sideScheme", { name: MAFIA });
// RRG 1.8 "You, Your" p. 49: an event, a spent resource or an upgrade on the identity is an extension of the identity, so the identity defeated him.
/** "The character that defeated" the Mafioso: the defeating card, or the character it acts for. A support or a player side scheme is nobody. */
const DEFEATER = actingCharacter(eventSource);
/** "Tuck this card under the Tracksuit Mafia side scheme." */
const tuckUnderMafia = tuckCards(cards(self), named(MAFIA));

/**
 * The Tracksuit Mafia modular set (docs/phase7-wave11-scenarios.md section S6). Teamwork (Tracksuit), Retaliate,
 * Vulnerable and Villainous are data.
 *
 * **60200 Ivan Banionis**: When Revealed: 1 acceleration token on him (a counter on a card that is not a main scheme,
 * as `addAccelerationToken(self)` places it). Forced Response: after he schemes, another.
 * **60201 The Clown**: Forced Response: after he schemes, give him 1 facedown boost card.
 * **60202 Tracksuit Mafioso**, **60203 Tracksuit Bro**: When Defeated: tuck this card under the Tracksuit Mafia side
 * scheme. "Otherwise" (no such side scheme in play, RRG 1.8 "'Otherwise'", p. 31): the Mafioso stuns and confuses the
 * character that defeated him (`actingCharacter(eventSource)`: an ally or identity that defeated him, or the identity for the
 * event, resource or upgrade that did; a support or player side scheme is nobody), the Bro is shuffled into the encounter deck instead of its discard pile. The
 * tuck replaces the discard (RRG 1.8 "Tuck", p. 45; "When Defeated Abilities", p. 48).
 * **60204 Tracksuit Mafia**: When Revealed: discard from the encounter deck until a Tracksuit minion is discarded and
 * tuck it here. Forced Response: after a player reveals a Tracksuit minion from the encounter deck, that player
 * reveals 1 minion tucked here (that player chooses among them).
 *
 * Cards (5):
 * - 60200 Ivan Banionis (minion)
 * - 60201 The Clown (minion)
 * - 60202 Tracksuit Mafioso (minion)
 * - 60203 Tracksuit Bro (minion)
 * - 60204 Tracksuit Mafia (side_scheme)
 */
export const FNE_MODULAR_TRACKSUIT_MAFIA: AbilityRegistry = defineAbilities({
  "60200.when-revealed": whenRevealed(addAccelerationToken(self)),
  "60200.ivan-banionis-forced-response": forcedResponse(after.enemySchemes("self"), addAccelerationToken(self)),

  "60201.the-clown-forced-response": forcedResponse(after.enemySchemes("self"), giveBoostCard(self)),

  "60202.when-defeated": whenDefeated(
    ifThen(
      exists(MAFIA_IN_PLAY),
      tuckUnderMafia,
      ifThen(refMatches(DEFEATER, query("character")), [stun(DEFEATER), confuse(DEFEATER)]),
    ),
  ),

  "60203.when-defeated": whenDefeated(
    ifThen(exists(MAFIA_IN_PLAY), tuckUnderMafia, setDefeatDestination("encounterDeckShuffle")),
  ),

  "60204.when-revealed": whenRevealed(
    discardEncounterUntil(TRACKSUIT_MINION, "found"),
    tuckCards(cards(chosen("found")), self),
  ),
  "60204.tracksuit-mafia-forced-response": forcedResponse(
    on.cardRevealedFromEncounterDeck(TRACKSUIT_MINION),
    chooseCards("pick", tuckedUnder(self, { filter: query("minion") }), { chooser: eventPlayer, min: 1, max: 1 }),
    revealCard(chosen("pick"), eventPlayer),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_TRACKSUIT_MAFIA_SKIPPED: Readonly<Record<string, string>> = {};

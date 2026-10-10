import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  after,
  attachCard,
  boost,
  confuse,
  countOf,
  dealDamage,
  defineAbilities,
  discard,
  encounterCards,
  eventAmount,
  eventSource,
  find,
  forcedInterrupt,
  forcedResponse,
  ifThen,
  isConfused,
  named,
  not,
  oneCopyOf,
  placeThreat,
  instead,
  query,
  revealCard,
  selectCards,
  self,
  shuffleEncounterDeck,
  surge,
  theMainScheme,
  varAtLeast,
  when,
  whenRevealed,
  chosen,
  enemyActivates,
  yourIdentity,
  you,
} from "../../dsl/index.js";

const BLACK_WIDOW = "Black Widow";
const PREPARATION = trait("PREPARATION");

/** "After Black Widow schemes against you": a scheme is always against the player it is resolved against. */
const SCHEMES_AGAINST_YOU: EventPattern = { ...after.enemySchemes("self"), playerIs: "controller" };

/**
 * Modular encounter set `pale_little_spider` (Agents of S.H.I.E.L.D., a Thunderbolt set; docs/phase7-wave9.md section
 * 3.35, 3.25). Retaliate 1, Villainous and Victory 1 are data, and so is Handspring's "Attach to Black Widow.
 * Otherwise, attach to the villain."
 *
 * **Black Widow (50148)**: Forced Response after she schemes against you: search the encounter deck and discard pile
 * for a copy of Handspring and attach it to her (shuffle); when none is there, you are confused.
 *
 * **Handspring (50149)**: Forced Interrupt: damage from an attack that the attached enemy would take is dealt to the
 * attacking character instead (the attack's damage, replaced; the attacker is not "attacked"), then it is discarded.
 * Retaliate and any other ability of the attack still resolve.
 *
 * **Pride of the Red Room (50150)**: When Revealed: 1 additional threat for each Preparation card in play (any
 * controller, attached to an enemy included).
 *
 * **Pale Little Spider (50151)**: reveals Black Widow (found, or engaged with the revealing player when in play), who
 * activates against the revealing player; surge when nobody activated. Boost: confuse you; when already confused, 1
 * threat on the main scheme.
 *
 * Cards (4):
 * - 50148 Black Widow (minion)
 * - 50149 Handspring (attachment)
 * - 50150 Pride of the Red Room (side_scheme)
 * - 50151 Pale Little Spider (treachery)
 */
export const PALE_LITTLE_SPIDER: AbilityRegistry = defineAbilities({
  "50148.black-widow-forced-response": forcedResponse(
    SCHEMES_AGAINST_YOU,
    selectCards("handspring", oneCopyOf(encounterCards(["deck", "discard"], { name: "Handspring" }))),
    ifThen(
      varAtLeast("handspring.count"),
      [attachCard(chosen("handspring"), self), shuffleEncounterDeck()],
      [shuffleEncounterDeck(), confuse(yourIdentity)],
    ),
  ),

  "50149.handspring-forced-interrupt": forcedInterrupt(
    when.damage("host", { fromAttack: true }),
    instead(dealDamage(eventAmount, eventSource), discard(self)),
  ),

  "50150.when-revealed": whenRevealed(placeThreat(countOf(query([], { trait: PREPARATION })), self)),

  "50151.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: BLACK_WIDOW })), you),
    enemyActivates(named(BLACK_WIDOW), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "50151.boost": boost(ifThen(isConfused(yourIdentity), placeThreat(1, theMainScheme)), confuse(yourIdentity)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const PALE_LITTLE_SPIDER_SKIPPED: Readonly<Record<string, string>> = {};

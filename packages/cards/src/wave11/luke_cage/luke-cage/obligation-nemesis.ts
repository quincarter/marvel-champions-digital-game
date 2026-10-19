import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoResponse,
  boost,
  cards,
  chosen,
  confuse,
  constant,
  coveredByEngineRule,
  dealAsEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardEncounterUntil,
  enemyAttack,
  eventPlayer,
  eventTarget,
  forcedInterrupt,
  forcedResponse,
  heroAction,
  identityOf,
  ifThen,
  moveCards,
  on,
  oncePerPhase,
  playersWhere,
  query,
  refMatches,
  removeStatus,
  repeatTimes,
  revealCard,
  rule,
  self,
  spend,
  stun,
  takeDamage,
  thatPlayer,
  whenDefeated,
  yourIdentity,
  YOUR_IDENTITY,
  hasPrintedBoostAbility,
} from "../../../dsl/index.js";

const SERPENT_SOCIETY = trait("SERPENT SOCIETY");
/** "The Luke Cage player": the player whose identity is Luke Cage in either face (both are titled Luke Cage). */
const LUKE_CAGE_PLAYER = playersWhere(refMatches(identityOf(thatPlayer), query("identity", { name: "Luke Cage" })));
/** "After you recover": the basic recovery has resolved (`basicPowerUsed` narrowed to the recover power). */
const YOU_RECOVER = { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } } as const;

/**
 * Wave 11 scripting module `luke_cage/luke-cage/obligation-nemesis` (docs/phase7-wave11-hero-packs.md H8.4, H3.2,
 * H3.3, H3.21).
 *
 * Cards (6):
 * - 62028 Internal Injury (obligation)
 * - 62029 Cottonmouth (minion)
 * - 62030 Venomous Whispers (side_scheme)
 * - 62031 Augmented Jaws (attachment)
 * - 62032 Asp (minion)
 * - 62033 Sidewinder (minion)
 *
 * **62028**: "Give to the Luke Cage player" is engine data; the card stays in play. Forced Response: after the player
 * phase ends the Luke Cage player takes 3 unpreventable damage (ignoring tough, H3.3; Q103 A). Alter-Ego Response
 * (optional): after a basic recovery the card is removed from the game, not discarded.
 *
 * **62029**: Forced Response: after Cottonmouth attacks he attacks the character that attack ended against (the
 * defender, else the target) twice more, each a full attack (RRG 1.8 "Activation", p. 6: attacks made by an
 * ability are activations; as a minion without Villainous he is dealt no boost card, p. 8). If that character has
 * left play (an ally the first attack defeated) there is nothing to attack and no extra attack is made. The limit keeps
 * these from chaining. Boost: dealt to the Luke Cage
 * player, whoever is attacked.
 *
 * **62030**: no Serpent Society minion can be attacked (the rule names no attacker). When Defeated: the defeating
 * player discards from the encounter deck until a Serpent Society minion is discarded and reveals it. Boost: you are
 * confused.
 *
 * **62031**: Forced Interrupt: when the attached enemy attacks, every tough status card is discarded from the
 * character attacked, several conditions of one occurrence for Luke Cage's Forced Response and Power Man (engine reading: spec H3.2,
 * wave 6 Q5). Attach to
 * Cottonmouth, otherwise the villain, is data. Hero Action: spend two [mental] resources to discard it.
 *
 * **62032**: Forced Response: after Asp schemes against you, you are stunned. Boost: you are stunned.
 *
 * **62033**: Quickstrike is data. Forced Interrupt: when Sidewinder is attacked, discard the top card of the encounter
 * deck; if it prints a Boost ability (the star, `hasPrintedBoostAbility`, RRG 1.8 p. 11), Sidewinder is dealt from play
 * to the attacking player, facedown. He leaves play, so the attack has no target and deals nothing.
 */
export const LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "62028.obligation": coveredByEngineRule(),
  "62028.internal-injury-forced-response": forcedResponse(
    on.phaseEnding("player"),
    takeDamage(3, undefined, { unpreventable: true }),
  ),
  "62028.internal-injury-response": alterEgoResponse(YOU_RECOVER, moveCards(cards(self), "removedFromGame")),

  "62029.cottonmouth-forced-response": forcedResponse(
    after.enemyAttacks("self"),
    { limit: oncePerPhase },
    repeatTimes(2, enemyAttack(self, { targetCharacter: eventTarget })),
  ),
  "62029.boost": boost(dealAsEncounterCard(self, LUKE_CAGE_PLAYER)),

  "62030.venomous-whispers-constant": constant(
    rule({ kind: "cannotAttack", target: query("minion", { trait: SERPENT_SOCIETY }) }),
  ),
  "62030.when-defeated": whenDefeated(
    discardEncounterUntil(query("minion", { trait: SERPENT_SOCIETY }), "found"),
    revealCard(chosen("found"), defeatingPlayer),
  ),
  "62030.boost": boost(confuse(yourIdentity)),

  "62031.augmented-jaws-forced-interrupt": forcedInterrupt(
    on.enemyAttacks({ hostOfSelf: true }),
    removeStatus(eventTarget, "tough"),
  ),
  "62031.augmented-jaws-action": heroAction({ cost: spend({ mental: 2 }) }, discard(self)),

  "62032.asp-forced-response": forcedResponse(after.enemySchemes("self"), stun(yourIdentity)),
  "62032.boost": boost(stun(yourIdentity)),

  "62033.sidewinder-forced-interrupt": forcedInterrupt(
    { on: "attack", selfIs: "target" },
    discardEncounterCards(1, { bind: "top" }),
    ifThen(
      refMatches(chosen("top"), { ...hasPrintedBoostAbility }, { anywhere: true }),
      dealAsEncounterCard(self, eventPlayer),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};

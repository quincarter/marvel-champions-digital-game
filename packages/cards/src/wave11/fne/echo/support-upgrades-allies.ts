import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  after,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  chooseCards,
  chosen,
  cards,
  damageAnEnemy,
  defineAbilities,
  draw,
  eventTarget,
  exhaustThis,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  isAlterEgo,
  moveCards,
  printedCostOf,
  query,
  reduceNextCardCost,
  refMatches,
  removeThreatFromAScheme,
  resource,
  response,
  superlative,
  tuckedUnder,
  tuckedUnderRef,
  yourIdentity,
  you,
  zone,
} from "../../../dsl/index.js";

const ATTACK = trait("ATTACK");
const DEFENSE = trait("DEFENSE");
const THWART = trait("THWART");

/** "After you play an event" for Echo's Hero Responses: an event of any kind, played at any time. */
const AFTER_YOU_PLAY_AN_EVENT = after.youPlayedCard(query("event"));
const ASPECT_OR_BASIC_EVENT = query("event", { anyOf: [{ classification: "aspect" }, { classification: "basic" }] });

/**
 * Wave 11 scripting module `fne/echo/support-upgrades-allies` (docs/phase7-wave11.md §8.4).
 *
 * Cards (7):
 * - 60039 Daredevil (ally)
 * - 60042 The Rez (support)
 * - 60043 American Sign Language (upgrade)
 * - 60044 Choreography (upgrade)
 * - 60045 Echo's Katana (upgrade)
 * - 60046 Improvisation (upgrade)
 * - 60047 Muscle Memory (upgrade)
 *
 * **60039.daredevil-response**: "After Daredevil uses a basic power, reduce the cost of the next event you play this
 * round by 1." Any basic power of the ally (attack or thwart); the reduction is the controller's, spent by the next
 * event that player plays this round, and gone at the end of the round. That this ally matches the Daredevil identity
 * (deck and in-play uniqueness) is deckbuilding data, docs/phase7-wave11.md §3.14.
 *
 * **60042.the-rez-action**: "Alter-Ego Action: Exhaust The Rez -> heal X damage from Maya Lopez, where X is the
 * highest cost among cards tucked under her." Tucked cards are out of play, so their cost is the printed cost; with
 * nothing tucked X is 0. Maya is the identity card, whichever face is up (tucked cards sit under the identity).
 *
 * **60043.american-sign-language-resource**: "Hero Resource: Exhaust this card -> generate a [wild] resource for an
 * event being played by any player." Usable by any player paying for an event (the Milano's shape, `forAnyPlayer`),
 * for an event only.
 *
 * **60044.choreography-action**: "Action: Exhaust this card -> shuffle 1 aspect or basic event from your discard pile
 * into your deck. If you are in alter-ego form, draw 1 card." Two sentences, no "then": the draw does not wait on there
 * being an event to shuffle. An identity-specific event is not offered.
 *
 * **60045.echos-katana-response**: "Hero Response (attack): After you play an event, exhaust Echo's Katana -> deal
 * damage to an enemy equal to that event's printed cost. This attack gains piercing." An attack by your hero whose
 * damage is the played event's printed cost (not ATK), so guard and retaliate apply. The Restricted keyword is data.
 *
 * **60046.improvisation-response**: "Hero Response: After you play an event, if it has the following traits: Attack ->
 * heal 1 damage from Echo. Defense -> remove 1 threat from a scheme. Thwart -> deal 1 damage to an enemy." Each trait
 * is its own line, so an event with two of them resolves both. The threat removal is not a thwart and the damage is not
 * an attack.
 *
 * **60047.muscle-memory-action**: "Hero Action: Exhaust this card -> add an event tucked under Echo to your hand."
 */
export const FNE_ECHO_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "60039.daredevil-response": response(
    after.basicPowerUsed("self"),
    reduceNextCardCost(you, 1, "round", query("event")),
  ),

  "60042.the-rez-action": alterEgoAction(
    { cost: exhaustThis },
    heal(
      printedCostOf(
        superlative("highest", tuckedUnderRef(yourIdentity), printedCostOf({ kind: "slot", slot: "candidate" }), {
          ties: "first",
        }),
      ),
      yourIdentity,
    ),
  ),

  "60043.american-sign-language-resource": resource(1, {
    form: "hero",
    cost: exhaustThis,
    forAnyPlayer: true,
    generatesFor: query("event"),
  }),

  "60044.choreography-action": action(
    { cost: exhaustThis },
    chooseCards("shuffled", zone("discard", you, { filter: ASPECT_OR_BASIC_EVENT }), { min: 1, max: 1 }),
    moveCards(cards(chosen("shuffled")), "deckShuffle"),
    ifThen(isAlterEgo(), draw(1)),
  ),

  "60045.echos-katana-response": heroResponse(
    AFTER_YOU_PLAY_AN_EVENT,
    { cost: exhaustThis, label: "attack" },
    anAttackableEnemy(),
    attack(printedCostOf(eventTarget), chosen("enemy"), { keywords: ["piercing"] }),
  ),

  "60046.improvisation-response": heroResponse(
    AFTER_YOU_PLAY_AN_EVENT,
    ifThen(refMatches(eventTarget, query("event", { trait: ATTACK }), { anywhere: true }), heal(1, yourIdentity)),
    ifThen(refMatches(eventTarget, query("event", { trait: DEFENSE }), { anywhere: true }), removeThreatFromAScheme(1)),
    ifThen(refMatches(eventTarget, query("event", { trait: THWART }), { anywhere: true }), damageAnEnemy(1)),
  ),

  "60047.muscle-memory-action": heroAction(
    { cost: exhaustThis },
    chooseCards("memory", tuckedUnder(yourIdentity, { filter: query("event") }), { min: 1, max: 1 }),
    moveCards(cards(chosen("memory")), "hand"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_ECHO_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};

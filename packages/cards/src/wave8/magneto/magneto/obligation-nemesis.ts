import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  alterEgoAction,
  boost,
  chosen,
  coveredByEngineRule,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  enemyActivates,
  eventResult,
  exhaustYourHero,
  forcedResponse,
  ifThen,
  moveCards,
  not,
  on,
  query,
  revealCard,
  self,
  takeDamage,
  topOfDeck,
  varAtLeast,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";
import { MAGNETIC_PULL_USED_MOMENT } from "./identity.js";

const AN_ACOLYTE = query("minion", { trait: trait("ACOLYTE") });

/**
 * Magneto's obligation and nemesis set (docs/phase7-wave8.md section 7.5, 3.71, 3.80, 3.81; Q41, Q42).
 *
 * **Old Grievances (49027)**: "Give to the Erik Lehnsherr player" is engine data (`obligationCardId`), and the card
 * stays in the player's play area (it has no When Revealed). `49027.obligation` is the data's own name for that shape and
 * is `coveredByEngineRule()`. The Forced Response answers the "used" moment of _Magnetic Pull_ (it is raised whether or
 * not a MAGNETIC card was found, Q41 = A): the player takes 1 damage for each card the Pull discarded, the found card
 * included (Q42 = A), as one instance of X (`takeDamage`: tough and Magnetic Bubble see the whole amount). The
 * Alter-Ego Action exhausts the alter-ego and discards the card.
 *
 * **Exodus (49028)**: Steady, Toughness and Villainous are data. His Forced Response is NOT registered: the number is
 * "his total ATK for that attack" (ATK, modifiers and boost icons, before the defender's DEF) and no value of the DSL
 * reports it (`eventResult("damage")` is the damage the attack dealt, after DEF). See `MAGNETO_OBLIGATION_NEMESIS_DRAFTS`
 * and `MAGNETO_OBLIGATION_NEMESIS_SKIPPED`.
 *
 * **Martyr for Mutants (49029)**: 3 threat per player, amplify and 3 boost icons are data. When Defeated: the defeating
 * player discards the top 9 cards of their deck (a short deck discards what it has and resets, RRG p. 33).
 *
 * **Fabian Cortez (49030)**: Guard is data. When Defeated: the defeating player discards the top 4 cards of their deck.
 * Boost: the player the activation is against discards the top 4 cards of their deck.
 *
 * **Frenzy (49031)**: Quickstrike is data. Forced Response: after she attacks you, discard the top 2 cards of your deck.
 * Boost: discard the top 4 cards of your deck.
 *
 * **Angry Acolyte (49032)**: When Revealed: each ACOLYTE minion engaged with a player activates against that player
 * (an attack on a hero, a scheme against an alter-ego); when none activated, encounter cards are discarded until an
 * ACOLYTE minion is, and it is revealed (Off with His Head!, `crazy_gang`, is the same shape). A minion that cannot
 * activate (Wrapped in Metal) counts as not activating.
 *
 * Cards (6):
 * - 49027 Old Grievances (obligation)
 * - 49028 Exodus (minion)
 * - 49029 Martyr for Mutants (side_scheme)
 * - 49030 Fabian Cortez (minion)
 * - 49031 Frenzy (minion)
 * - 49032 Angry Acolyte (treachery)
 */
export const MAGNETO_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "49027.obligation": coveredByEngineRule(),
  "49027.old-grievances-forced-response": forcedResponse(
    on.moment(MAGNETIC_PULL_USED_MOMENT),
    takeDamage(varOf("moment.pulled.count")),
  ),
  "49027.old-grievances-action": alterEgoAction({ cost: exhaustYourHero }, discard(self)),

  // Exodus: "49028.exodus-forced-response" is not registered, see the drafts below.

  "49029.when-defeated": whenDefeated(moveCards(topOfDeck(9, defeatingPlayer), "discard")),

  "49030.when-defeated": whenDefeated(moveCards(topOfDeck(4, defeatingPlayer), "discard")),
  "49030.boost": boost(moveCards(topOfDeck(4, you), "discard")),

  "49031.frenzy-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    moveCards(topOfDeck(2, you), "discard"),
  ),
  "49031.boost": boost(moveCards(topOfDeck(4, you), "discard")),

  "49032.when-revealed": whenRevealed(
    enemyActivates(each(AN_ACOLYTE), { bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), [
      discardEncounterUntil(AN_ACOLYTE, "found"),
      revealCard(chosen("found")),
    ]),
  ),
});

/**
 * Exodus's Forced Response as close as today's vocabulary writes it, unregistered: it discards one card per point of
 * damage the attack dealt (`eventResult("damage")`, after the defender's DEF), where the card says his total ATK for
 * that attack. They agree while the attack is undefended and unreduced and differ when the hero defends or a shield
 * takes some. Once the engine reports an enemy attack's total ATK (ATK, modifiers and boost icons, before DEF; e.g. a
 * result key `atk` on the attack's event), register this with that value and turn the `it.fails` of
 * `obligation-nemesis.test.ts` into `it`.
 */
export const MAGNETO_OBLIGATION_NEMESIS_DRAFTS: AbilityRegistry = defineAbilities({
  "49028.exodus-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    moveCards(topOfDeck(eventResult("damage"), you), "discard"),
  ),
});

/** Refs of this set left unregistered, each with its reason. */
export const MAGNETO_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "49028.exodus-forced-response":
    'no value reads an enemy attack\'s total ATK (ATK, modifiers and boost icons, before DEF); eventResult("damage") is the damage dealt after DEF (docs/phase7-wave8.md section 3.81 assumes it exists)',
};

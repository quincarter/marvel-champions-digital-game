import type { AbilityRegistry } from "@mc/engine";
import {
  andThen,
  action,
  chooseTarget,
  chosen,
  defineAbilities,
  discard,
  each,
  enemyAttack,
  enemyAttacksEnemy,
  enemyLeader,
  eventSource,
  flipCard,
  forcedResponse,
  heroInterrupt,
  heroResponse,
  host,
  ifThen,
  interrupt,
  moveThreat,
  on,
  paidWith,
  preventThreat,
  query,
  refMatches,
  self,
  stun,
  theMainScheme,
  when,
  yourLeader,
  yourLeadersMainScheme,
} from "../../../dsl/index.js";

/**
 * "Your She-Hulk leader attacks the enemy leader." (She-Hulk Smash): the leader-versus-leader attack, MC56 p. 16 (MC56
 * pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); Q6, settled 2026-11-20): your leader is given
 * a boost card from the deck of the area it sits in, turned by the first player of the team in that area, no defender,
 * no guard. Written as the Civil War leader attack events are (`cw/competitive/leader-cards.ts`).
 */
const LEADER_ATTACKS_ENEMY_LEADER = enemyAttacksEnemy(yourLeader, enemyLeader, { boost: true });

/**
 * "The Dense / Intangible attachment" of the Vision leader this card's controller is fighting for: the one double-sided
 * mass form attachment (docs/phase7-synthezoid.md M2), named by its two face titles as `leaders/vision.ts` does. It sits
 * on "your Vision leader", in the other team's area, so the query reaches across areas (`anyGameArea`).
 */
/** `anyGameArea` is repeated inside each alternative: an `anyOf` alternative checks the game area again on its own. */
const YOUR_MASS_FORM = query("attachment", {
  anyOf: [
    { name: "Dense", host: yourLeader, anyGameArea: true },
    { name: "Intangible", host: yourLeader, anyGameArea: true },
  ],
  anyGameArea: true,
});

/**
 * The eight leader player cards (She-Hulk 57032 to 57035, Vision 57074 to 57077) of Synthezoid Smackdown (MC57;
 * docs/phase7-synthezoid.md section 8.3 item 14). Competitive only (the data's `specificTo`), so "your leader" always
 * resolves in a game that seats one; cooperatively a clause aimed at it does nothing (MC56 p. 6).
 *
 * "The main scheme" is the main scheme of the card controller's own game area (the one the enemy leader's scenario
 * puts in front of the team); "your leader's main scheme" is the other team's (MC56 p. 16).
 *
 * She-Hulk
 * - 57032 You're Out of Order!: Interrupt to threat placed on the main scheme, prevent 3 of it.
 * - 57033 She-Hulk Smash: the leader-versus-leader attack; with a [physical] resource paid, stun the enemy leader.
 * - 57034 Make Me Angry: attaches to your leader (card data); after a hero or leader attacks her, she attacks that
 *   character (a leader-versus-leader attack if it is a leader), then this is discarded.
 * - 57035 Legal Counsel: after you spend it, move 1 threat from the main scheme to your leader's main scheme.
 *
 * Vision
 * - 57076 Phased Out: discard an attachment on the enemy leader printing Hero Action or Hero Response (current text,
 *   errata RRG v1.8 p. 70 and the March 19, 2026 ruling: the printed "Hero Interrupt" is "Hero Action").
 * - 57077 Android Assistance: when you spend it, flip your leader's mass form attachment.
 *
 * Not scripted (see the skipped list): 57074 Calculated Risk and 57075 Synthezoid Strike, each needing an engine
 * primitive that does not exist yet.
 */
export const SYNTHEZOID_COMPETITIVE_LEADER_CARDS: AbilityRegistry = defineAbilities({
  "57032.youre-out-of-order-interrupt": interrupt(when.threatPlaced(query("mainScheme")), preventThreat(3)),

  "57033.she-hulk-smash-action": action(
    { readsPaidTypes: { types: ["physical"] } },
    LEADER_ATTACKS_ENEMY_LEADER,
    ifThen(paidWith("physical"), stun(enemyLeader)),
  ),

  // "After a hero or leader attacks attached She-Hulk": as Energy Channel (56098, `cw/leaders/captain-marvel.ts`), the
  // attacker may be in the other game area. "Then" ties the discard to the attack being made (RRG v1.8 "'Then'" p. 44).
  "57034.make-me-angry-forced-response": forcedResponse(
    on.attacks(query(["hero", "villain"], { anyGameArea: true }), {
      target: query("villain", { hostOfSelf: true, anyGameArea: true }),
    }),
    ifThen(
      refMatches(eventSource, query("villain", { anyGameArea: true })),
      enemyAttacksEnemy(host, eventSource, { boost: true }),
      enemyAttack(host, { targetCharacter: eventSource }),
    ),
    andThen(discard(self)),
  ),

  "57035.legal-counsel-response": heroResponse(
    on.youSpendThis(),
    moveThreat(theMainScheme, yourLeadersMainScheme, { amount: 1 }),
  ),

  "57076.phased-out-action": action(
    chooseTarget(
      "attachment",
      query("attachment", {
        host: enemyLeader,
        printsAbility: { kinds: ["action", "response"], form: "hero" },
      }),
    ),
    discard(chosen("attachment")),
  ),

  "57077.android-assistance-interrupt": heroInterrupt(on.youSpendThis(), flipCard(each(YOUR_MASS_FORM))),
});

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const SYNTHEZOID_COMPETITIVE_LEADER_CARDS_SKIPPED: Readonly<Record<string, string>> = {
  "57074.calculated-risk-action":
    "needs two engine primitives: shuffleEncounterDeck of another leader's deck (it shuffles the context area's deck) and a ref for the first player of the enemy team",
  "57075.synthezoid-strike-action":
    "needs enemyAttacksEnemy to carry this-attack-only +1 ATK and piercing (it takes only boost); modifyStat endOfAttack is not scoped to the attack the effect initiates",
};

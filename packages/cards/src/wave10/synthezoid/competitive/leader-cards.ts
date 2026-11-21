import type { AbilityRegistry } from "@mc/engine";
import {
  andThen,
  action,
  chooseCards,
  chooseTarget,
  chosen,
  dealAsEncounterCard,
  defineAbilities,
  discard,
  each,
  encounterCards,
  faceNamed,
  enemyAttack,
  enemyAttacksEnemy,
  enemyLeader,
  enemyTeamFirstPlayer,
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
  shuffleEncounterDeck,
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
const YOUR_MASS_FORM = query("attachment", {
  anyOf: [
    { name: "Dense", host: yourLeader },
    { name: "Intangible", host: yourLeader },
  ],
  anyGameArea: true,
});
/** "If Vision's mass form attachment is [Dense / Intangible]": the face showing now. */
const massFormIs = (name: "Dense" | "Intangible") => faceNamed(each(YOUR_MASS_FORM), name);

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
 * - 57074 Calculated Risk: search the top 5 of your leader's encounter deck (in the other team's area) for a card, deal
 *   it facedown to the first player on the enemy team (that team's token holder), then shuffle that deck.
 * - 57075 Synthezoid Strike: the leader-versus-leader attack; a Dense Vision gets +1 ATK and piercing for it, an
 *   Intangible one flips to Dense first (reading A, docs/competitive-mode-plan.md section 1.10).
 * - 57076 Phased Out: discard an attachment on the enemy leader printing Hero Action or Hero Response (current text,
 *   errata RRG v1.8 p. 70 and the March 19, 2026 ruling: the printed "Hero Interrupt" is "Hero Action").
 * - 57077 Android Assistance: when you spend it, flip your leader's mass form attachment.
 *
 * All eight are scripted.
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

  // "Search the top 5 cards of your leader's encounter deck for an encounter card": your leader's deck sits in the
  // other team's area (MC56 p. 16), and you search it (the searching player sees it; plan section 1.10). Every card
  // there is an encounter card, so one is found while the deck has any. RRG 1.8 "Search" (p. 39): that whole deck is
  // shuffled once the ability is done. "The first player on the enemy team" is that team's token holder (MC56 p. 16),
  // not `enemyTeamChooses`, and sits in the same area as the deck searched.
  "57074.calculated-risk-action": action(
    chooseCards("found", encounterCards(["deck"], undefined, 5, yourLeader), { min: 1, max: 1, search: true }),
    dealAsEncounterCard(chosen("found"), enemyTeamFirstPlayer),
    shuffleEncounterDeck(yourLeader),
  ),

  // Bullets resolve sentence by sentence (FFG ruling Feb 28, 2026 #5, Spell Blast / Erratic Teleportation): an
  // Intangible Vision flips to Dense before the attack (Dense's printed +1 ATK applies) but does not get this card's
  // +1 ATK / piercing; same check-then-flip order as 57052 / 57053.
  "57075.synthezoid-strike-action": action(
    ifThen(
      massFormIs("Dense"),
      enemyAttacksEnemy(yourLeader, enemyLeader, { boost: true, atkBonus: 1, keywords: ["piercing"] }),
      [ifThen(massFormIs("Intangible"), flipCard(each(YOUR_MASS_FORM))), LEADER_ATTACKS_ENEMY_LEADER],
    ),
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
export const SYNTHEZOID_COMPETITIVE_LEADER_CARDS_SKIPPED: Readonly<Record<string, string>> = {};

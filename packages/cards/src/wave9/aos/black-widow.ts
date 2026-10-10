import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  atEndOfAttack,
  attackPreventedAmount,
  changeForm,
  chooseTarget,
  confuse,
  dealDamage,
  each,
  encounterCard,
  enemyAttack,
  enemyScheme,
  gainsKeywordX,
  inMode,
  isAlterEgo,
  isStunned,
  retargetPlayerAttack,
  stun,
  takeDamage,
  yourIdentity,
  attachCard,
  attackResolvedLabeled,
  cancelIt,
  andThen,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardFromHand,
  encounterCards,
  eachPlayer,
  eventPlayer,
  eventSource,
  exhaustCardsCost,
  forEachPlayer,
  forcedInterrupt,
  gainsKeyword,
  gets,
  grantingCard,
  grantsPreparation,
  heroAction,
  heroResponse,
  ifThen,
  modifyAttack,
  not,
  on,
  perHero,
  placeThreat,
  product,
  preparation,
  putIntoPlay,
  query,
  removeThreat,
  resolvePreparationsOf,
  rule,
  self,
  setup,
  shuffleEncounterDeck,
  theMainScheme,
  theVillain,
  thatPlayer,
  varAtLeast,
  villainStageNumberOf,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/** The id of the ability Night Vision Goggles gives other cards: in the registry, listed on no card (section 3.3). */
export const GOGGLES_GRANTED_PREPARATION = "50070.night-vision-goggles-granted-preparation";

/** The id of the ability Automated Defenses gives other cards: in the registry, listed on no card (section 3.3). */
export const DEFENSES_GRANTED_PREPARATION = "50074.automated-defenses-granted-preparation";

/** "When a character you control attacks Black Widow" (hero or ally, basic or labeled): the attack event's target is her. */
const ATTACKS_BLACK_WIDOW: EventPattern = { on: "attack", selfIs: "target" };

/**
 * "Remove 1 threat from the main scheme → discard the top card of the encounter deck and resolve each 'Preparation'
 * ability on that card." The removal is the villain's own, not a thwart, and is not stopped by a crisis icon (RRG 1.8
 * "Crisis Icon", p. 14: abilities on encounter cards are not affected). If no threat is removed the rest of the ability
 * does not resolve (MC50 p. 9). The attacking player discards and resolves.
 */
const forcedInterruptOnAttack = () =>
  forcedInterrupt(
    ATTACKS_BLACK_WIDOW,
    removeThreat(1, theMainScheme, { bind: "removed" }),
    ifThen(varAtLeast("removed.amount", 1), [
      discardEncounterCards(1, { bind: "top" }),
      resolvePreparationsOf(chosen("top"), { bind: "prep", player: eventPlayer }),
    ]),
  );

/**
 * Black Widow's villain set (MC50 pp. 8-9; docs/phase7-wave9.md sections 3.2, 3.3 and 3.4), first half: the villain
 * (50064 to 50066, one record with three stages), The Widow's Web (50067a/b) and the four attachments (50068 to
 * 50071). Hit points, ATK/SCH, keywords, boost icons and the Gauntlet's +1 ATK / Night Vision Goggles' +1 SCH are data.
 *
 * **Black Widow I-III**: a Forced Interrupt to any attack on her; the three stages behave alike (stage I's "ignoring any
 * crisis icons" is a reminder, see above). Stages II and III place 2 and 3 per hero threat on the main scheme when
 * revealed.
 *
 * **The Widow's Web**: Setup: each player searches the encounter deck for a minion and puts it into play engaged with
 * them (not revealed), in player order, then one shuffle. The acceleration is X per hero, X the villain's stage number
 * (`printedX`).
 *
 * **Attachments**: "Preparation" is a label of its own, resolved only by the villain's interrupt, never as a boost.
 * The Gauntlet attaches itself to the villain from the discard pile; Grappling Hook has the attacker discard an event
 * from hand; Night Vision Goggles attach themselves and give every encounter card that prints no Preparation a granted
 * one (`GOGGLES_GRANTED_PREPARATION`, registry-only); Stun Net attaches to the attacking character after the attack.
 *
 * Cards (14 records, 50064 to 50079; the second half, 50072 to 50079, is scripted below the attachments):
 * - 50064 Black Widow (villain)
 * - 50067a The Widow's Web (main_scheme)
 * - 50068 Black Widow's Gauntlet (attachment)
 * - 50069 Grappling Hook (attachment)
 * - 50070 Night Vision Goggles (attachment)
 * - 50071 Stun Net (attachment)
 * - 50072 A.I.M. Commando, 50073 A.I.M. Grunt, 50074 Automated Defenses, 50075 Destroy Evidence, 50076 Attacrobatics,
 *   50077 Covert Ops, 50078 Dance of Death, 50079 Widow's Bite (second half)
 */
export const BLACK_WIDOW: AbilityRegistry = defineAbilities({
  "50064.black-widow-forced-interrupt": forcedInterruptOnAttack(),

  "50065.when-revealed": whenRevealed(placeThreat(perHero(2), theMainScheme)),
  "50065.black-widow-forced-interrupt": forcedInterruptOnAttack(),

  "50066.when-revealed": whenRevealed(placeThreat(perHero(3), theMainScheme)),
  "50066.black-widow-forced-interrupt": forcedInterruptOnAttack(),

  // Setup: each player, in player order, chooses a minion from the encounter deck and puts it into play engaged with them.
  "50067a.setup": setup(
    forEachPlayer(
      eachPlayer,
      chooseCards("minion", encounterCards(["deck"], query("minion")), { min: 1, max: 1, chooser: thatPlayer }),
      putIntoPlay(chosen("minion"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  // 1B: "X is Black Widow's stage number" (acceleration X per hero), a `printedX` value.
  "50067b.the-widows-web-constant": constant(
    gets("acceleration", product(villainStageNumberOf(theVillain), perHero(1)), { self: true }, { setBase: true }),
  ),

  "50068.black-widows-gauntlet-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, { categories: ["villain"], hostOfSelf: true }),
  ),
  // "(after resolving the retaliate keyword)": a response to the attack, offered once retaliate has resolved.
  "50068.black-widows-gauntlet-response": heroResponse(
    on.attacks({ categories: ["identity", "ally"] }, { byYou: true, target: { hostOfSelf: true } }),
    ifThen(not(attackResolvedLabeled("preparation")), discard(self)),
  ),
  "50068.preparation": preparation(attachCard(self, theVillain)),

  // "When a player plays an event card": any player's. The cancel discards the event (it is still considered played).
  "50069.grappling-hook-forced-interrupt": forcedInterrupt(
    { on: "cardBeingPlayed", targetIs: query("event") },
    cancelIt(),
    andThen(discard(self)),
  ),
  "50069.preparation": preparation(discardFromHand(1, you, { filter: query("event") })),

  "50070.night-vision-goggles-constant": constant(grantsPreparation(GOGGLES_GRANTED_PREPARATION)),
  [GOGGLES_GRANTED_PREPARATION]: preparation(modifyAttack({ preventAllDamage: true }), discard(grantingCard)),
  "50070.preparation": preparation(attachCard(self, theVillain)),

  // "Attached character cannot attack."
  "50071.stun-net-constant": constant(
    rule({ kind: "cannotAttack", target: query("enemy"), attacker: { hostOfSelf: true } }),
  ),
  // Any player may trigger it; the cost is an identity or ally of the paying player.
  "50071.stun-net-action": heroAction(
    { cost: exhaustCardsCost(query(["identity", "ally"])), triggerableBy: eachPlayer },
    discard(self),
  ),
  "50071.preparation": preparation(atEndOfAttack(attachCard(self, eventSource))),

  // Quickstrike is data. "After this attack": at the end of the attack, so the quickstrike answers its engagement.
  "50072.preparation": preparation(atEndOfAttack(putIntoPlay(self, you))),

  // Guard is data. Q4 = A: "this attack" is the whole attack, so all of it resolves against the Grunt (ruling January 17,
  // 2026 - Ruling 2: Black Widow takes nothing and her retaliate does not answer).
  "50073.preparation": preparation(putIntoPlay(self, you), retargetPlayerAttack(self)),

  // Hinder 1 per hero is data. The granted text is a second registry entry listed on no card, as the Goggles' is.
  "50074.automated-defenses-constant": constant(grantsPreparation(DEFENSES_GRANTED_PREPARATION)),
  [DEFENSES_GRANTED_PREPARATION]: preparation(dealDamage(1, eventSource)),

  // Hinder 2 per hero is data. The grant reaches a card as it is revealed (Dial M for Mojo 39035 is the same rule).
  "50075.destroy-evidence-constant": constant(gainsKeywordX("incite", 1, encounterCard({ self: false }))),

  // "Give her an additional boost card for this attack" is `extraBoostCards`, dealt at the start of this attack only.
  "50076.when-revealed": whenRevealed(
    ifThen(isAlterEgo(), changeForm(you, "hero")),
    enemyAttack(theVillain, { against: you, extraBoostCards: 1 }),
  ),
  // The prevented amount is read at the end of the attack (the validator rejects reading it any other way).
  "50076.preparation": preparation(
    modifyAttack({ preventAllDamage: true, bind: "prevented" }),
    ifThen(inMode("expert"), atEndOfAttack(dealDamage(attackPreventedAmount("prevented"), eventSource))),
  ),

  "50077.when-revealed": whenRevealed(confuse(yourIdentity), enemyScheme(theVillain, { against: you })),
  "50077.preparation": preparation(placeThreat(1, each(query(["mainScheme", "sideScheme"])))),

  // Three different characters you control, in the printed order; "a second" and "a third" are never one already chosen.
  // `not: { not: { excluding } }` is "is not that card", the way to leave two chosen cards out of one query.
  "50078.when-revealed": whenRevealed(
    chooseTarget("first", query("character", { controller: "you" })),
    dealDamage(1, chosen("first")),
    chooseTarget("second", query("character", { controller: "you", excluding: chosen("first") })),
    dealDamage(2, chosen("second")),
    chooseTarget("third", {
      ...query("character", { controller: "you", excluding: chosen("first") }),
      not: { not: { excluding: chosen("second") } },
    }),
    dealDamage(3, chosen("third")),
  ),
  "50078.preparation": preparation(dealDamage(1, each(query("character", { controller: "you" })))),

  // The stun is applied after the "already stunned" check, which reads the status the card is about to add.
  "50079.when-revealed": whenRevealed(
    ifThen(isStunned(yourIdentity), takeDamage(2), takeDamage(1)),
    stun(yourIdentity),
  ),
  "50079.preparation": preparation(atEndOfAttack(stun(eventSource))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None: every ref is scripted. */
export const BLACK_WIDOW_SKIPPED: Readonly<Record<string, string>> = {};

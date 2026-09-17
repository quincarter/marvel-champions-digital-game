import {
  after,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  discard,
  discardRandomFromHandCost,
  each,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  encounterCards,
  eventResult,
  exhaustYourHero,
  exists,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  heroAction,
  host,
  ifElse,
  ifThen,
  isHero,
  modifyAttack,
  moveCards,
  named,
  not,
  option,
  placeThreat,
  query,
  removeThreat,
  revealCard,
  rule,
  scaled,
  self,
  selectCards,
  setActiveVillain,
  statOf,
  surge,
  thatPlayer,
  theVillain,
  threatAtLeast,
  threatOn,
  topOfDeck,
  undefendedAttack,
  varOf,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import {
  distinctCardTypesOf,
  enemyAttackAfterThisNoBoost,
  leastThreatVillain,
  mostThreatVillain,
  pickVillainBy,
  pickedVillain,
  printedCostOf,
  signatureSideSchemeOf,
  villainOfSideScheme,
  VILLAIN_PICK_SLOT,
} from "./local.js";

const BULLDOZER = query("villain", { name: "Bulldozer" });

/**
 * Bulldozer (07046/07047) and his own encounter set: Clear the Road (07048), Bulldozer's Helmet (07049), Held
 * Hostage (07050), Ramming Speed (07051), Corrupt Prison Guard (07052, no ability), Escaped Convict (07053), Buddy
 * System (07054), Bull Rush (07055), Chaos In the Prison (07056), Get Wrecked! (07057), Headbutt (07058), Leading
 * the Charge (07059).
 */
export const BULLDOZER_SET = defineAbilities({
  // Bulldozer (I/II) — [star] When Bulldozer schemes, place the threat on his side scheme instead of the main
  // scheme.
  "07046.bulldozer-constant": constant(rule({ kind: "schemeThreatDestination", enemy: BULLDOZER, scheme: "ownSignatureSideScheme" })),
  "07047.bulldozer-constant": constant(rule({ kind: "schemeThreatDestination", enemy: BULLDOZER, scheme: "ownSignatureSideScheme" })),
  // Bulldozer (I/II) — [star] Forced Interrupt: When Bulldozer attacks, the attack gains overkill.
  "07046.bulldozer-forced-interrupt": forcedInterrupt(when.enemyAttacks("self"), modifyAttack({ overkill: true })),
  "07047.bulldozer-forced-interrupt": forcedInterrupt(when.enemyAttacks("self"), modifyAttack({ overkill: true })),

  // Clear the Road — Bulldozer's Side Scheme. This card cannot leave play while Bulldozer is in play.
  "07048.clear-the-road-constant": constant(rule({ kind: "cannotLeavePlay", target: query("sideScheme", { name: "Clear the Road" }), while: exists(BULLDOZER) })),
  "07048.clear-the-road-constant-2": constant(rule({ kind: "notDefeatedWithoutThreat", target: query("sideScheme", { name: "Clear the Road" }) })),
  // Charge! — Forced Response: After threat is placed here, if there is 10 or more threat here, each player must
  // discard the top 10 cards of their deck. Remove all but 3 threat from this scheme. `threatAtLeast` (wave B
  // primitives batch, docs/phase7-wave1-scripting.md §6) is the same live-threat-vs-threshold read Day of
  // Reckoning's Hard Hitter needed (`wrecker.ts`).
  "07048.charge": forcedResponse(
    after.threatPlaced("self"),
    ifThen(threatAtLeast(self, 10), [forEachPlayer(eachPlayer, moveCards(topOfDeck(10, thatPlayer), "discard")), removeThreat(scaled(threatOn(self), { plus: -3 }), self)]),
  ),

  // Bulldozer's Helmet — Attach to Bulldozer. [star] Forced Response: After Bulldozer attacks you, discard 1 card
  // from the top of your deck for each point of damage dealt by this attack.
  "07049.bulldozers-helmet-forced-response": forcedResponse(
    after.enemyAttacks("host", { againstYou: true, damages: true }),
    moveCards(topOfDeck(eventResult("damage"), you), "discard"),
  ),
  // Hero Action: Exhaust your hero and discard 1 card at random from your hand → discard this card. Same
  // `discardRandomFromHandCost` shape as Magic Crowbar (`wrecker.ts`).
  "07049.bulldozers-helmet-action": heroAction({ cost: [exhaustYourHero, discardRandomFromHandCost(1)] }, discard(self)),

  // Held Hostage — same text as Wrecker's copy (07005).
  "07050.held-hostage-constant": constant(rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { hostOfSelf: true }), by: "thwart" })),
  "07050.held-hostage-action": heroAction(enemyAttack(villainOfSideScheme(host), { against: you }), discard(self)),

  // Ramming Speed — Attach to Bulldozer. [star] Forced Interrupt: When Bulldozer attacks you, you must defend
  // against Bulldozer's attacks with an ally you control, if able. Printed as an interrupt, but the underlying
  // mechanism (`RuleSpec.mustDefendWithAlly`, `klaw.ts`'s identical Melter) is an always-active constant rule, not a
  // one-shot interrupt effect.
  "07051.ramming-speed-forced-interrupt": constant(rule({ kind: "mustDefendWithAlly", attacker: { hostOfSelf: true } })),
  // [star] Forced Response: After Bulldozer attacks you, discard this card.
  "07051.ramming-speed-forced-response": forcedResponse(after.enemyAttacks("host", { againstYou: true }), discard(self)),

  // Escaped Convict — same text as Wrecker's copy (07009).
  "07053.boost": boost(setActiveVillain(leastThreatVillain), ifThen(isHero(), enemyAttackAfterThisNoBoost(theVillain, you))),

  // Buddy System — same text as Wrecker's copy (07010).
  "07054.when-revealed": whenRevealed(
    pickVillainBy("lowest"),
    selectCards("looked", encounterCards(["deck"], undefined, ifElse(not(exists(query("villain", { excludeSlots: [VILLAIN_PICK_SLOT] }))), 2, 1), pickedVillain)),
    revealCard(chosen("looked")),
  ),
  "07054.boost": boost(setActiveVillain(leastThreatVillain)),

  // Bull Rush — When Revealed (Alter-Ego): Bulldozer schemes. Discard the top card of your deck for each threat
  // placed by this activation.
  "07055.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(named("Bulldozer"), { bind: "bull-rush" }), moveCards(topOfDeck(varOf("bull-rush.threatPlaced")), "discard")),
  // When Revealed (Hero): Bulldozer attacks you. Discard the top card of your deck for each damage dealt by this
  // attack.
  "07055.when-revealed-hero": whenRevealedHero(enemyAttack(named("Bulldozer"), { against: you, bind: "bull-rush" }), moveCards(topOfDeck(varOf("bull-rush.damage")), "discard")),

  // Chaos In the Prison — same text as Wrecker's copy (07011).
  "07056.when-revealed": whenRevealed(
    ifThen(
      exists(query("upgrade", { controller: "you" })),
      chooseOne(
        option("Discard an upgrade you control", chooseTarget("discarded-upgrade", query("upgrade", { controller: "you" })), discard(chosen("discarded-upgrade"))),
        option("Place threat on the active villain's side scheme", placeThreat(countOf(query("upgrade", { controller: "you" })), signatureSideSchemeOf(theVillain))),
      ),
      surge(),
    ),
  ),
  // [star] Boost: If this attack is undefended, discard an upgrade you control.
  "07056.boost": boost(ifThen(undefendedAttack, [chooseTarget("chaos-boost-upgrade", query("upgrade", { controller: "you" })), discard(chosen("chaos-boost-upgrade"))])),

  // Get Wrecked! — same text as Wrecker's copy (07013).
  "07057.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(mostThreatVillain)),
  "07057.when-revealed-hero": whenRevealedHero(enemyAttack(leastThreatVillain, { against: you })),

  // Headbutt — When Revealed: Discard 1 card at random from your hand. If you are in hero form, take damage equal
  // to that card's printed cost. If you are in alter-ego form, place threat on Bulldozer's side scheme equal to
  // that card's printed cost.
  "07058.when-revealed": whenRevealed(
    moveCards(zone("hand", you, { random: 1 }), "discard", "discarded"),
    ifThen(
      isHero(),
      dealDamage(printedCostOf(chosen("discarded")), yourIdentity),
      placeThreat(printedCostOf(chosen("discarded")), signatureSideSchemeOf(named("Bulldozer"))),
    ),
  ),

  // Leading the Charge — When Revealed: Discard the top X cards of your deck, where X is Bulldozer's ATK. Place 1
  // threat on Bulldozer's side scheme for each different card type discarded this way.
  "07059.when-revealed": whenRevealed(
    moveCards(topOfDeck(statOf(named("Bulldozer"), "atk")), "discard", "discarded"),
    placeThreat(distinctCardTypesOf(chosen("discarded")), signatureSideSchemeOf(named("Bulldozer"))),
  ),
});

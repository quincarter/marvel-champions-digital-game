import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  after,
  attachCard,
  cancelIt,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  countBoostIcons,
  countOf,
  countersOn,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discardEncounterCards,
  each,
  eitherCost,
  eventSource,
  exhaust,
  findCard,
  firstPlayer,
  forEachCard,
  forcedInterrupt,
  forcedResponse,
  handCountOf,
  heroAction,
  ifThen,
  modifyAttack,
  moveCards,
  named,
  on,
  option,
  perHero,
  query,
  refMatches,
  removeCounter,
  removeCountersFrom,
  selectCards,
  self,
  spend,
  spendResources,
  stun,
  surge,
  topOfDeck,
  valueAtLeast,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

/** The one Electric Charge in play (the permanent attachment on the villain). */
const CHARGE = named("Electric Charge");
const ELECTRO = query("villain", { name: "Electro" });
/** A card with a printed [energy] resource: a printed wild icon is only wild (RRG 1.8 "Wild Resource", p. 48; ruling Jan 11 2026 (3): printed means the bottom-left icons). */
const ENERGY_CARD = query([], { printedResource: "energy" });
/** Any charge counter on Electric Charge. */
const CHARGED = valueAtLeast(countersOn(CHARGE, "charge"), 1);

/**
 * "When Revealed: Find Electric Charge, attach it to Electro, and place 2[per_hero] charge counters on it." (60076,
 * 60077.) A find leaves a card already there where it is (so the second stage's reveal only adds counters), shuffling
 * the deck it searched (RRG 1.8 "Search", p. 39).
 */
const findAndCharge = whenRevealed(
  findCard(query("attachment", { name: "Electric Charge" }), { attachTo: self }, { bind: "charge" }),
  addCounters("charge", perHero(2), chosen("charge")),
);

/** "[star] Forced Response: After Electro schemes, place N charge counters on Electric Charge." */
const electroResponse = (n: number) => forcedResponse(after.enemySchemes("self"), addCounters("charge", n, CHARGE));

/**
 * Electro villain set (docs/phase7-wave11-scenarios.md section S6).
 *
 * **60076-60078 Electro**: When Revealed as `findAndCharge` (stages I and II) or 3[per_hero] counters (stage III, the
 * card already attached); Forced Response as `electroResponse` (1, 1, 2).
 * **60079 Electric Charge**: Permanent is data. Forced Interrupt: when Electro attacks, remove a charge counter (the
 * cost) to give him an additional boost card for this attack, and the attack gains overkill. Hero Action: spend an
 * [energy] or any 2 resources (`eitherCost`: the player picks one) to remove a counter.
 * **60080 Drained of Power**: Uses is data (the last drain counter removed discards it). When Revealed: attached to the
 * revealing player's identity, each upgrade they control exhausted. Forced Interrupt: when an upgrade you control would
 * ready ("you" on an attachment is the player it is attached to, RRG 1.8 "You, Your", p. 49), choose to pay and remove
 * a drain counter (the ready goes ahead) or not (`cancelIt`: it does not ready).
 * **60081 Whiplash**: Forced Interrupt when attacked: remove a charge counter from Electric Charge (cost, so no
 * counter means no trigger), discard the top card of the encounter deck, deal the attacker 1 damage per boost icon.
 * **60082 Charging Up**: When Defeated: 3 charge counters on Electric Charge.
 * **60083 Chain Lightning**: for each character you control, exhaust it, or deal it 1 damage (3 while Electric Charge
 * holds a charge counter, read before the counter comes off) and remove a counter.
 * **60084 Energy Overload**: surge with no printed-[energy] card in hand; otherwise for each such card, discard it or
 * stun a character you control.
 * **60085 Shocking Revelation**: discard the top card of your deck per card you control (RRG 1.8 "Ownership and Control",
 * p. 31, and "Player Side Scheme", p. 34: identity, allies, upgrades, supports, player side schemes; never an encounter
 * card in your area); for each discarded card with a printed [energy] resource, take 1 indirect damage or
 * place a charge counter on Electric Charge.
 *
 * Cards (8):
 * - 60076 Electro (villain)
 * - 60079 Electric Charge (attachment)
 * - 60080 Drained of Power (attachment)
 * - 60081 Whiplash (minion)
 * - 60082 Charging Up (side_scheme)
 * - 60083 Chain Lightning (treachery)
 * - 60084 Energy Overload (treachery)
 * - 60085 Shocking Revelation (treachery)
 */
export const FNE_VILLAINS_ELECTRO: AbilityRegistry = defineAbilities({
  "60076.when-revealed": findAndCharge,
  "60076.electro-forced-response": electroResponse(1),
  "60077.when-revealed": findAndCharge,
  "60077.electro-forced-response": electroResponse(1),
  "60078.when-revealed": whenRevealed(addCounters("charge", perHero(3), CHARGE)),
  "60078.electro-forced-response": electroResponse(2),

  "60079.electric-charge-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(ELECTRO),
    { cost: removeCounter("charge") },
    modifyAttack({ extraBoostCards: 1, overkill: true }),
  ),
  "60079.electric-charge-action": heroAction(
    { cost: eitherCost(spend({ energy: 1 }), spend(2)) },
    removeCountersFrom(self, "charge"),
  ),

  "60080.when-revealed": whenRevealed(
    attachCard(self, yourIdentity),
    exhaust(each(query("upgrade", { controller: "you" }))),
  ),
  "60080.drained-of-power-forced-interrupt": forcedInterrupt(
    on.cardReadying(query("upgrade", { controller: "you" })),
    chooseOne(
      option("Spend an energy resource: remove a drain counter, the upgrade readies", [
        spendResources({ energy: 1 }, "paid"),
        removeCountersFrom(self, "drain"),
      ]),
      option("Spend 2 resources of any type: remove a drain counter, the upgrade readies", [
        spendResources({ generic: 2 }, "paid"),
        removeCountersFrom(self, "drain"),
      ]),
      option("Do not spend: the upgrade does not ready", [cancelIt()]),
    ),
  ),

  "60081.whiplash-forced-interrupt": forcedInterrupt(
    { on: "attack", selfIs: "target" },
    { cost: removeCounter("charge", 1, { from: CHARGE }) },
    discardEncounterCards(1, { bind: "top" }),
    countBoostIcons(chosen("top"), "top"),
    dealDamage(varOf("top.boostIcons"), eventSource),
  ),

  "60082.when-defeated": whenDefeated(addCounters("charge", 3, CHARGE)),

  "60083.when-revealed": whenRevealed(
    forEachCard(
      "victim",
      each(query("character", { controller: "you" })),
      chooseOne(
        option("Exhaust that character", [exhaust(chosen("victim"))]),
        option("Deal damage to that character and remove a charge counter", [
          ifThen(CHARGED, dealDamage(3, chosen("victim")), dealDamage(1, chosen("victim"))),
          removeCountersFrom(CHARGE, "charge"),
        ]),
      ),
    ),
  ),

  "60084.when-revealed": whenRevealed(
    selectCards("energyCards", zone("hand", you, { filter: ENERGY_CARD })),
    ifThen(
      valueAtLeast(handCountOf(you, ENERGY_CARD), 1),
      forEachCard(
        "card",
        chosen("energyCards"),
        chooseOne(
          option("Discard that card", [moveCards(cards(chosen("card")), "discard")]),
          option("Stun a character you control", [
            // No "choose": an encounter card targeting one of several eligible cards; the first player selects
            // (RRG 1.8 "First Player", p. 19).
            chooseTarget("stunned", query("character", { controller: "you" }), { chooser: firstPlayer }),
            stun(chosen("stunned")),
          ]),
        ),
      ),
      surge(),
    ),
  ),

  "60085.when-revealed": whenRevealed(
    moveCards(
      topOfDeck(countOf(query(["identity", "ally", "upgrade", "support", "sideScheme"], { controller: "you" }))),
      "discard",
      "milled",
    ),
    forEachCard(
      "milledCard",
      chosen("milled"),
      ifThen(
        refMatches(chosen("milledCard"), ENERGY_CARD, { anywhere: true }),
        chooseOne(
          option("Take 1 indirect damage", [dealIndirectDamage(you, 1)]),
          option("Place 1 charge counter on Electric Charge", [addCounters("charge", 1, CHARGE)]),
        ),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_ELECTRO_SKIPPED: Readonly<Record<string, string>> = {};

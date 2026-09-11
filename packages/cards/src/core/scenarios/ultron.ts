import {
  after,
  allOf,
  boost,
  chooseOne,
  chooseOneBy,
  chosen,
  constant,
  countOf,
  coveredByEngineRule,
  dealDamage,
  defineAbilities,
  discard,
  droneFromDeck,
  duringVillainPhaseStepOne,
  each,
  eachPlayer,
  encounterCards,
  engagedPlayerOf,
  enemyAttack,
  enemyScheme,
  eventSource,
  exhaustYourHero,
  exists,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  FRIENDLY_CHARACTER,
  gainsKeyword,
  gets,
  giveTough,
  heal,
  heroAction,
  ifThen,
  made,
  modifyStat,
  moveCards,
  not,
  option,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  rule,
  scaled,
  searchAndReveal,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  spendResources,
  surge,
  takeDamage,
  thatPlayer,
  theMainScheme,
  theVillain,
  topOfDeck,
  TRAIT,
  varAtLeast,
  varOf,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const DRONES = query("minion", { trait: TRAIT.DRONE });
const FACEDOWN_DRONES = query("minion", { trait: TRAIT.DRONE, facedown: true });
const YOUR_DRONES = query("minion", { trait: TRAIT.DRONE, engagedWith: "you" });
/** "Each player puts the top card of their deck into play facedown, engaged with them as a Drone minion." */
const EACH_PLAYER_DRONE = whenRevealed(droneFromDeck(eachPlayer));
const SPEND_TO_DISCARD = (resources: Parameters<typeof spend>[0]) => heroAction({ cost: spend(resources) }, discard(self));
/** Android Efficiency boost: "Choose to either spend a [type] resource or put the top card of the deck into play facedown, engaged with you as a Drone minion." */
const EFFICIENCY_BOOST = (type: "energy" | "mental" | "physical") => boost(spendResources({ [type]: 1 }, "efficiency"), ifThen(not(made("efficiency")), droneFromDeck(you)));

/** The Ultron scenario: Ultron (01134–01136), The Crimson Cowl / Assault on NORAD / Countdown to Oblivion (01137–01139), the Ultron set (01140–01150). */
export const ULTRON = defineAbilities({
  // Ultron (I) — [star] Forced Response: After Ultron attacks you, choose to either place 1 threat on the main scheme or put the
  // top card of your deck into play facedown, engaged with you as a Drone minion.
  "01134.ultron-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    chooseOne(option("Place 1 threat on the main scheme", placeThreat(1, theMainScheme)), option("Put the top card of your deck into play as a Drone minion", droneFromDeck(you))),
  ),
  // Ultron (II) — [star] Forced Interrupt: When Ultron attacks you, put the top card of your deck into play facedown, engaged with
  // you as a Drone minion. Until the end of this attack, Ultron gets +1 ATK for each Drone minion engaged with you.
  "01135.ultron-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    droneFromDeck(you),
    modifyStat("atk", countOf(YOUR_DRONES), theVillain, "endOfAttack"),
  ),
  // Ultron (III) — Each Drone minion gets +1 ATK and +1 hit point. Ultron cannot take damage while a Drone minion is in play.
  "01136.ultron-constant": constant(gets("atk", 1, DRONES), gets("hp", 1, DRONES), rule({ kind: "cannotTakeDamage", target: query("villain"), while: exists(DRONES) })),
  // When Revealed: Search the encounter deck and discard pile for the Ultron's Imperative side scheme and reveal it. Shuffle the encounter deck.
  "01136.when-revealed": whenRevealed(searchAndReveal(cardName("01150"))),

  // The Crimson Cowl 1A — Setup: Put the Ultron Drones environment into play. Shuffle the encounter deck. Advance to stage 1B (implicit).
  "01137a.setup": setup(selectCards("drones", encounterCards(["deck"], { name: cardName("01140") })), putIntoPlay(chosen("drones"), firstPlayer), shuffleEncounterDeck()),
  // 1B / 2A / 3A — When Revealed: Each player puts the top card of their deck into play facedown, engaged with them as a Drone minion.
  "01137b.when-revealed": EACH_PLAYER_DRONE,
  "01138a.when-revealed": EACH_PLAYER_DRONE,
  "01139a.when-revealed": EACH_PLAYER_DRONE,
  // Assault on NORAD 2B — Forced Response: After placing threat here during step one of the villain phase, each player must choose to
  // either place 2 threat here or put the top card of their deck into play facedown, engaged with them as a Drone minion.
  // Step one's threat has no source card; "place 2 threat here" is sourced from this scheme, so it doesn't retrigger the ability.
  "01138b.assault-on-norad-forced-response": forcedResponse(
    after.threatPlaced("self"),
    ifThen(
      allOf(duringVillainPhaseStepOne, not(refMatches(eventSource, {}))),
      forEachPlayer(
        eachPlayer,
        chooseOneBy(thatPlayer, option("Place 2 threat here", placeThreat(2, self)), option("Put the top card of your deck into play as a Drone minion", droneFromDeck(thatPlayer))),
      ),
    ),
  ),
  // Countdown to Oblivion 3B — Threat cannot be removed from this scheme.
  "01139b.countdown-to-oblivion-constant": constant(rule({ kind: "threatCannotBeRemoved", target: query("mainScheme") })),

  // Ultron Drones — Each facedown Drone minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1.
  "01140.ultron-drones-constant": constant(
    gets("sch", 1, FACEDOWN_DRONES, { setBase: true }),
    gets("atk", 1, FACEDOWN_DRONES, { setBase: true }),
    gets("hp", 1, FACEDOWN_DRONES, { setBase: true }),
  ),
  // Forced Response: After a facedown Drone minion is defeated, place that card in its owner's discard pile. — The engine's
  // general rule for facedown cards leaving play already does this.
  "01140.ultron-drones-forced-response": coveredByEngineRule(),
  // Program Transmitter — [star] Forced Response: After Ultron schemes, place 1 threat on each side scheme.
  "01141.program-transmitter-forced-response": forcedResponse(after.enemySchemes(query("villain")), placeThreat(1, each(query("sideScheme")))),
  // Hero Action: Exhaust your hero and spend [mental][mental] resources → discard this card.
  "01141.program-transmitter-action": heroAction({ cost: [exhaustYourHero, spend({ mental: 2 })] }, discard(self)),
  // Upgraded Drones — Each facedown Drone minion gets +1 ATK and +1 hit point.
  "01142.upgraded-drones-constant": constant(gets("atk", 1, FACEDOWN_DRONES), gets("hp", 1, FACEDOWN_DRONES)),
  "01142.upgraded-drones-action": SPEND_TO_DISCARD({ energy: 1, mental: 1, physical: 1 }),
  // Advanced Ultron Drone — Forced Interrupt: When Advanced Ultron Drone is defeated, the engaged player puts the top card of their
  // deck into play facedown, engaged with them as a Drone minion.
  "01143.advanced-ultron-drone-forced-interrupt": forcedInterrupt(when.defeated("self"), droneFromDeck(engagedPlayerOf(self))),
  // Android Efficiency (three printings with different boost costs).
  "01144a.when-revealed": EACH_PLAYER_DRONE,
  "01144a.boost": EFFICIENCY_BOOST("energy"),
  "01144b.when-revealed": EACH_PLAYER_DRONE,
  "01144b.boost": EFFICIENCY_BOOST("mental"),
  "01144c.when-revealed": EACH_PLAYER_DRONE,
  "01144c.boost": EFFICIENCY_BOOST("physical"),
  // Rage of Ultron — When Revealed (Alter-Ego): Ultron schemes. Discard the top card of your deck for each threat placed this way.
  "01145.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain, { bind: "rage" }), moveCards(topOfDeck(varOf("rage.threatPlaced")), "discard")),
  // When Revealed (Hero): Ultron attacks you. Discard the top card of your deck for each damage dealt by this attack.
  "01145.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you, bind: "rage" }), moveCards(topOfDeck(varOf("rage.damage")), "discard")),
  // Repair Sequence — When Revealed: Ultron heals 2 damage for each Drone minion engaged with you. If no damage was healed this way, this card gains surge.
  "01146.when-revealed": whenRevealed(heal(scaled(countOf(YOUR_DRONES), { times: 2 }), theVillain, { bind: "repair" }), ifThen(not(varAtLeast("repair.amount")), surge())),
  // [star] Boost: Ultron heals 1 damage for each Drone minion engaged with you.
  "01146.boost": boost(heal(countOf(YOUR_DRONES), theVillain)),
  // Swarm Attack — When Revealed: Each Drone minion engaged with your hero attacks. If no attacks were made this way, put the top
  // card of your deck into play facedown, engaged with you as a Drone minion.
  "01147.when-revealed": whenRevealed(enemyAttack(each(YOUR_DRONES), { bind: "swarm" }), ifThen(not(made("swarm")), droneFromDeck(you))),
  // Drone Factory — When Revealed: Each player puts the top card of their deck into play facedown as a Drone minion. Place 1 threat here for each Drone minion in play.
  "01148.when-revealed": whenRevealed(droneFromDeck(eachPlayer), placeThreat(countOf(DRONES), self)),
  // Invasive AI — When Revealed: Each player discards the top 3 cards of their deck.
  "01149.when-revealed": whenRevealed(forEachPlayer(eachPlayer, moveCards(topOfDeck(3, thatPlayer), "discard"))),
  // Ultron's Imperative — When Revealed: The first player puts the top 2 cards of their deck into play facedown, engaged with them as Drone minions.
  "01150.when-revealed": whenRevealed(droneFromDeck(firstPlayer, 2)),
});

/** The Under Attack modular set (01151–01154). */
export const UNDER_ATTACK_SET = defineAbilities({
  // Under Attack — When Revealed: Each player chooses to either place 2 threat here or deal 3 damage to their hero.
  "01151.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, chooseOneBy(thatPlayer, option("Place 2 threat here", placeThreat(2, self)), option("Deal 3 damage to your hero", takeDamage(3, thatPlayer)))),
  ),
  // Vibranium Armor — Forced Response: After the villain takes damage, give it a tough status card.
  "01152.vibranium-armor-forced-response": forcedResponse(after.damage(query("villain"), { taken: true }), giveTough(theVillain)),
  // Hero Action: Exhaust your hero and spend [physical][physical] resources → discard this card.
  "01152.vibranium-armor-action": heroAction({ cost: [exhaustYourHero, spend({ physical: 2 })] }, discard(self)),
  // Concussion Blasters — The villain gains retaliate 1.
  "01153.concussion-blasters-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("villain"))),
  // Hero Action: Exhaust your hero and spend [energy][energy] resources → discard this card.
  "01153.concussion-blasters-action": heroAction({ cost: [exhaustYourHero, spend({ energy: 2 })] }, discard(self)),
  // Concussive Blast — When Revealed: Deal 1 damage to each friendly character. ("Friendly" = every player's identities and allies.)
  "01154.when-revealed": whenRevealed(dealDamage(1, each(FRIENDLY_CHARACTER))),
  // [star] Boost: Deal 1 damage to each character you control.
  "01154.boost": boost(dealDamage(1, each(query("character", { controller: "you" })))),
});
